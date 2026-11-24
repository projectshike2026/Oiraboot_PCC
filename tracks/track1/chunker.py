import re
from typing import List, Dict, Any
from core.textutil import tokenise

def chunk_document(doc_id: int, pages_data: List[Dict[str, Any]], db):
    """
    Chunks pages strictly within page boundaries.
    Target chunk size: ~800 characters, ~120 characters overlap.
    Never merges across pages to guarantee page-level citation fidelity.
    """
    for page in pages_data:
        page_no = page["page_no"]
        text = page["text"]
        if not text.strip():
            continue

        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not paragraphs:
            paragraphs = [text.strip()]

        chunks = []
        current_chunk = ""
        last_overlap = ""

        for para in paragraphs:
            if not current_chunk:
                current_chunk = (last_overlap + " " + para).strip() if last_overlap else para
            elif len(current_chunk) + len(para) + 1 <= 800:
                current_chunk += "\n\n" + para
            else:
                chunks.append(current_chunk)
                # Compute overlap of ~120 chars from the tail of the current chunk
                words = current_chunk.split()
                overlap_words = []
                acc = 0
                for w in reversed(words):
                    acc += len(w) + 1
                    overlap_words.insert(0, w)
                    if acc >= 120:
                        break
                last_overlap = " ".join(overlap_words)
                current_chunk = (last_overlap + " " + para).strip()

        if current_chunk:
            chunks.append(current_chunk)

        # Insert chunks
        for idx, chunk_text in enumerate(chunks):
            chunk_id = f"d{doc_id}p{page_no}c{idx + 1}"
            toks = tokenise(chunk_text)
            toks_str = " ".join(toks)
            db.execute("""
            INSERT OR REPLACE INTO chunks (doc_id, chunk_id, page_no, idx, text, tokens)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (doc_id, chunk_id, page_no, idx + 1, chunk_text, toks_str))
