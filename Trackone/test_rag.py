"""
Quick end-to-end test for the RAG engine.
Tests: voter list NID lookup, Optophone query, strict refusal.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rag_engine import extract_text_from_pdf_stream, query_document_qa, chunk_documents

UPLOADS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

def load_doc(filename, doc_id):
    path = os.path.join(UPLOADS, filename)
    if not os.path.exists(path):
        print(f"  [SKIP] {filename} not found in uploads/")
        return None
    pages = extract_text_from_pdf_stream(path, filename)
    print(f"  Loaded {filename}: {len(pages)} pages")
    return {"id": doc_id, "name": filename, "enabled": True, "pages": pages}


def run_tests():
    print("=" * 60)
    print("RAG ENGINE END-TO-END TEST")
    print("=" * 60)

    # --- Test 1: Voter list NID lookup ---
    print("\n[TEST 1] Voter list NID lookup")
    voter_doc = load_doc("25b1726c_BANGLADESH_VOTER_LIST_2026.pdf", "voter")
    if voter_doc:
        result = query_document_qa("tell me the age of nid number: ২৮৬১০৩২৭৬৭", [voter_doc])
        print(f"  found={result['found']}, page={result['pageNumber']}, mode={result.get('mode','?')}")
        print(f"  answer={result['answer'][:200]}")
        assert result["found"], "FAIL: should find NID ২৮৬১০৩২৭৬৭"
        print("  PASS ✅")

    # --- Test 2: Strict refusal (FIFA World Cup not in voter list) ---
    print("\n[TEST 2] Strict refusal test")
    if voter_doc:
        result = query_document_qa("Who won the FIFA World Cup 2022?", [voter_doc])
        print(f"  found={result['found']}, mode={result.get('mode','?')}")
        assert not result["found"], "FAIL: should refuse FIFA World Cup question"
        print("  PASS ✅")

    # --- Test 3: OCR Basic Oonori PDF (Optophone) ---
    print("\n[TEST 3] OCR Basic Oonori - Optophone query")
    ocr_doc = load_doc("OCR_BASIC_OONORI.pdf", "ocr") or load_doc("OCR BASIC OONORI.pdf", "ocr")
    if ocr_doc:
        result = query_document_qa("Optophone ki??", [ocr_doc])
        print(f"  found={result['found']}, page={result['pageNumber']}, mode={result.get('mode','?')}")
        print(f"  answer={result['answer'][:200]}")
        assert result["found"], "FAIL: Optophone should be found in OCR document"
        print("  PASS ✅")
    else:
        # Try to find any OCR PDF
        ocr_files = [f for f in os.listdir(UPLOADS) if "ocr" in f.lower() or "oonori" in f.lower()]
        if ocr_files:
            ocr_doc = load_doc(ocr_files[0], "ocr")
            if ocr_doc:
                result = query_document_qa("Optophone ki??", [ocr_doc])
                print(f"  found={result['found']}, page={result['pageNumber']}, mode={result.get('mode','?')}")
                print(f"  answer={result['answer'][:200]}")

    # --- Test 4: Problem statement PDF ---
    print("\n[TEST 4] Problem statement - Track 1 requirements")
    ps_doc = load_doc("ea83e700_problem-statement-e3fb21da4b4a.pdf", "ps")
    if ps_doc:
        result = query_document_qa("What are the must-have requirements for Track 1?", [ps_doc])
        print(f"  found={result['found']}, page={result['pageNumber']}, mode={result.get('mode','?')}")
        print(f"  answer={result['answer'][:300]}")
        print("  (manual check - should contain Track 1 requirements)")

    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
