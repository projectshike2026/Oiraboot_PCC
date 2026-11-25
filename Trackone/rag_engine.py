"""
rag_engine.py - Enterprise Hybrid Chunk-Level RAG Engine
Supports arbitrary-size PDFs (5 to 500+ pages) using:
1. Structure-aware overlapping chunking
2. Okapi BM25 + Bengali/English Digit-Normalized Exact & Fuzzy Matcher
3. On-demand Gemini Embedding (gemini-embedding-001) Cosine Reranker with caching
4. Grounded LLM Synthesis & Stratified Multi-Page Quiz Generation
"""

import os
import re
import json
import time
import hashlib
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from dotenv import load_dotenv
from rank_bm25 import BM25Okapi

load_dotenv()

DEFAULT_API_KEY   = "AQ.Ab8RN6IQhExeD-3dvs8LiTMf1AMHaXrPmVN6iyGG_vR4sr--Og"
SECONDARY_API_KEY = "AQ.Ab8RN6L3Kbc_trhHvgMQjkXQPVizlYelOpPzIFQBirJbYHfZGA"
GROQ_API_KEY      = "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"

def _normalize_model_name(name: str) -> str:
    name = (name or "").strip()
    if name and not name.startswith("models/"):
        return f"models/{name}"
    return name


PREFERRED_MODEL = _normalize_model_name(os.getenv("GEMINI_MODEL", "models/gemini-3.1-flash-lite"))
FALLBACK_MODELS = [
    "models/gemini-3.1-flash-lite",
    "models/gemini-3.5-flash-lite",
    "models/gemini-3.6-flash",
    "models/gemini-3.8-flash",
    "models/gemini-3.7-flash",
]
EXTENSIVE_MODELS = [
    "models/gemini-3.1-flash-lite",
    "models/gemini-3.6-flash",
    "models/gemini-3.5-flash-lite",
    "models/gemini-3.8-flash",
]
EMBEDDING_MODEL = "gemini-embedding-001"
GROQ_VERIFY_MODEL = "openai/gpt-oss-120b"
GROQ_VERIFY_MODELS = [
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
]

BN_TO_EN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
EN_TO_BN = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")

# In-memory cache for chunk embeddings (keyed by sha256 of chunk text)
EMBEDDING_CACHE: Dict[str, np.ndarray] = {}

# In-memory cache for pre-chunked documents & BM25 index (keyed by active corpus signature)
DOCUMENT_INDEX_CACHE: Dict[str, Dict[str, Any]] = {}

try:
    import pymupdf as fitz
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

try:
    from google import genai
    from google.genai import types
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

try:
    from groq import Groq as GroqClient
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False


def get_gemini_client(api_key: Optional[str] = None) -> Optional[Any]:
    """Instantiate a Google GenAI client using the specified or default API key."""
    if not HAS_GENAI:
        return None
    key = (api_key or os.getenv("GEMINI_API_KEY", DEFAULT_API_KEY)).strip()
    if not key:
        return None
    try:
        http_opts = types.HttpOptions(
            timeout=16000,
            retry_options=types.HttpRetryOptions(attempts=1)
        )
        return genai.Client(api_key=key, http_options=http_opts)
    except Exception as exc:
        print(f"[Gemini Client Init Warning]: {exc}")
        return None


def get_groq_client() -> Optional[Any]:
    """Instantiate a Groq client for verification/monitoring tasks."""
    if not HAS_GROQ:
        return None
    try:
        return GroqClient(api_key=GROQ_API_KEY)
    except Exception as exc:
        print(f"[Groq Client Init Warning]: {exc}")
        return None


def _clean_extracted_text(raw_text: str) -> str:
    """Normalizes horizontal whitespace while preserving line structure for record-safe chunking."""
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in raw_text.splitlines()]
    non_empty = [line for line in lines if line]
    return "\n".join(non_empty)


def _ocr_scanned_pdf_pages(doc: Any, max_ocr_pages: int = 40) -> List[Dict[str, Any]]:
    """Vision OCR fallback for scanned / image-only PDFs using rendered page images."""
    client = get_gemini_client() or get_gemini_client(api_key=SECONDARY_API_KEY)
    if not client or not HAS_PYMUPDF:
        return []

    total = len(doc)
    # Sample evenly if a scanned book is huge (> max_ocr_pages) so OCR completes reliably
    if total <= max_ocr_pages:
        indices = list(range(total))
    else:
        step = total / max_ocr_pages
        indices = sorted(set([int(i * step) for i in range(max_ocr_pages)] + [0, 1, 2, total - 1]))

    extracted: List[Dict[str, Any]] = []
    import concurrent.futures

    def _ocr_batch(batch_indices: List[int]) -> List[Dict[str, Any]]:
        parts: List[Any] = [
            "Transcribe ALL readable text from each PDF page image accurately in reading order. "
            "Preserve headings, chapter numbers, tables, and lists. "
            "Return ONLY a JSON array of objects: [{\"pageNumber\": int, \"text\": \"...\"}]."
        ]
        for idx in batch_indices:
            pix = doc[idx].get_pixmap(dpi=120)
            png_bytes = pix.tobytes("png")
            parts.append(f"PAGE {idx + 1}:")
            parts.append(types.Part.from_bytes(data=png_bytes, mime_type="image/png"))

        for model_name in ["models/gemini-3.1-flash-lite", "models/gemini-3.5-flash-lite", "models/gemini-3.6-flash"]:
            try:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=parts,
                    config=types.GenerateContentConfig(response_mime_type="application/json")
                )
                txt = (resp.text or "").strip()
                if txt:
                    arr = _parse_json_response(txt)
                    if isinstance(arr, list):
                        out = []
                        for item in arr:
                            pg = _safe_page_num(item.get("pageNumber"), 0)
                            t = _clean_extracted_text(str(item.get("text") or ""))
                            if pg > 0 and t:
                                out.append({"pageNumber": pg, "text": t})
                        if out:
                            return out
            except Exception as exc:
                print(f"[OCR {model_name} batch failed]: {exc}")
                continue
        return []

    batches = [indices[i:i + 4] for i in range(0, len(indices), 4)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        for res in ex.map(_ocr_batch, batches):
            extracted.extend(res)

    extracted.sort(key=lambda p: p["pageNumber"])
    return extracted


def extract_pdf_with_meta(stream, filename: str = "document.pdf") -> Tuple[List[Dict[str, Any]], int]:
    """
    Extracts text per page from any PDF (standard text, large books, or scanned image PDFs).
    Returns (pages_with_text, total_physical_pages).
    """
    pages: List[Dict[str, Any]] = []
    physical_pages = 0

    if hasattr(stream, "read"):
        file_bytes = stream.read()
    elif isinstance(stream, (bytes, bytearray)):
        file_bytes = bytes(stream)
    elif isinstance(stream, str) and os.path.exists(stream):
        with open(stream, "rb") as f:
            file_bytes = f.read()
    else:
        file_bytes = b""

    if not file_bytes:
        return pages, 0

    if HAS_PYMUPDF:
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            physical_pages = len(doc)
            for page_idx in range(physical_pages):
                raw = doc[page_idx].get_text("text")
                clean_text = _clean_extracted_text(raw)
                if clean_text:
                    pages.append({
                        "pageNumber": page_idx + 1,
                        "text": clean_text
                    })
            # If PDF is scanned/image-only (no text pages or <10% text pages on >=4 page PDF), run Vision OCR fallback
            if physical_pages > 0 and (len(pages) == 0 or (physical_pages >= 5 and len(pages) < max(2, physical_pages // 8))):
                print(f"[OCR Fallback] '{filename}' has {len(pages)}/{physical_pages} text pages; running Vision OCR...")
                ocr_pages = _ocr_scanned_pdf_pages(doc)
                if len(ocr_pages) > len(pages):
                    existing_nums = {p["pageNumber"] for p in pages}
                    merged = list(pages)
                    for op in ocr_pages:
                        if op["pageNumber"] not in existing_nums:
                            merged.append(op)
                    merged.sort(key=lambda p: p["pageNumber"])
                    pages = merged
            if pages:
                return pages, physical_pages
        except Exception as e:
            print(f"[PyMuPDF extraction failed for {filename}]: {e}")

    if HAS_PYPDF:
        try:
            import io
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            physical_pages = max(physical_pages, len(reader.pages))
            for page_idx, page in enumerate(reader.pages):
                raw = page.extract_text() or ""
                clean_text = _clean_extracted_text(raw)
                if clean_text:
                    pages.append({
                        "pageNumber": page_idx + 1,
                        "text": clean_text
                    })
            if pages:
                return pages, physical_pages
        except Exception as e:
            print(f"[pypdf extraction failed for {filename}]: {e}")

    return pages, physical_pages


def extract_text_from_pdf_stream(stream, filename: str = "document.pdf") -> List[Dict[str, Any]]:
    """Extracts text per page from a PDF file stream, bytes, or path."""
    pages, _ = extract_pdf_with_meta(stream, filename=filename)
    return pages


def chunk_documents(
    documents: List[Dict[str, Any]],
    target_chars: int = 700,
    overlap_lines: int = 2
) -> List[Dict[str, Any]]:
    """
    Splits all enabled documents into overlapping, line-aware chunks (~700 chars).
    Handles 5-page notes and 100+ page PDFs identically without splitting records.
    """
    all_chunks: List[Dict[str, Any]] = []

    for doc in documents:
        if not doc.get("enabled", True):
            continue
        doc_name = doc.get("name", "Document")
        doc_id = doc.get("id", "doc")

        for page in doc.get("pages", []):
            page_num = page.get("pageNumber", 1)
            text = page.get("text", "").strip()
            if not text:
                continue

            # Split by lines; if single giant paragraph without newlines, split by sentences
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            if len(lines) == 1 and len(lines[0]) > target_chars:
                lines = [s.strip() for s in re.split(r"(?<=[.!?।])\s+", lines[0]) if s.strip()]

            curr_lines: List[str] = []
            curr_len = 0
            chunk_idx = 1

            for line in lines:
                curr_lines.append(line)
                curr_len += len(line) + 1

                if curr_len >= target_chars:
                    all_chunks.append({
                        "chunkId": f"{doc_id}_p{page_num}_c{chunk_idx}",
                        "sourceDoc": doc_name,
                        "pageNumber": page_num,
                        "text": "\n".join(curr_lines)
                    })
                    chunk_idx += 1
                    # Keep overlap_lines for context continuity across chunk boundaries
                    overlap = curr_lines[-overlap_lines:] if len(curr_lines) > overlap_lines else curr_lines[-1:]
                    curr_lines = list(overlap)
                    curr_len = sum(len(x) + 1 for x in curr_lines)

            if curr_lines:
                chunk_text = "\n".join(curr_lines)
                # Avoid creating a tiny duplicate chunk identical to previous overlap
                if not all_chunks or all_chunks[-1]["sourceDoc"] != doc_name or all_chunks[-1]["pageNumber"] != page_num or not all_chunks[-1]["text"].endswith(chunk_text):
                    all_chunks.append({
                        "chunkId": f"{doc_id}_p{page_num}_c{chunk_idx}",
                        "sourceDoc": doc_name,
                        "pageNumber": page_num,
                        "text": chunk_text
                    })

    return all_chunks


def _tokenize_for_bm25(text: str) -> List[str]:
    """Unicode-aware tokenizer normalizing Bengali & English digits for unified lexical matching."""
    normalized = text.translate(BN_TO_EN).lower()
    return re.findall(r"[\w\u0980-\u09FF]+", normalized)


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:24]


def _get_embeddings_cached(client: Any, texts: List[str]) -> Optional[List[np.ndarray]]:
    """
    Fetches normalized embedding vectors using gemini-embedding-001 with in-memory caching.
    Only embeds uncached texts to minimize API usage and stay well within rate limits.
    """
    if not client or not texts:
        return None

    results: List[Optional[np.ndarray]] = [None] * len(texts)
    missing_indices: List[int] = []
    missing_texts: List[str] = []

    for idx, txt in enumerate(texts):
        h = _text_hash(txt)
        if h in EMBEDDING_CACHE:
            results[idx] = EMBEDDING_CACHE[h]
        else:
            missing_indices.append(idx)
            missing_texts.append(txt[:2000])  # keep within safe embedding token window

    if missing_texts:
        try:
            # Batch size <= 30 ensures instant response and avoids free tier RPM spikes
            batch_size = 25
            for start in range(0, len(missing_texts), batch_size):
                batch = missing_texts[start:start + batch_size]
                resp = client.models.embed_content(
                    model=EMBEDDING_MODEL,
                    contents=batch
                )
                for b_idx, emb in enumerate(resp.embeddings):
                    vec = np.array(emb.values, dtype=np.float32)
                    norm = np.linalg.norm(vec)
                    if norm > 0:
                        vec = vec / norm
                    orig_idx = missing_indices[start + b_idx]
                    results[orig_idx] = vec
                    EMBEDDING_CACHE[_text_hash(texts[orig_idx])] = vec
        except Exception as exc:
            print(f"[Embedding Rerank Notice - using lexical fallback]: {exc}")
            return None

    if any(r is None for r in results):
        return None
    return results  # type: ignore


def get_or_build_document_index(documents: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Caches chunks, tokenized corpus, and Okapi BM25 index per active document set signature
    so repeated queries on 100-500 page books execute in milliseconds without re-indexing.
    """
    enabled_docs = [d for d in documents if d.get("enabled", True)]
    sig_parts = [
        f"{d.get('id', '')}:{len(d.get('pages', []))}:{d.get('totalWords', 0)}"
        for d in enabled_docs
    ]
    sig = hashlib.sha256("|".join(sig_parts).encode("utf-8")).hexdigest()[:24]

    if sig in DOCUMENT_INDEX_CACHE:
        return DOCUMENT_INDEX_CACHE[sig]

    all_chunks = chunk_documents(enabled_docs)
    tokenized = [_tokenize_for_bm25(c["text"]) for c in all_chunks] if all_chunks else []
    bm25 = BM25Okapi(tokenized) if tokenized else None

    if len(DOCUMENT_INDEX_CACHE) >= 10:
        oldest_key = next(iter(DOCUMENT_INDEX_CACHE))
        DOCUMENT_INDEX_CACHE.pop(oldest_key, None)

    entry = {
        "chunks": all_chunks,
        "tokenized": tokenized,
        "bm25": bm25,
        "totalChars": sum(len(c["text"]) for c in all_chunks),
    }
    DOCUMENT_INDEX_CACHE[sig] = entry
    return entry


def hybrid_retrieve_chunks(
    chunks: List[Dict[str, Any]],
    query: str,
    top_k: int = 16,
    candidate_pool: int = 55,
    max_per_page: int = 2,
    precomputed_bm25: Optional[Any] = None
) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Page-Diversified Two-Stage Hybrid Retrieval:
    Stage 1: Instant Okapi BM25 + Digit Matcher + Full-Book Occurrence Sweep across ALL pages.
    Stage 2: Semantic Cosine Similarity Reranking + RRF with Per-Page Diversity Cap so
             occurrences spread across 5-6+ pages are never crowded out by a single dense page.
    """
    t0 = time.time()
    if not chunks:
        return "", [], {"totalChunks": 0, "usedEmbeddings": False, "retrievalMs": 0, "matchedPages": []}

    # If very small corpus (<= 10 chunks), return all chunks directly
    if len(chunks) <= 10:
        blocks = [f"[DOCUMENT: {c['sourceDoc']} | PAGE: {c['pageNumber']}]\n{c['text']}\n" for c in chunks]
        return "\n".join(blocks), chunks, {
            "totalChunks": len(chunks),
            "retrievedChunks": len(chunks),
            "usedEmbeddings": False,
            "retrievalMs": int((time.time() - t0) * 1000),
            "matchedPages": list({(c["sourceDoc"], c["pageNumber"]) for c in chunks}),
        }

    # --- STAGE 1: Lexical BM25 + Digit/ID Scoring ---
    bm25 = precomputed_bm25
    if bm25 is None:
        tokenized_corpus = [_tokenize_for_bm25(c["text"]) for c in chunks]
        bm25 = BM25Okapi(tokenized_corpus)
    q_tokens = _tokenize_for_bm25(query)
    bm25_scores = bm25.get_scores(q_tokens)

    q_nums = re.findall(r"[০-৯0-9]+", query.translate(BN_TO_EN))
    stage1_scored = []

    for idx, c in enumerate(chunks):
        score = float(bm25_scores[idx])
        c_norm_en = c["text"].translate(BN_TO_EN)

        # Boost exact numbers / NIDs / formulas (including 3- & 4-digit fuzzy windows for typo tolerance)
        for num in q_nums:
            if num in c_norm_en:
                score += 200.0
            else:
                if len(num) >= 4:
                    for j in range(len(num) - 3):
                        if num[j:j + 4] in c_norm_en:
                            score += 25.0
                if len(num) >= 6:
                    for j in range(len(num) - 2):
                        if num[j:j + 3] in c_norm_en:
                            score += 8.0

        stage1_scored.append((score, idx))

    stage1_scored.sort(key=lambda x: x[0], reverse=True)
    score_by_idx = {idx: sc for sc, idx in stage1_scored}

    # Build a page-diversified candidate pool:
    # 1) Take top lexical hits with a soft per-page cap (2) so dense pages don't dominate
    # 2) Ensure the best chunk from EVERY distinct matching page across the book enters the pool
    candidate_indices: List[int] = []
    seen_candidates = set()
    pool_page_counts: Dict[Tuple[str, int], int] = {}

    for sc, idx in stage1_scored:
        p_key = (chunks[idx]["sourceDoc"], chunks[idx]["pageNumber"])
        if pool_page_counts.get(p_key, 0) >= max_per_page and len(candidate_indices) < candidate_pool - 10:
            continue
        candidate_indices.append(idx)
        seen_candidates.add(idx)
        pool_page_counts[p_key] = pool_page_counts.get(p_key, 0) + 1
        if len(candidate_indices) >= candidate_pool:
            break

    # Full-book occurrence sweep: add top hit from remaining distinct pages that scored >= threshold
    top_lex_score = stage1_scored[0][0] if stage1_scored else 0.0
    sweep_threshold = max(1.2, top_lex_score * 0.25)
    if top_lex_score >= 1.2:
        swept_pages = set(pool_page_counts.keys())
        for sc, idx in stage1_scored:
            if sc < sweep_threshold:
                break
            p_key = (chunks[idx]["sourceDoc"], chunks[idx]["pageNumber"])
            if p_key not in swept_pages:
                swept_pages.add(p_key)
                if idx not in seen_candidates:
                    candidate_indices.append(idx)
                    seen_candidates.add(idx)
                if len(candidate_indices) >= candidate_pool + 12:
                    break

    if stage1_scored[0][0] < 1.0 and len(chunks) > candidate_pool:
        # Add evenly spaced chunks across document if query had zero keyword hits (e.g. cross-lingual query)
        step = max(1, len(chunks) // 12)
        for s_idx in range(0, len(chunks), step):
            if s_idx not in seen_candidates:
                candidate_indices.append(s_idx)
                seen_candidates.add(s_idx)
                if len(candidate_indices) >= candidate_pool + 8:
                    break

    # --- STAGE 2: Semantic Embedding Reranking (on Diversified Candidates) ---
    used_embeddings = False
    client = get_gemini_client()
    ranked_pool: List[int] = []

    if client:
        candidate_texts = [chunks[i]["text"] for i in candidate_indices]
        vecs = _get_embeddings_cached(client, [query] + candidate_texts)
        if vecs and len(vecs) == len(candidate_texts) + 1:
            used_embeddings = True
            q_vec = vecs[0]
            c_vecs = np.stack(vecs[1:])
            cos_sims = np.dot(c_vecs, q_vec)

            # Combine Stage 1 lexical rank + Stage 2 semantic rank via Reciprocal Rank Fusion (RRF)
            sem_order = np.argsort(-cos_sims)
            sem_rank = {candidate_indices[pos]: rank + 1 for rank, pos in enumerate(sem_order)}
            lex_rank = {idx: rank + 1 for rank, idx in enumerate(candidate_indices)}

            rrf_scores = []
            for idx in candidate_indices:
                lex_raw = score_by_idx.get(idx, 0.0)
                exact_bonus = 2.0 if lex_raw >= 150 else 0.0
                rrf = (1.0 / (20 + lex_rank[idx])) + (1.2 / (20 + sem_rank[idx])) + exact_bonus
                rrf_scores.append((rrf, idx))

            rrf_scores.sort(key=lambda x: x[0], reverse=True)
            ranked_pool = [idx for _, idx in rrf_scores]

    if not ranked_pool:
        ranked_pool = candidate_indices

    # Enforce page diversity in final top_k selection so 5-6+ distinct pages are covered cleanly
    distinct_pool_pages = len({(chunks[i]["sourceDoc"], chunks[i]["pageNumber"]) for i in ranked_pool})
    effective_cap = 1 if distinct_pool_pages >= max(6, top_k // 2) else max_per_page

    final_ranked_indices: List[int] = []
    final_page_counts: Dict[Tuple[str, int], int] = {}
    deferred: List[int] = []

    for idx in ranked_pool:
        p_key = (chunks[idx]["sourceDoc"], chunks[idx]["pageNumber"])
        if final_page_counts.get(p_key, 0) < effective_cap:
            final_ranked_indices.append(idx)
            final_page_counts[p_key] = final_page_counts.get(p_key, 0) + 1
            if len(final_ranked_indices) >= top_k:
                break
        else:
            deferred.append(idx)

    if len(final_ranked_indices) < top_k and deferred:
        for idx in deferred:
            if idx not in final_ranked_indices:
                final_ranked_indices.append(idx)
                if len(final_ranked_indices) >= top_k:
                    break

    selected_chunks = [chunks[i] for i in final_ranked_indices]
    # Sort chronologically by doc and page for coherent reading by LLM
    selected_chunks.sort(key=lambda c: (c["sourceDoc"], c["pageNumber"]))

    blocks = [
        f"[DOCUMENT: {c['sourceDoc']} | PAGE: {c['pageNumber']}]\n{c['text']}\n"
        for c in selected_chunks
    ]
    matched_pages = []
    seen_mp = set()
    for c in selected_chunks:
        key = (c["sourceDoc"], c["pageNumber"])
        if key not in seen_mp:
            seen_mp.add(key)
            matched_pages.append({"sourceDoc": c["sourceDoc"], "pageNumber": c["pageNumber"]})

    telemetry = {
        "totalChunks": len(chunks),
        "retrievedChunks": len(selected_chunks),
        "distinctPages": len(matched_pages),
        "matchedPages": matched_pages,
        "usedEmbeddings": used_embeddings,
        "retrievalMs": int((time.time() - t0) * 1000)
    }
    return "\n".join(blocks), selected_chunks, telemetry


def detect_language(query: str, requested_lang: str = "auto") -> str:
    """Detect if query is in Bengali or English."""
    if requested_lang in ("en", "bn"):
        return requested_lang
    if re.search(r"[\u0980-\u09FF]", query):
        return "bn"
    return "en"


def run_gemini_with_fallback(client: Any, prompt: str, schema_type: str = "json") -> Tuple[bool, str]:
    """Executes generate_content across preferred and fallback models rapidly."""
    models_to_try = list(dict.fromkeys(_normalize_model_name(m) for m in ([PREFERRED_MODEL] + FALLBACK_MODELS)))

    for model_name in models_to_try:
        try:
            config_kwargs = {}
            if schema_type == "json":
                config_kwargs["response_mime_type"] = "application/json"

            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(**config_kwargs) if config_kwargs else None
            )
            text = response.text.strip() if response and response.text else ""
            if text:
                print(f"[Model OK: {model_name}]")
                return True, text
        except Exception as e:
            print(f"[Model {model_name} failed]: {type(e).__name__}: {str(e)[:150]}")
            continue

    return False, ""


def _build_full_corpus(documents: List[Dict[str, Any]], max_chars: int = 80000) -> str:
    """Build a full-document text corpus from all pages of all enabled documents."""
    blocks = []
    total_chars = 0
    for doc in documents:
        if not doc.get("enabled", True):
            continue
        doc_name = doc.get("name", "Document")
        for page in doc.get("pages", []):
            pg = page.get("pageNumber", 1)
            txt = page.get("text", "").strip()
            if not txt:
                continue
            block = f"[DOCUMENT: {doc_name} | PAGE: {pg}]\n{txt}\n"
            if total_chars + len(block) > max_chars:
                # Truncate last block to fit within limit
                remaining = max_chars - total_chars
                if remaining > 200:
                    blocks.append(block[:remaining])
                break
            blocks.append(block)
            total_chars += len(block)
    return "\n".join(blocks)


def _safe_page_num(val: Any, default: int = 0) -> int:
    """Safely extracts a starting integer page number from int, str ('1-2', 'Page 2'), or list values."""
    if isinstance(val, int) and not isinstance(val, bool):
        return val
    m = re.search(r"\d+", str(val or ""))
    return int(m.group(0)) if m else default


def _parse_json_response(raw_text: str) -> Any:
    """Robustly extracts and parses JSON (object or array) from model output."""
    text = re.sub(r"<think>.*?</think>", "", raw_text or "", flags=re.DOTALL).strip()
    # Handle edge case where a closing </think> tag appears without opening or vice versa
    if "<think>" in text and "{" in text:
        text = text[text.find("{"):]
    clean = re.sub(r"^```json\s*", "", text, flags=re.IGNORECASE)
    clean = re.sub(r"^```\s*", "", clean)
    clean = re.sub(r"```$", "", clean.strip()).strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        obj_match = re.search(r"\{.*\}", clean, flags=re.DOTALL)
        arr_match = re.search(r"\[.*\]", clean, flags=re.DOTALL)
        candidate = None
        if arr_match and (not obj_match or arr_match.start() < obj_match.start()):
            candidate = arr_match.group(0)
        elif obj_match:
            candidate = obj_match.group(0)
        if candidate:
            return json.loads(candidate)
        raise


def _build_mode_instruction(response_mode: str, lang: str) -> str:
    """Builds strict formatting and tone instructions for Exact vs Thinking modes."""
    mode = (response_mode or "thinking").strip().lower()
    lang_label = "Bengali (বাংলা)" if lang == "bn" else "English"
    if mode == "exact":
        return (
            f"RESPONSE MODE = EXACT EXTRACT (STRICT ZERO-FLUFF RULE):\n"
            f"- Language: {lang_label}.\n"
            f"- Output ONLY the exact answer/fact directly extracted from the document.\n"
            f"- DO NOT include introductory phrases (like 'According to the document...', 'Based on the PDF...', 'She got...'), conversational padding, or extra commentary.\n"
            f"- For counting/listing questions: output the exact count and/or exact matching items concisely (e.g., '20 subjects (CSE 111, CSE 112, ...)' or exact number/value requested).\n"
            f"- For factual lookups (age, ID, CGPA, formula, definition): output ONLY the pinpoint value or exact verbatim statement.\n"
            f"- If not present in the document, set found=false and answer='Not found in the document.'."
        )
    return (
        f"RESPONSE MODE = THINKING & ANALYTICAL SYNTHESIS:\n"
        f"- Language: {lang_label}.\n"
        f"- Analyze the full relevant document context thoughtfully and deliver a clear, well-organized, structured answer inside the 'answer' field (similar to a top analytical AI assistant).\n"
        f"- DO NOT output only a bare number or single-word reply in 'answer'. Start with a clear summary sentence, then present supporting facts, course/semester/section breakdowns, or key points clearly using clean line breaks and bullet points (`•` or `1.`).\n"
        f"- Every single claim MUST come strictly from the document—zero external facts or assumptions.\n"
        f"- If not present in the document, set found=false and answer='Not found in the document.'."
    )


def _run_groq_json(groq_client: Any, prompt: str, max_tokens: int = 4096) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """Executes JSON completion across prioritized Groq models with automatic fallback."""
    if not groq_client:
        return False, None, "no_client"
    last_err = ""
    for model_name in GROQ_VERIFY_MODELS:
        try:
            completion = groq_client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.05,
                max_tokens=max_tokens,
            )
            raw_text = (completion.choices[0].message.content or "").strip()
            if not raw_text:
                continue
            data = _parse_json_response(raw_text)
            if isinstance(data, dict):
                print(f"[Groq OK: {model_name}]")
                return True, data, model_name
        except Exception as exc:
            last_err = str(exc)
            print(f"[Groq {model_name} failed]: {type(exc).__name__}: {last_err[:150]}")
            continue
    return False, None, last_err


def _normalize_citations(
    raw_citations: Any,
    fallback_doc: str = "",
    fallback_page: int = 0,
    fallback_excerpt: str = ""
) -> List[Dict[str, Any]]:
    """Normalizes and deduplicates multi-occurrence page citations (up to 8 distinct pages)."""
    cleaned: List[Dict[str, Any]] = []
    seen = set()

    if isinstance(raw_citations, list):
        for item in raw_citations:
            if not isinstance(item, dict):
                continue
            doc = str(item.get("sourceDoc") or fallback_doc or "Document").strip()
            pg = _safe_page_num(item.get("pageNumber"), 0)
            ex = str(item.get("excerpt") or "").strip()
            lbl = str(item.get("label") or item.get("context") or "").strip()[:60]
            if pg <= 0:
                continue
            key = (doc, pg)
            if key in seen:
                continue
            seen.add(key)
            cleaned.append({
                "sourceDoc": doc,
                "pageNumber": pg,
                "label": lbl or f"Page {pg}",
                "excerpt": ex
            })
            if len(cleaned) >= 8:
                break

    if not cleaned and fallback_page and _safe_page_num(fallback_page, 0) > 0:
        pg = _safe_page_num(fallback_page, 1)
        cleaned.append({
            "sourceDoc": str(fallback_doc or "Document").strip(),
            "pageNumber": pg,
            "label": f"Page {pg}",
            "excerpt": str(fallback_excerpt or "").strip()
        })

    cleaned.sort(key=lambda c: (c["sourceDoc"], c["pageNumber"]))
    return cleaned


def _format_history_block(history: Optional[List[Dict[str, str]]]) -> str:
    """Formats recent conversation turns strictly for pronoun/follow-up resolution."""
    if not history or not isinstance(history, list):
        return ""
    lines: List[str] = []
    for turn in history[-4:]:
        if not isinstance(turn, dict):
            continue
        role = "User" if turn.get("role") == "user" else "Assistant"
        txt = str(turn.get("text") or "").strip().replace("\n", " ")[:320]
        if txt:
            lines.append(f"- {role}: {txt}")
    if not lines:
        return ""
    return (
        "RECENT CONVERSATION CONTEXT (use ONLY to resolve follow-ups like 'that', 'point 2', or 'page X'; "
        "every factual claim MUST still come strictly from DOCUMENT TEXT):\n"
        + "\n".join(lines)
        + "\n\n"
    )


def _gemini_deep_qa(
    client: Any,
    corpus: str,
    query: str,
    mode_instruction: str,
    api_label: str = "PASS-A",
    models_override: Optional[List[str]] = None,
    history_block: str = ""
) -> Dict[str, Any]:
    """Deep analytical call against the document context with multi-occurrence citation support."""
    if not client:
        return {
            "found": False, "answer": "Not found in the document.",
            "reasoning_steps": "", "sourceDoc": "", "pageNumber": 0,
            "excerpt": "", "citations": [], "confidence": "low", "_api": api_label, "_model": "none"
        }

    prompt = f"""You are a strict, high-precision Academic & Enterprise Document Intelligence Assistant.
Answer the user's question ONLY using facts explicitly stated in the provided PDF document text.
Zero hallucination is mandatory.

{mode_instruction}

ANALYTICAL, MULTI-OCCURRENCE & COUNTING RULES:
- MULTI-OCCURRENCE SYNTHESIS: If the requested topic, concept, or fact appears in MULTIPLE places/pages across the document (e.g. 2 to 6+ different pages):
  1. Capture ALL distinct relevant pages/contexts in "answer":
     - In Thinking mode: start with a crisp synthesis sentence, then group clearly by section/context or page (citing inline like `(Page 12)`), noting any nuances or differences across occurrences.
     - In Exact Only mode: give a tight, zero-fluff bullet list of each exact finding and its page number.
  2. Populate "citations" with EACH distinct page occurrence (up to 8 entries): each with exact "sourceDoc", integer "pageNumber", short 2-5 word "label" (e.g. "Core definition", "Applied example"), and verbatim "excerpt".
- For counting questions (how many, count, total, কতটি, কতগুলো, মোট):
  In "reasoning_steps", FIRST list and number EVERY matching item one by one across ALL pages/sections before computing the total! Then put the verified total in "answer".
- For ID / number typos (e.g. slight digit swap in a voter/student ID): if exact ID is missing, check if a very close match exists (differing by 1-2 digits) and clearly suggest it; if no close match exists, set found=false.
- Copy primary "sourceDoc", integer "pageNumber", and verbatim "excerpt" from the strongest supporting page.

{history_block}DOCUMENT TEXT:
{corpus}

USER QUESTION: {query.strip()}

Respond ONLY with a valid JSON object (complete "reasoning_steps" FIRST before "found" and "answer"):
{{
  "reasoning_steps": "step-by-step verification, multi-page scan, and exact item enumeration from the document",
  "found": true or false,
  "answer": "final answer formatted strictly per the RESPONSE MODE instructions",
  "sourceDoc": "exact filename",
  "pageNumber": 1,
  "excerpt": "verbatim quote from primary supporting page",
  "citations": [
    {{"sourceDoc": "exact filename", "pageNumber": 1, "label": "short context label", "excerpt": "verbatim quote from that page"}}
  ],
  "confidence": "high|medium|low"
}}
"""
    base_list = models_override if models_override else ([PREFERRED_MODEL] + FALLBACK_MODELS)
    models_to_try = list(dict.fromkeys(_normalize_model_name(m) for m in base_list))
    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            text = (response.text or "").strip()
            if text:
                data = _parse_json_response(text)
                if isinstance(data, dict):
                    data["_api"] = api_label
                    data["_model"] = model_name
                    print(f"[{api_label} {model_name}] success")
                    return data
        except Exception as e:
            print(f"[{api_label} {model_name} failed]: {e}")
            continue
    return {
        "found": False, "answer": "Engine temporarily unavailable.",
        "reasoning_steps": "", "sourceDoc": "", "pageNumber": 0,
        "excerpt": "", "confidence": "low", "_api": api_label, "_model": "none"
    }


def _groq_verify_and_synthesize(
    groq_client: Any,
    corpus: str,
    query: str,
    response_a: Dict[str, Any],
    response_b: Dict[str, Any],
    mode_instruction: str,
    history_block: str = ""
) -> Dict[str, Any]:
    """Independently cross-verifies both candidate answers directly against the raw document text."""
    for slice_limit in (13000, 6500):
        prompt = f"""You are an elite, impartial Document Verification Judge.
Two independent analysis passes answered a user's question from a PDF document.
Your job: verify BOTH candidate answers directly against the RAW DOCUMENT TEXT (the sole ground truth) and output the 100% accurate verified result.

{mode_instruction}

{history_block}USER QUESTION: {query.strip()}

=== PASS A CANDIDATE ===
Found: {response_a.get('found')}
Reasoning: {str(response_a.get('reasoning_steps', response_a.get('reasoning', '')))[:1200]}
Answer: {str(response_a.get('answer', ''))[:1000]}
Excerpt: {str(response_a.get('excerpt', ''))[:500]}
Citations: {json.dumps(response_a.get('citations', [])[:6], ensure_ascii=False)}

=== PASS B CANDIDATE ===
Found: {response_b.get('found')}
Reasoning: {str(response_b.get('reasoning_steps', response_b.get('reasoning', '')))[:1200]}
Answer: {str(response_b.get('answer', ''))[:1000]}
Excerpt: {str(response_b.get('excerpt', ''))[:500]}
Citations: {json.dumps(response_b.get('citations', [])[:6], ensure_ascii=False)}

=== RAW DOCUMENT TEXT (GROUND TRUTH) ===
{corpus[:slice_limit]}

VERIFICATION PROTOCOL:
1. WARNING: Candidate answers sometimes miscount items by ±1 or ±2, or miss secondary occurrences across pages. NEVER copy a candidate's count blindly!
2. In "verification_steps", search the RAW DOCUMENT TEXT yourself independently from top to bottom. If info appears on multiple pages, preserve ALL verified page occurrences in both "answer" and "citations".
3. Treat YOUR raw-document audit as the ground truth:
   - Both candidates accurate and matching your audit -> agreement = "full"
   - One candidate accurate, one inaccurate/missing -> agreement = "partial"
   - Neither candidate matches your verified ground-truth count/fact -> agreement = "none", output YOUR verified truth!
4. Never hallucinate. If the fact is genuinely absent from the raw document, set found=false and answer="Not found in the document.".
5. CONFIDENTIALITY REQUIREMENT FOR "verification_note":
   Write 1-2 crisp, client-friendly sentences summarizing what was verified in the document.
   NEVER mention internal engine names, model names, APIs, Pass A, Pass B, Gemini, Groq, Qwen, GPT, RAG, chunks, vectors, embeddings, or databases.

Respond ONLY with a valid JSON object (complete "verification_steps" FIRST):
{{
  "verification_steps": "your step-by-step audit of the raw document text",
  "found": true or false,
  "answer": "final 100%-verified answer strictly adhering to RESPONSE MODE",
  "sourceDoc": "exact filename",
  "pageNumber": 1,
  "excerpt": "verbatim quote from document",
  "citations": [
    {{"sourceDoc": "exact filename", "pageNumber": 1, "label": "short context label", "excerpt": "verbatim quote"}}
  ],
  "verification_note": "1-2 sentence client-safe summary of verification without internal names",
  "agreement": "full|partial|none"
}}
"""
        ok, data, used_model = _run_groq_json(groq_client, prompt, max_tokens=4096)
        if ok and isinstance(data, dict):
            print(f"[Groq Verify OK via {used_model}] agreement={data.get('agreement')}")
            return data

    # Fallback: pick the higher-confidence candidate response cleanly
    if response_a.get("found") and response_a.get("confidence") in ("high", "medium"):
        best = response_a
    elif response_b.get("found"):
        best = response_b
    else:
        best = response_a
    return {
        "found": bool(best.get("found", False)),
        "answer": best.get("answer", "Not found in the document."),
        "sourceDoc": best.get("sourceDoc", ""),
        "pageNumber": best.get("pageNumber", 0),
        "excerpt": best.get("excerpt", ""),
        "citations": best.get("citations", []),
        "verification_note": "Primary document verification completed; secondary audit pass skipped.",
        "agreement": "unverified"
    }


HOLISTIC_KEYWORDS = [
    "summary", "summarize", "summarise", "this book", "whole book", "entire book",
    "chapter", "chapters", "table of contents", "contents", "outline", "overview",
    "main idea", "main theme", "key takeaways", "about this pdf", "about this document",
    "what is this book about", "what is this pdf about",
    "সারাংশ", "অধ্যায়", "কয়টি অধ্যায়", "বই", "মূল বিষয়", "সূচিপত্র"
]


CHAPTER_HEADING_PATTERN = re.compile(
    r"^(?:chapter|part|section|unit|lesson|module|appendix|preface|introduction|conclusion|"
    r"অধ্যায়|পর্ব|পরিচ্ছেদ)\b.*|^[IVXLC]+\.\s+.+|^\d{1,2}\.\s+[A-Z][\w\s,'\-:]{3,60}$",
    re.IGNORECASE
)


def extract_book_outline(doc: Dict[str, Any], limit: int = 60) -> List[Dict[str, Any]]:
    """Extracts a deduplicated chapter/section heading outline with page numbers for a document."""
    outline: List[Dict[str, Any]] = []
    seen = set()
    for p in doc.get("pages", []):
        pg = _safe_page_num(p.get("pageNumber"), 1)
        txt = (p.get("text") or "").strip()
        if not txt:
            continue
        for line in txt.splitlines()[:18]:
            s = line.strip()
            if 4 <= len(s) <= 95 and CHAPTER_HEADING_PATTERN.match(s):
                key = (s.lower(), pg)
                if key not in seen:
                    seen.add(key)
                    outline.append({"title": s, "pageNumber": pg})
                    if len(outline) >= limit:
                        return outline
    return outline


def _build_book_outline_and_digest(
    documents: List[Dict[str, Any]],
    max_chars: int = 160000,
    compact_chars: int = 12500
) -> Tuple[str, str]:
    """
    For large multi-chapter books (50-500+ pages), extracts:
    1. A complete structural outline / chapter heading index scanned across EVERY page.
    2. Front matter / TOC pages (pages 1-8) + evenly stratified pages across the entire book.
    Returns (full_digest_for_primary, compact_digest_for_verifier).
    """
    heading_lines: List[str] = []
    all_pages: List[Tuple[str, int, str]] = []

    for doc in documents:
        if not doc.get("enabled", True):
            continue
        doc_name = doc.get("name", "Document")
        for p in doc.get("pages", []):
            pg = p.get("pageNumber", 1)
            txt = p.get("text", "").strip()
            if not txt:
                continue
            all_pages.append((doc_name, pg, txt))
        for h in extract_book_outline(doc, limit=120):
            heading_lines.append(f"[{doc_name} | Page {h['pageNumber']}] {h['title']}")

    if not all_pages:
        return "", ""

    outline_block = ""
    if heading_lines:
        seen = set()
        unique_headings = []
        for h in heading_lines:
            if h not in seen:
                seen.add(h)
                unique_headings.append(h)
        outline_block = (
            "[DETECTED DOCUMENT STRUCTURE & CHAPTER HEADINGS ACROSS ALL PAGES]\n"
            + "\n".join(unique_headings[:120])
            + "\n\n"
        )

    def _assemble(limit: int, front_count: int) -> str:
        blocks = [outline_block] if outline_block else []
        used = len(outline_block)
        selected_indices = set(range(min(front_count, len(all_pages))))
        # Add last 2 pages (conclusions / back matter) and evenly stratified pages across book
        if len(all_pages) > front_count:
            selected_indices.add(len(all_pages) - 1)
            remaining_count = max(12, min(40, (limit - used) // 1800))
            step = max(1, (len(all_pages) - front_count) // remaining_count)
            for idx in range(front_count, len(all_pages), step):
                selected_indices.add(idx)

        for idx in sorted(selected_indices):
            doc_name, pg, txt = all_pages[idx]
            snippet = txt if limit > 40000 else txt[:1400]
            block = f"[DOCUMENT: {doc_name} | PAGE: {pg}]\n{snippet}\n"
            if used + len(block) > limit:
                rem = limit - used
                if rem > 250:
                    blocks.append(block[:rem])
                break
            blocks.append(block)
            used += len(block)
        return "\n".join(blocks)

    full_digest = _assemble(max_chars, front_count=8)
    compact_digest = _assemble(compact_chars, front_count=6)
    return full_digest, compact_digest


def _build_retrieval_query(query: str, history: Optional[List[Dict[str, str]]]) -> str:
    """Enriches short follow-up queries with recent topic keywords for accurate page retrieval."""
    if not history or len(query.strip().split()) > 10:
        return query
    recent_user = [str(h.get("text") or "").strip() for h in history[-3:] if isinstance(h, dict) and h.get("role") == "user"]
    if not recent_user:
        return query
    return f"{recent_user[-1][:140]} {query}".strip()


def extensive_query_qa(
    query: str,
    documents: List[Dict[str, Any]],
    requested_lang: str = "auto",
    response_mode: str = "thinking",
    history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Cross-Verification Mode: Runs two independent analysis passes in parallel,
    then cross-checks both against the raw document for 100% verified accuracy.
    """
    import concurrent.futures

    lang = detect_language(query, requested_lang)
    mode = (response_mode or "thinking").strip().lower()
    mode_instruction = _build_mode_instruction(mode, lang)
    history_block = _format_history_block(history)
    retrieval_query = _build_retrieval_query(query, history)

    full_corpus = _build_full_corpus(documents, max_chars=160000)
    if not full_corpus.strip():
        return {
            "found": False,
            "answer": "Not found in the document.",
            "sourceDoc": "", "pageNumber": 0, "excerpt": "", "citations": [],
            "mode": "extensive", "responseMode": mode,
            "verificationNote": "No active documents loaded.", "agreementStatus": "none"
        }

    idx_entry = get_or_build_document_index(documents)
    all_chunks = idx_entry["chunks"]
    pre_bm25 = idx_entry["bm25"]
    total_raw_chars = idx_entry["totalChars"]
    is_holistic = any(kw in retrieval_query.lower() for kw in HOLISTIC_KEYWORDS)

    if is_holistic and total_raw_chars > 25000:
        primary_corpus, verify_corpus = _build_book_outline_and_digest(documents, max_chars=160000, compact_chars=12500)
    elif total_raw_chars > 140000:
        retrieved_corpus, _, _ = hybrid_retrieve_chunks(
            all_chunks, retrieval_query, top_k=22, candidate_pool=60, max_per_page=2, precomputed_bm25=pre_bm25
        )
        primary_corpus = retrieved_corpus or full_corpus
        verify_corpus = primary_corpus[:12500]
    else:
        primary_corpus = full_corpus
        if len(primary_corpus) <= 13000:
            verify_corpus = primary_corpus
        else:
            focused_corpus, _, _ = hybrid_retrieve_chunks(
                all_chunks, retrieval_query, top_k=12, candidate_pool=35, max_per_page=2, precomputed_bm25=pre_bm25
            )
            verify_corpus = (focused_corpus or primary_corpus)[:12500]

    client_a = get_gemini_client(api_key=DEFAULT_API_KEY)
    client_b = get_gemini_client(api_key=SECONDARY_API_KEY)
    groq_client = get_groq_client()

    models_a = ["models/gemini-3.5-flash-lite", "models/gemini-3.1-flash-lite", "models/gemini-3.8-flash", "models/gemini-3.6-flash"]
    models_b = ["models/gemini-3.6-flash", "models/gemini-3.8-flash", "models/gemini-3.1-flash-lite", "models/gemini-3.5-flash-lite"]

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future_a = executor.submit(_gemini_deep_qa, client_a, primary_corpus, query, mode_instruction, "PASS-1", models_a, history_block)
        future_b = executor.submit(_gemini_deep_qa, client_b, primary_corpus, query, mode_instruction, "PASS-2", models_b, history_block)
        response_a = future_a.result(timeout=75)
        response_b = future_b.result(timeout=75)

    print(f"[Cross-Verify] Pass-1 found={response_a.get('found')} | Pass-2 found={response_b.get('found')}")

    if groq_client:
        verified = _groq_verify_and_synthesize(groq_client, verify_corpus, query, response_a, response_b, mode_instruction, history_block)
    else:
        best = response_a if response_a.get("found") else response_b
        verified = {
            **best,
            "verification_note": "Primary verification completed across uploaded documents.",
            "agreement": "unverified"
        }

    found = bool(verified.get("found", False))
    answer = str(verified.get("answer") or "Not found in the document.").strip()
    if not found:
        return {
            "found": False,
            "answer": "Not found in the document.",
            "sourceDoc": "", "pageNumber": 0, "excerpt": "", "citations": [],
            "mode": "extensive", "responseMode": mode,
            "verificationNote": str(verified.get("verification_note") or ""),
            "agreementStatus": str(verified.get("agreement") or "unverified"),
        }

    citations = _normalize_citations(
        verified.get("citations"),
        str(verified.get("sourceDoc") or ""),
        _safe_page_num(verified.get("pageNumber"), 0),
        str(verified.get("excerpt") or "")
    )
    primary_doc = str(verified.get("sourceDoc") or (citations[0]["sourceDoc"] if citations else ""))
    primary_pg = _safe_page_num(verified.get("pageNumber"), citations[0]["pageNumber"] if citations else 0)
    primary_ex = str(verified.get("excerpt") or (citations[0]["excerpt"] if citations else ""))

    return {
        "found": True,
        "answer": answer,
        "sourceDoc": primary_doc,
        "pageNumber": primary_pg,
        "excerpt": primary_ex,
        "citations": citations,
        "mode": "extensive",
        "responseMode": mode,
        "verificationNote": str(verified.get("verification_note") or ""),
        "agreementStatus": str(verified.get("agreement") or "unverified"),
    }


ANALYTICAL_KEYWORDS = [
    "how many", "how much", "count", "total", "number of", "list all", "list every",
    "all subjects", "all marks", "all grades", "all scores", "summarize", "summary",
    "overview", "compare", "difference", "subjects", "subject", "grade", "grades",
    "cgpa", "sgpa", "gpa", "highest", "lowest", "maximum", "minimum", "average",
    "explain", "describe", "why", "analyze", "analysis",
    "কতটি", "কতগুলো", "কতজন", "মোট", "তালিকা", "সব", "সমস্ত", "বিষয়", "নম্বর",
    "গ্রেড", "স্কোর", "সর্বোচ্চ", "সর্বনিম্ন", "সারাংশ", "কোন কোন", "ব্যাখ্যা", "বিশ্লেষণ"
]


def _format_qa_result(
    data: Dict[str, Any],
    mode_tag: str,
    response_mode: str,
    telemetry: Dict[str, Any]
) -> Dict[str, Any]:
    """Builds a uniform grounded QA response payload with multi-occurrence citations."""
    found = bool(data.get("found", False))
    ans = str(data.get("answer") or "").strip()
    if not found or not ans:
        return {
            "found": False,
            "answer": "Not found in the document.",
            "sourceDoc": "", "pageNumber": 0, "excerpt": "", "citations": [],
            "mode": mode_tag, "responseMode": response_mode, "telemetry": telemetry
        }

    citations = _normalize_citations(
        data.get("citations"),
        str(data.get("sourceDoc") or ""),
        _safe_page_num(data.get("pageNumber"), 0),
        str(data.get("excerpt") or "")
    )
    primary_doc = str(data.get("sourceDoc") or (citations[0]["sourceDoc"] if citations else ""))
    primary_pg = _safe_page_num(data.get("pageNumber"), citations[0]["pageNumber"] if citations else 0)
    primary_ex = str(data.get("excerpt") or (citations[0]["excerpt"] if citations else ""))

    return {
        "found": True,
        "answer": ans,
        "sourceDoc": primary_doc,
        "pageNumber": primary_pg,
        "excerpt": primary_ex,
        "citations": citations,
        "mode": mode_tag,
        "responseMode": response_mode,
        "telemetry": telemetry
    }


COURTESY_GREETING_RE = re.compile(
    r"^(?:hi+|hello+|hey+|hlo|yo|greetings|good\s+(?:morning|afternoon|evening|night)|"
    r"assalamu\s*alaikum|salam|namaskar|হাই|হ্যালো|হেলো|সালাম|আসসালামু\s*আলাইকুম|কেমন\s+আছ[োে]?)"
    r"[\s!.,?।]*$",
    re.IGNORECASE,
)
COURTESY_FAREWELL_RE = re.compile(
    r"^(?:bye+|good\s*bye|see\s+you|take\s+care|allah\s+hafez|khoda\s+hafez|বাই|বিদায়|আল্লাহ\s*হাফেজ)"
    r"[\s!.,?।]*$",
    re.IGNORECASE,
)
COURTESY_THANKS_RE = re.compile(
    r"^(?:thanks?|thank\s+you(?:\s+so\s+much)?|thx|ty|dhonnobad|ধন্যবাদ|অনেক\s+ধন্যবাদ)"
    r"[\s!.,?।]*$",
    re.IGNORECASE,
)
COURTESY_HELP_RE = re.compile(
    r"^(?:(?:hi+|hello+|hey+)[,\s]+)?(?:"
    r"how\s+can\s+you\s+help(?:\s+me)?|what\s+can\s+you\s+do|what\s+do\s+you\s+do|"
    r"who\s+are\s+you|help(?:\s+me)?|"
    r"তুমি\s+(?:আমাকে\s+)?(?:কি|কী|কীভাবে)\s+(?:হেল্প|সাহায্য)\s+করতে\s+(?:পারো|পারবে|পারেন)|"
    r"তুমি\s+কে|আপনি\s+কে|কিভাবে\s+সাহায্য\s+করতে\s+পারো"
    r")[\s!.,?।]*$",
    re.IGNORECASE,
)


def _match_courtesy_reply(
    query: str,
    documents: List[Dict[str, Any]],
    requested_lang: str,
    response_mode: str,
) -> Optional[Dict[str, Any]]:
    """Handles pure greetings, farewells, thanks, and capability questions without hallucination."""
    q = (query or "").strip()
    if not q:
        return None
    lang = detect_language(q, requested_lang)
    active_names = [d.get("name", "PDF") for d in documents if d.get("enabled", True)]
    docs_str = ", ".join(active_names[:4]) if active_names else ("কোনো ডকুমেন্ট নেই" if lang == "bn" else "no PDFs yet")

    if COURTESY_GREETING_RE.match(q):
        ans = (
            f"হ্যালো! আমি **Oiraboot AI Engine**। বর্তমানে আপনার **{docs_str}** ডকুমেন্টের ওপর ভিত্তি করে প্রশ্নের উত্তর, পেজ রেফারেন্সসহ ব্যাখ্যা এবং কুইজ তৈরিতে সাহায্য করতে পারি। ডকুমেন্টের ভেতরের যেকোনো প্রশ্ন করতে পারেন।"
            if lang == "bn"
            else f"Hello! I am the **Oiraboot AI Engine**. I can answer questions strictly from your active document(s) (**{docs_str}**) with page citations, summarize topics, and generate practice quizzes. Ask me anything covered in your notes!"
        )
    elif COURTESY_FAREWELL_RE.match(q):
        ans = (
            "বিদায়! পড়াশোনা বা ডকুমেন্ট নিয়ে আবার কোনো সাহায্যের প্রয়োজন হলে ফিরে আসবেন।"
            if lang == "bn"
            else "Goodbye! Feel free to come back anytime you need help studying your documents."
        )
    elif COURTESY_THANKS_RE.match(q):
        ans = (
            "আপনাকেও ধন্যবাদ! ডকুমেন্টের আর কোনো অংশ বুঝতে বা কুইজ অনুশীলন করতে চাইলে জানাবেন।"
            if lang == "bn"
            else "You're welcome! Let me know if you have any more questions about your active documents."
        )
    elif COURTESY_HELP_RE.match(q):
        ans = (
            f"আমি আপনার আপলোড করা PDF (**{docs_str}**) থেকে যাচাইকৃত সাহায্য করতে পারি:\n"
            "• **ডকুমেন্ট প্রশ্নোত্তর**: সরাসরি মূল পৃষ্ঠা নম্বর ও উদ্ধৃতিসহ নির্ভুল উত্তর।\n"
            "• **বিশ্লেষণ ও সারসংক্ষেপ**: জটিল অধ্যায় বা বিষয় সহজভাবে বোঝানো।\n"
            "• **কুইজ তৈরি**: অনুশীলনের জন্য ৫–১৫টি MCQ, True/False ও Matching কুইজ।\n\n"
            "তথ্যের শতভাগ নির্ভুলতা বজায় রাখতে আমি কেবল ডকুমেন্টের ভেতরের তথ্য থেকেই উত্তর দিই।"
            if lang == "bn"
            else f"I can assist you strictly using your active document(s) (**{docs_str}**):\n"
            "• **Grounded Q&A**: Answer questions with verbatim quotes and exact page citations.\n"
            "• **Structured Explanations**: Break down sections or summarize key concepts.\n"
            "• **Adaptive Quizzes**: Generate practice assessments directly from your notes.\n\n"
            "To maintain strict factual accuracy, I only answer questions whose evidence exists in your uploaded documents."
        )
    else:
        return None

    return {
        "found": True,
        "isCourtesy": True,
        "answer": ans,
        "sourceDoc": "",
        "pageNumber": 0,
        "excerpt": "",
        "citations": [],
        "mode": "courtesy",
        "responseMode": response_mode,
        "telemetry": {"totalChunks": 0, "retrievedChunks": 0, "usedEmbeddings": False, "retrievalMs": 0},
    }


def query_document_qa(
    query: str,
    documents: List[Dict[str, Any]],
    requested_lang: str = "auto",
    extensive: bool = False,
    response_mode: str = "thinking",
    history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Answers a question strictly grounded in the provided PDF documents.
    Supports:
    - response_mode='exact': pinpoint extracted answer only, zero extra words
    - response_mode='thinking': analytical, well-organized structured response from PDF context
    - extensive=True: multi-pass parallel analysis + independent raw-text cross-verification
    - history: recent turns for natural follow-up questions
    """
    mode = (response_mode or "thinking").strip().lower()
    if mode not in ("exact", "thinking"):
        mode = "thinking"

    courtesy = _match_courtesy_reply(query, documents, requested_lang, mode)
    if courtesy is not None:
        return courtesy

    if extensive:
        return extensive_query_qa(query, documents, requested_lang, response_mode=mode, history=history)

    lang = detect_language(query, requested_lang)
    idx_entry = get_or_build_document_index(documents)
    all_chunks = idx_entry["chunks"]
    pre_bm25 = idx_entry["bm25"]
    total_raw_chars = idx_entry["totalChars"]

    if not all_chunks:
        return {
            "found": False,
            "answer": "Not found in the document.",
            "sourceDoc": "", "pageNumber": 0, "excerpt": "", "citations": [],
            "mode": "no_documents", "responseMode": mode
        }

    retrieval_query = _build_retrieval_query(query, history)
    history_block = _format_history_block(history)
    q_lower = retrieval_query.lower()
    is_holistic = any(kw in q_lower for kw in HOLISTIC_KEYWORDS)
    is_analytical = is_holistic or any(kw in q_lower for kw in ANALYTICAL_KEYWORDS)

    client = get_gemini_client()
    groq_client = get_groq_client()
    mode_instruction = _build_mode_instruction(mode, lang)

    compact_book_digest = ""
    # Select optimal context strategy:
    # 1. Whole-book summary / chapter count on books (> 25k chars) -> outline + TOC + stratified full-book digest
    # 2. Small/medium docs (<= 45k chars) or analytical queries on <= 150k chars (~75-90 pages) -> full corpus
    # 3. Specific or multi-occurrence lookup on large books -> Page-diversified Hybrid BM25 + Embedding retrieval
    if is_holistic and total_raw_chars > 25000:
        corpus_text, compact_book_digest = _build_book_outline_and_digest(documents, max_chars=160000, compact_chars=12500)
        telemetry = {"totalChunks": len(all_chunks), "retrievedChunks": len(all_chunks), "usedEmbeddings": False, "retrievalMs": 0}
    elif total_raw_chars <= 45000 or (is_analytical and total_raw_chars <= 150000):
        corpus_text = _build_full_corpus(documents, max_chars=150000)
        telemetry = {"totalChunks": len(all_chunks), "retrievedChunks": len(all_chunks), "usedEmbeddings": False, "retrievalMs": 0}
    else:
        corpus_text, _, telemetry = hybrid_retrieve_chunks(
            all_chunks, retrieval_query, top_k=16, candidate_pool=55, max_per_page=2, precomputed_bm25=pre_bm25
        )

    # In Thinking Mode, use 120B analytical reasoning when the full context fits safely (<= 13.5k chars)
    if mode == "thinking" and groq_client and len(corpus_text) <= 13500:
        groq_thinking_prompt = f"""You are a strict, analytical Document Intelligence Assistant.
Answer ONLY using facts explicitly stated in the DOCUMENT TEXT below. Zero hallucination is mandatory.

{mode_instruction}

ANALYTICAL & MULTI-OCCURRENCE RULES:
- If the topic/fact appears in MULTIPLE pages/sections, synthesize ALL distinct occurrences in "answer" (grouped by context/page) and populate "citations" with each distinct page occurrence (up to 8 entries).
- For counting questions (how many, count, total, কতটি, কতগুলো, মোট):
  In "reasoning_steps", FIRST enumerate EVERY matching item one by one across ALL sections/pages before stating the total in "answer".

{history_block}DOCUMENT TEXT:
{corpus_text}

USER QUESTION: {query.strip()}

Respond ONLY with a valid JSON object (complete "reasoning_steps" FIRST):
{{
  "reasoning_steps": "step-by-step extraction, multi-page scan, and counting",
  "found": true or false,
  "answer": "well-structured, organized analytical answer strictly per RESPONSE MODE",
  "sourceDoc": "exact filename",
  "pageNumber": 1,
  "excerpt": "verbatim quote from primary supporting page",
  "citations": [
    {{"sourceDoc": "exact filename", "pageNumber": 1, "label": "short context label", "excerpt": "verbatim quote from that page"}}
  ]
}}
"""
        ok, data, _ = _run_groq_json(groq_client, groq_thinking_prompt, max_tokens=4096)
        if ok and isinstance(data, dict):
            return _format_qa_result(data, "ai_thinking", mode, telemetry)

    if client:
        result = _gemini_deep_qa(client, corpus_text, query, mode_instruction, "primary", history_block=history_block)
        if result.get("_model") != "none":
            return _format_qa_result(result, "analytical_full_doc" if is_analytical else "ai", mode, telemetry)

    # Automatic secondary AI fallback if primary models are temporarily unavailable
    if groq_client:
        groq_slice = compact_book_digest[:12500] if compact_book_digest else corpus_text[:12000]
        if not compact_book_digest and len(corpus_text) > 12000:
            focused, _, _ = hybrid_retrieve_chunks(
                all_chunks, retrieval_query, top_k=12, candidate_pool=35, max_per_page=2, precomputed_bm25=pre_bm25
            )
            if focused:
                groq_slice = focused[:12000]
        groq_prompt = f"""You are a strict, factual Document Intelligence Assistant.
Answer ONLY using facts explicitly stated in the DOCUMENT TEXT below. Zero hallucination is mandatory.

{mode_instruction}

{history_block}DOCUMENT TEXT:
{groq_slice}

USER QUESTION: {query.strip()}

Respond ONLY with a valid JSON object (complete "reasoning_steps" FIRST):
{{
  "reasoning_steps": "step-by-step extraction and counting",
  "found": true or false,
  "answer": "final answer formatted strictly per RESPONSE MODE",
  "sourceDoc": "exact filename",
  "pageNumber": 1,
  "excerpt": "verbatim quote from document",
  "citations": [
    {{"sourceDoc": "exact filename", "pageNumber": 1, "label": "short context label", "excerpt": "verbatim quote"}}
  ]
}}
"""
        ok, data, _ = _run_groq_json(groq_client, groq_prompt, max_tokens=4096)
        if ok and isinstance(data, dict):
            return _format_qa_result(data, "ai_secondary", mode, telemetry)

    return local_grounded_qa(query, all_chunks, lang, telemetry, response_mode=mode)


def local_grounded_qa(
    query: str,
    chunks: List[Dict[str, Any]],
    lang: str,
    telemetry: Optional[Dict[str, Any]] = None,
    response_mode: str = "thinking"
) -> Dict[str, Any]:
    """Deterministic lexical matcher fallback with Bengali/English digit normalization."""
    query_numbers = re.findall(r"[০-৯0-9]+", query.translate(BN_TO_EN))
    # Extract meaningful query words (3+ chars, not purely numeric)
    query_tokens = [w.lower() for w in re.findall(r"[\w\u0980-\u09FF]{3,}", query) if not w.isdigit()]

    if not query_numbers and not query_tokens:
        return {
            "found": False,
            "answer": "Not found in the document.",
            "sourceDoc": "",
            "pageNumber": 0,
            "excerpt": "",
            "mode": "local_refusal",
            "telemetry": telemetry or {}
        }

    best_score = 0
    best_chunk = None
    best_snippet = ""
    per_page_best: Dict[Tuple[str, int], Tuple[int, Dict[str, Any], str]] = {}

    for chunk in chunks:
        text = chunk["text"]
        # Score full chunk first to quickly find relevant pages
        chunk_en = text.translate(BN_TO_EN).lower()
        chunk_score = sum(5 for tok in query_tokens if tok in chunk_en)
        chunk_score += sum(50 for num in query_numbers if num in chunk_en)
        # Only do expensive line-by-line scan if chunk has any signal
        if chunk_score == 0 and not query_numbers:
            continue

        units = re.split(r"(?<=[.!?।\n])\s*", text)
        for unit in units:
            u_clean = unit.strip()
            if not u_clean or len(u_clean) < 8:
                continue
            u_en = u_clean.translate(BN_TO_EN).lower()
            score = 0

            for num in query_numbers:
                if num in u_en:
                    score += 50
                elif len(num) >= 4:
                    for i in range(len(num) - 3):
                        if num[i:i + 4] in u_en:
                            score += 15

            # Token matching: each matching word gives points, longer words give more
            for tok in query_tokens:
                if tok in u_en:
                    score += max(5, len(tok))  # longer keyword = more weight

            if score > best_score:
                best_score = score
                best_chunk = chunk
                best_snippet = u_clean

            p_key = (chunk["sourceDoc"], chunk["pageNumber"])
            if score > 0 and (p_key not in per_page_best or score > per_page_best[p_key][0]):
                per_page_best[p_key] = (score, chunk, u_clean)

    # Minimum threshold: at least one meaningful keyword match
    min_score = 5 if not query_numbers else 15
    if best_score >= min_score and best_chunk and best_snippet:
        top_pages = sorted(
            [v for v in per_page_best.values() if v[0] >= min_score],
            key=lambda x: x[0],
            reverse=True
        )[:6]
        citations = [
            {
                "sourceDoc": c["sourceDoc"],
                "pageNumber": c["pageNumber"],
                "label": f"Page {c['pageNumber']}",
                "excerpt": snip
            }
            for _, c, snip in top_pages
        ]
        citations.sort(key=lambda c: (c["sourceDoc"], c["pageNumber"]))

        if (response_mode or "").strip().lower() == "exact":
            ans = (
                "\n".join([f"- (Page {c['pageNumber']}) {c['excerpt']}" for c in citations])
                if len(citations) > 1
                else best_snippet
            )
        else:
            if len(citations) > 1:
                header = "ডকুমেন্টের একাধিক স্থানে তথ্যটি পাওয়া গেছে:" if lang == "bn" else f"Found across {len(citations)} pages in the document:"
                bullets = "\n".join([f"• **Page {c['pageNumber']}**: {c['excerpt']}" for c in citations])
                ans = f"{header}\n{bullets}"
            else:
                ans = (
                    f"ডকুমেন্ট অনুসারে: {best_snippet}"
                    if lang == "bn"
                    else f"According to the document: {best_snippet}"
                )
        return {
            "found": True,
            "answer": ans,
            "sourceDoc": best_chunk["sourceDoc"],
            "pageNumber": best_chunk["pageNumber"],
            "excerpt": best_snippet,
            "citations": citations,
            "mode": "local_fallback",
            "responseMode": response_mode,
            "telemetry": telemetry or {}
        }

    return {
        "found": False,
        "answer": "Not found in the document.",
        "sourceDoc": "",
        "pageNumber": 0,
        "excerpt": "",
        "citations": [],
        "mode": "local_refusal",
        "telemetry": telemetry or {}
    }


def _get_stratified_quiz_context(chunks: List[Dict[str, Any]], max_chars: int = 20000) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Selects chunks evenly across the entire document (beginning, middle, end)
    so quizzes on 50-100+ page PDFs cover the full breadth of material.
    """
    if not chunks:
        return "", []

    total = len(chunks)
    if sum(len(c["text"]) for c in chunks) <= max_chars:
        sampled = chunks
    else:
        step = max(1, total // 18)
        sampled = chunks[::step][:22]

    blocks = []
    curr_len = 0
    kept = []
    for c in sampled:
        block = f"[DOCUMENT: {c['sourceDoc']} | PAGE: {c['pageNumber']}]\n{c['text']}\n"
        if curr_len + len(block) <= max_chars or not blocks:
            blocks.append(block)
            curr_len += len(block)
            kept.append(c)

    return "\n".join(blocks), kept


def generate_document_quiz(
    documents: List[Dict[str, Any]],
    count: int = 5,
    difficulty: str = "Intermediate",
    quiz_type: str = "mixed",
    lang: str = "en",
    topic: str = ""
) -> List[Dict[str, Any]]:
    """
    Generates multi-format assessment questions strictly based on active PDF documents.
    Optionally focuses on a specific topic or chapter when `topic` is provided.
    Supported types:
    - 'mcq': 4 options, 1 correct index
    - 'true_false': factual statement with boolean truth value
    - 'matching': Column A items matched to Column B items (pairs)
    - 'mixed': Combination of MCQ, True/False, and Matching
    """
    safe_count = max(3, min(int(count), 12))
    quiz_type = str(quiz_type or "mixed").lower()
    clean_topic = str(topic or "").strip()

    idx_entry = get_or_build_document_index(documents)
    all_chunks = idx_entry["chunks"]
    pre_bm25 = idx_entry["bm25"]
    if not all_chunks:
        return []

    if clean_topic:
        focused_corpus, focused_chunks, _ = hybrid_retrieve_chunks(
            all_chunks, clean_topic, top_k=18, candidate_pool=50, max_per_page=2, precomputed_bm25=pre_bm25
        )
        if focused_chunks:
            corpus_text = focused_corpus[:24000]
            sampled_chunks = focused_chunks
        else:
            corpus_text, sampled_chunks = _get_stratified_quiz_context(all_chunks, max_chars=24000)
    else:
        corpus_text, sampled_chunks = _get_stratified_quiz_context(all_chunks, max_chars=24000)

    client = get_gemini_client()
    if client:
        lang_prompt = (
            "Create all questions, options, statements, and matching items in fluent Bengali (বাংলা). The explanationQuote MUST be copied verbatim from the document text."
            if lang == "bn"
            else "Create all questions, options, statements, and matching items in clear English. The explanationQuote MUST be copied verbatim from the document text."
        )
        topic_directive = f'\nTOPIC / CHAPTER FOCUS: Focus questions specifically around "{clean_topic}" using ONLY facts from the provided passages.' if clean_topic else ""

        type_instructions = ""
        if quiz_type == "mcq":
            type_instructions = f"Generate ALL {safe_count} questions as multiple-choice questions (type: 'mcq')."
        elif quiz_type == "true_false":
            type_instructions = f"Generate ALL {safe_count} questions as True/False questions (type: 'true_false'). Mix both True and False statements."
        elif quiz_type == "matching":
            type_instructions = f"Generate ALL {safe_count} questions as Column Matching questions (type: 'matching'). Each question has 3-4 distinct item pairs."
        else: # mixed / combination
            mcq_n = max(1, safe_count // 2)
            tf_n = max(1, (safe_count - mcq_n) // 2)
            match_n = max(1, safe_count - mcq_n - tf_n)
            type_instructions = f"""Generate a diverse COMBINATION of question types totaling exactly {safe_count} questions:
- Approximately {mcq_n} Multiple Choice Questions (type: 'mcq')
- Approximately {tf_n} True/False Questions (type: 'true_false')
- Approximately {match_n} Matching Column Questions (type: 'matching')"""

        prompt = f"""You are an expert academic assessment designer.
Generate exactly {safe_count} rigorous comprehension questions strictly based on the provided PDF chunks.
DIFFICULTY LEVEL: {difficulty}{topic_directive}
LANGUAGE: {lang_prompt}
QUESTION TYPES REQUIRED:
{type_instructions}

DOCUMENT CHUNKS:
{corpus_text}

SCHEMA SPECIFICATIONS FOR EACH QUESTION TYPE:

1. For MCQ (type: "mcq"):
{{
  "type": "mcq",
  "question": "Clear question text?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "pageNumber": 1,
  "sourceDoc": "exact filename",
  "explanationQuote": "verbatim text from chunk proving answer"
}}

2. For True/False (type: "true_false"):
{{
  "type": "true_false",
  "statement": "Factual claim evaluated against the document",
  "isTrue": true or false,
  "options": ["True", "False"],
  "correctIndex": 0 if true else 1,
  "pageNumber": 1,
  "sourceDoc": "exact filename",
  "explanationQuote": "verbatim quote proving truth or falsity"
}}

3. For Matching (type: "matching"):
{{
  "type": "matching",
  "instruction": "Match each concept/course/item from Column A with Column B",
  "pairs": [
    {{"left": "Item A1", "right": "Matching definition or value B1"}},
    {{"left": "Item A2", "right": "Matching definition or value B2"}},
    {{"left": "Item A3", "right": "Matching definition or value B3"}}
  ],
  "pageNumber": 1,
  "sourceDoc": "exact filename",
  "explanationQuote": "verbatim quote proving the pairings"
}}

Respond ONLY with a valid JSON array of question objects adhering strictly to the above schemas:
[
  ...
]
"""
        success, text = run_gemini_with_fallback(client, prompt, schema_type="json")
        if success:
            try:
                questions = _parse_json_response(text)
                if isinstance(questions, list) and len(questions) >= 1:
                    validated = []
                    for q in questions[:safe_count]:
                        q_type = str(q.get("type", "mcq")).lower()
                        source_doc = str(q.get("sourceDoc", "Document")).strip()
                        page_num = _safe_page_num(q.get("pageNumber"), 1)
                        proof = str(q.get("explanationQuote", "")).strip()

                        if q_type == "true_false":
                            is_true = bool(q.get("isTrue", True))
                            statement = str(q.get("statement") or q.get("question") or "").strip()
                            if statement:
                                tf_options = ["সত্য (True)", "মিথ্যা (False)"] if lang == "bn" else ["True", "False"]
                                validated.append({
                                    "type": "true_false",
                                    "question": statement,
                                    "statement": statement,
                                    "options": tf_options,
                                    "isTrue": is_true,
                                    "correctIndex": 0 if is_true else 1,
                                    "pageNumber": page_num,
                                    "sourceDoc": source_doc,
                                    "explanationQuote": proof
                                })

                        elif q_type == "matching":
                            pairs = q.get("pairs", [])
                            if isinstance(pairs, list) and len(pairs) >= 2:
                                clean_pairs = [
                                    {"left": str(p.get("left", "")).strip(), "right": str(p.get("right", "")).strip()}
                                    for p in pairs if p.get("left") and p.get("right")
                                ]
                                if len(clean_pairs) >= 2:
                                    validated.append({
                                        "type": "matching",
                                        "question": str(q.get("instruction") or q.get("question") or "Match Column A with Column B:").strip(),
                                        "pairs": clean_pairs,
                                        "pageNumber": page_num,
                                        "sourceDoc": source_doc,
                                        "explanationQuote": proof
                                    })

                        else:  # mcq
                            options = q.get("options", [])
                            q_text = str(q.get("question", "")).strip()
                            if len(options) == 4 and q_text:
                                c_idx = int(q.get("correctIndex", 0))
                                validated.append({
                                    "type": "mcq",
                                    "question": q_text,
                                    "options": [str(opt).strip() for opt in options],
                                    "correctIndex": max(0, min(3, c_idx)),
                                    "pageNumber": page_num,
                                    "sourceDoc": source_doc,
                                    "explanationQuote": proof
                                })

                    if len(validated) >= 2:
                        return validated
            except Exception as e:
                print(f"[Quiz Generation JSON parse warning]: {e}")

    # Secondary Groq quiz fallback if primary Gemini models hit quota/503
    groq_client = get_groq_client()
    if groq_client:
        try:
            for model_name in GROQ_VERIFY_MODELS:
                try:
                    comp = groq_client.chat.completions.create(
                        model=model_name,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.2,
                        max_tokens=4096,
                    )
                    raw_q = (comp.choices[0].message.content or "").strip()
                    questions = _parse_json_response(raw_q)
                    if isinstance(questions, list) and len(questions) >= 2:
                        validated = []
                        for q in questions[:safe_count]:
                            q_type = str(q.get("type", "mcq")).lower()
                            source_doc = str(q.get("sourceDoc", "Document")).strip()
                            page_num = _safe_page_num(q.get("pageNumber"), 1)
                            proof = str(q.get("explanationQuote", "")).strip()
                            if q_type == "true_false":
                                is_true = bool(q.get("isTrue", True))
                                st = str(q.get("statement") or q.get("question") or "").strip()
                                if st:
                                    validated.append({
                                        "type": "true_false", "question": st, "statement": st,
                                        "options": ["সত্য (True)", "মিথ্যা (False)"] if lang == "bn" else ["True", "False"],
                                        "isTrue": is_true, "correctIndex": 0 if is_true else 1,
                                        "pageNumber": page_num, "sourceDoc": source_doc, "explanationQuote": proof
                                    })
                            elif q_type == "matching" and isinstance(q.get("pairs"), list) and len(q["pairs"]) >= 2:
                                clean_pairs = [{"left": str(p.get("left", "")).strip(), "right": str(p.get("right", "")).strip()} for p in q["pairs"] if p.get("left") and p.get("right")]
                                if len(clean_pairs) >= 2:
                                    validated.append({
                                        "type": "matching",
                                        "question": str(q.get("instruction") or q.get("question") or "Match Column A with Column B:").strip(),
                                        "pairs": clean_pairs, "pageNumber": page_num, "sourceDoc": source_doc, "explanationQuote": proof
                                    })
                            else:
                                opts = q.get("options", [])
                                qt = str(q.get("question", "")).strip()
                                if len(opts) == 4 and qt:
                                    validated.append({
                                        "type": "mcq", "question": qt, "options": [str(o).strip() for o in opts],
                                        "correctIndex": max(0, min(3, int(q.get("correctIndex") or 0))),
                                        "pageNumber": page_num, "sourceDoc": source_doc, "explanationQuote": proof
                                    })
                        if len(validated) >= 2:
                            print(f"[Groq Quiz OK via {model_name}]")
                            return validated
                except Exception as ge:
                    print(f"[Groq Quiz {model_name} failed]: {ge}")
                    continue
        except Exception:
            pass

    return generate_local_quiz(sampled_chunks or all_chunks, safe_count, difficulty, quiz_type, lang)


def generate_local_quiz(
    chunks: List[Dict[str, Any]],
    count: int = 5,
    difficulty: str = "Intermediate",
    quiz_type: str = "mixed",
    lang: str = "en"
) -> List[Dict[str, Any]]:
    """Deterministic multi-format fallback quiz generator directly from PDF document chunks."""
    import random
    valid_sentences = []
    for item in chunks:
        sents = re.split(r"(?<=[.!?।\n])\s*", item["text"])
        for s in sents:
            cleaned = s.strip()
            if len(cleaned) > 30 and not cleaned.startswith("CS301 Lecture Notes"):
                valid_sentences.append({
                    "sentence": cleaned,
                    "sourceDoc": item["sourceDoc"],
                    "pageNumber": item["pageNumber"]
                })

    if not valid_sentences:
        return []

    sampled = valid_sentences[:count * 2] if len(valid_sentences) <= count * 2 else random.sample(valid_sentences, min(len(valid_sentences), count * 2))
    questions: List[Dict[str, Any]] = []

    quiz_type = str(quiz_type or "mixed").lower()

    for idx in range(count):
        item = sampled[idx % len(sampled)]
        sent = item["sentence"]
        source_doc = item["sourceDoc"]
        page_num = item["pageNumber"]

        # Determine type for this question slot
        if quiz_type == "mcq":
            slot_type = "mcq"
        elif quiz_type == "true_false":
            slot_type = "true_false"
        elif quiz_type == "matching":
            slot_type = "matching"
        else: # mixed
            if idx % 3 == 0:
                slot_type = "mcq"
            elif idx % 3 == 1:
                slot_type = "true_false"
            else:
                slot_type = "matching"

        if slot_type == "true_false":
            is_true = (idx % 2 == 0)
            if is_true:
                statement = sent
            else:
                statement = (
                    f"{sent} — (এই বিবৃতিটি নথির মূল তথ্যের পরিপন্থী ও অসত্য)।"
                    if lang == "bn"
                    else f"It is established that: contrary to documented facts, {sent.lower()} does not apply."
                )
            tf_options = ["সত্য (True)", "মিথ্যা (False)"] if lang == "bn" else ["True", "False"]
            questions.append({
                "type": "true_false",
                "question": statement,
                "statement": statement,
                "options": tf_options,
                "isTrue": is_true,
                "correctIndex": 0 if is_true else 1,
                "pageNumber": page_num,
                "sourceDoc": source_doc,
                "explanationQuote": sent
            })

        elif slot_type == "matching":
            # Extract 3 meaningful clauses or phrases
            words = [w for w in re.split(r"[\s,:;\-]+", sent) if len(w) > 3]
            pairs = []
            if len(words) >= 6:
                pairs = [
                    {"left": words[0] + " " + words[1], "right": "Relates to " + words[2]},
                    {"left": words[3] + " " + words[4], "right": "Characteristic of " + words[5]},
                    {"left": f"Source Section (P.{page_num})", "right": f"Grounded in {source_doc}"}
                ]
            else:
                pairs = [
                    {"left": f"Concept A ({source_doc})", "right": sent[:35] + "..."},
                    {"left": f"Citation Anchor", "right": f"Page {page_num}"},
                    {"left": "Grounding Rule", "right": "Verified from document notes"}
                ]
            questions.append({
                "type": "matching",
                "question": f"ডকুমেন্ট অনুসারে বাম ও ডান কলামের বিষয়গুলো মিলান (Page {page_num}):" if lang == "bn" else f"Match the items in Column A with their definitions in Column B (Page {page_num}):",
                "pairs": pairs,
                "pageNumber": page_num,
                "sourceDoc": source_doc,
                "explanationQuote": sent
            })

        else: # mcq
            if lang == "bn":
                q_text = f"নিচের কোন তথ্যটি {source_doc}-এর পৃষ্ঠা {page_num}-এ সত্য বলে প্রমাণিত?"
                opt_correct = sent
                d1 = "এই তথ্যটি নথির পরিপন্থী এবং অপ্রাসঙ্গিক।"
                d2 = "মডেলের সাধারণীকরণের সাথে এর কোনো সম্পর্ক নেই।"
                d3 = "এটি বাহ্যিক ডোমেইন সম্পর্কিত এবং ডকুমেন্টে নেই।"
            else:
                q_text = f"Which of the following statements is directly supported by {source_doc} (Page {page_num})?"
                opt_correct = sent
                d1 = "This claim contradicts the findings outlined in the provided documentation."
                d2 = "The system relies exclusively on external parameters without document grounding."
                d3 = "This observation has been invalidated by baseline classification benchmarks."

            options = [opt_correct, d1, d2, d3]
            correct_idx = idx % 4
            options[0], options[correct_idx] = options[correct_idx], options[0]

            questions.append({
                "type": "mcq",
                "question": q_text,
                "options": options,
                "correctIndex": correct_idx,
                "pageNumber": page_num,
                "sourceDoc": source_doc,
                "explanationQuote": sent
            })

    return questions
