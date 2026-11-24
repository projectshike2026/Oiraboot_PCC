import pytest
from core.textutil import normalise, tokenise, detect_lang, bm25, verify_quote

def test_normalise():
    raw = "CS301  Lecture\t\tNotes:\n\nFoundations   of AI"
    assert normalise(raw) == "CS301 Lecture Notes:\n\nFoundations of AI"

def test_tokenise_english():
    text = "Retrieval-Augmented Generation is a hybrid architecture."
    toks = tokenise(text)
    assert "retrieval" in toks
    assert "augmented" in toks
    assert "generation" in toks
    assert "is" not in toks  # Stopword removed
    assert "a" not in toks   # Short / stopword removed

def test_tokenise_bangla():
    text = "ওভারফিটিং রোধ করতে ড্রপআউট ব্যবহার করা হয়।"
    toks = tokenise(text)
    assert "ওভারফিটিং" in toks
    assert "ড্রপআউট" in toks
    assert "ব্যবহার" in toks
    assert "হয়" not in toks  # Stopword removed

def test_detect_lang():
    assert detect_lang("What is the fee for BBA?") == "en"
    assert detect_lang("ভর্তির যোগ্যতা ও শেষ তারিখ কবে?") == "bn"
    assert detect_lang("Hello world! ওভারফিটিং কী?") == "bn"

def test_bm25_ranking():
    chunks = [
        {"chunk_id": "c1", "text": "Transformer architecture uses self-attention mechanisms.", "tokens": ["transformer", "architecture", "self", "attention"]},
        {"chunk_id": "c2", "text": "Overfitting happens when training loss is very low.", "tokens": ["overfitting", "training", "loss"]},
        {"chunk_id": "c3", "text": "F1 score is the harmonic mean of precision and recall.", "tokens": ["f1", "score", "harmonic", "mean", "precision", "recall"]}
    ]
    query_tokens = ["attention", "transformer"]
    scored = bm25(query_tokens, chunks)
    assert scored[0]["chunk_id"] == "c1"
    assert scored[0]["bm25_score"] > scored[1]["bm25_score"]

def test_verify_quote_exact():
    chunk = "Retrieval-Augmented Generation (RAG) is a hybrid architecture that combines an information retrieval system with a Large Language Model."
    quote = "RAG is a hybrid architecture that combines an information retrieval system"
    result = verify_quote(quote, chunk)
    assert result is not None
    assert "hybrid architecture" in result

def test_verify_quote_fuzzy():
    chunk = "The Scaled Dot-Product Attention formula is Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V."
    quote = "Scaled Dot-Product Attention formula is softmax((Q * K^T) / sqrt(d_k)) * V"
    result = verify_quote(quote, chunk)
    assert result is not None
    assert "Attention" in result

def test_verify_quote_rejected():
    chunk = "Accuracy can be misleading on imbalanced datasets."
    quote = "The President was elected in November by a wide margin."
    assert verify_quote(quote, chunk) is None
