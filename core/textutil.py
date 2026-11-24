import re
import unicodedata
import math
import difflib
from typing import List, Dict, Any, Optional

EN_STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
    "by", "can", "did", "do", "does", "doing", "don", "down", "during", "each", "few", "for",
    "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
    "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once",
    "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until",
    "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
    "why", "with", "would", "you", "your", "yours", "yourself", "yourselves"
}

BN_STOPWORDS = {
    "এই", "একটি", "এবং", "বা", "কিন্তু", "যদি", "তবে", "হতে", "থেকে", "দ্বারা", "দিয়ে",
    "জন্য", "পর", "পূর্বে", "আগে", "পরে", "কী", "কেন", "কীভাবে", "কোথায়", "কে", "কার",
    "কোন", "ছিল", "আছে", "হয়", "হবে", "হলো", "না", "নয়", "করে", "করা", "করতে", "এর", "দের"
}

STOPWORDS = EN_STOPWORDS | BN_STOPWORDS

def normalise(text: str) -> str:
    """Normalize Unicode to NFC, collapse whitespace, and strip."""
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    # De-hyphenate line breaks like 'over-\nfitting' -> 'overfitting'
    text = re.sub(r'(\w+)-\s*\n\s*([a-z\u0980-\u09FF]\w+)', r'\1\2', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n\n', text)
    return text.strip()

def tokenise(text: str) -> List[str]:
    """Tokenize text preserving Latin and Bengali words; remove stopwords and short tokens."""
    if not text:
        return []
    norm = unicodedata.normalize("NFC", text).lower()
    # Split on non-word characters while preserving Bengali Unicode block U+0980-U+09FF
    tokens = re.findall(r'[a-z0-9\u0980-\u09FF]+', norm)
    return [tok for tok in tokens if len(tok) >= 2 and tok not in STOPWORDS]

def detect_lang(text: str) -> str:
    """Detect if text is primarily Bengali or English."""
    if not text:
        return "en"
    bengali_chars = len(re.findall(r'[\u0980-\u09FF]', text))
    total_letters = len(re.findall(r'[a-zA-Z\u0980-\u09FF]', text))
    if total_letters > 0 and (bengali_chars / total_letters) >= 0.3:
        return "bn"
    return "en"

def bm25(query_tokens: List[str], chunks: List[Dict[str, Any]], k1: float = 1.5, b: float = 0.75) -> List[Dict[str, Any]]:
    """
    Pure Python BM25 ranking algorithm.
    chunks: list of dicts with 'chunk_id', 'text', 'tokens' (list or space-separated string).
    Returns chunks sorted with added 'bm25_score' field.
    """
    if not query_tokens or not chunks:
        return chunks

    N = len(chunks)
    chunk_tokens_list = []
    doc_lens = []

    for c in chunks:
        toks = c.get("tokens")
        if isinstance(toks, str):
            toks = toks.split()
        elif not isinstance(toks, list):
            toks = tokenise(c.get("text", ""))
        chunk_tokens_list.append(toks)
        doc_lens.append(len(toks))

    avgdl = sum(doc_lens) / max(1, N)

    # Document frequency per term
    df: Dict[str, int] = {}
    for toks in chunk_tokens_list:
        unique_toks = set(toks)
        for q in query_tokens:
            if q in unique_toks:
                df[q] = df.get(q, 0) + 1

    scored = []
    for idx, c in enumerate(chunks):
        toks = chunk_tokens_list[idx]
        dl = doc_lens[idx]
        score = 0.0

        # Term frequencies in this document
        tf: Dict[str, int] = {}
        for t in toks:
            tf[t] = tf.get(t, 0) + 1

        for q in query_tokens:
            f = tf.get(q, 0)
            if f > 0:
                n_q = df.get(q, 0)
                idf = math.log(1.0 + (N - n_q + 0.5) / (n_q + 0.5))
                denom = f + k1 * (1.0 - b + b * (dl / max(1.0, avgdl)))
                score += idf * ((f * (k1 + 1.0)) / max(0.0001, denom))

        c_copy = dict(c)
        c_copy["bm25_score"] = round(score, 4)
        scored.append(c_copy)

    scored.sort(key=lambda x: x["bm25_score"], reverse=True)
    return scored

def verify_quote(quote: str, chunk_text: str) -> Optional[str]:
    """
    Server-side verification of a citation quote against source chunk text.
    Returns the exact verified passage or None if rejected.
    """
    if not quote or not chunk_text:
        return None

    def clean_for_match(s: str) -> str:
        s = unicodedata.normalize("NFC", s).casefold()
        s = re.sub(r'[^\w\s\u0980-\u09FF]', ' ', s)
        return re.sub(r'\s+', ' ', s).strip()

    clean_quote = clean_for_match(quote)
    clean_chunk = clean_for_match(chunk_text)

    if not clean_quote:
        return None

    # 1. Exact substring match in cleaned text
    if clean_quote in clean_chunk:
        # Try to return the original case-preserved segment from chunk_text
        pos = chunk_text.lower().find(quote.lower()[:min(len(quote), 20)])
        if pos != -1:
            return chunk_text[pos:pos + len(quote) + 15].strip(' ,.;:-"\'')
        return quote.strip()

    # 2. Fuzzy sentence match with SequenceMatcher
    sentences = re.split(r'(?<=[.!?।\n])\s+', chunk_text)
    best_sent = None
    best_ratio = 0.0

    for sent in sentences:
        clean_sent = clean_for_match(sent)
        if not clean_sent:
            continue
        ratio = difflib.SequenceMatcher(None, clean_quote, clean_sent).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_sent = sent.strip()

    if best_ratio >= 0.85 and best_sent:
        return best_sent

    return None
