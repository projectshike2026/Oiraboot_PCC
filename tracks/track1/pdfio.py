import time
import re
from pathlib import Path
import pymupdf  # PyMuPDF
from config import Config
from core.errors import AppError
from core.textutil import normalise
from tracks.track1.chunker import chunk_document

def extract_pdf(file_bytes: bytes, stored_name: str, filename: str, sid: str, db) -> dict:
    """
    Extracts text per page from a PDF binary using PyMuPDF.
    Validates page count, text quality, inserts records into documents, pages, and chunks.
    """
    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        raise AppError("parse_failed", f"Failed to open PDF: {str(e)}", 400)

    page_count = len(doc)
    if page_count == 0:
        doc.close()
        raise AppError("no_text", "The uploaded PDF contains zero pages.", 400)

    if page_count > Config.MAX_PDF_PAGES:
        doc.close()
        raise AppError("too_many_pages", f"Document exceeds {Config.MAX_PDF_PAGES} page limit (has {page_count}).", 400)

    pages_data = []
    total_chars = 0
    warnings = []

    for page_idx in range(page_count):
        page_no = page_idx + 1
        page = doc[page_idx]
        raw_text = page.get_text("text") or ""
        clean_text = normalise(raw_text)
        total_chars += len(clean_text)
        pages_data.append({"page_no": page_no, "text": clean_text})

    doc.close()

    # Quality Gate 1: Check if average chars per page < 80 (likely scanned or empty)
    avg_chars = total_chars / max(1, page_count)
    if avg_chars < 80 and total_chars < 200:
        raise AppError("no_text", "No readable text found in this PDF (likely a scanned image).", 400)

    # Quality Gate 2: Check for garbled legacy Bengali fonts or corrupt characters
    if total_chars > 0:
        non_space = re.sub(r'\s+', '', "".join(p["text"] for p in pages_data))
        valid_chars = len(re.findall(r'[a-zA-Z0-9\u0980-\u09FF.,!?;:\'"()\-\–—%/\\]', non_space))
        invalid_ratio = (len(non_space) - valid_chars) / max(1, len(non_space))
        if invalid_ratio > 0.35:
            warnings.append("Some text may not have extracted cleanly. Legacy font encoding detected.")

    # Save physical file to uploads directory
    uploads_dir = Path(Config.UPLOAD_FOLDER)
    uploads_dir.mkdir(parents=True, exist_ok=True)
    file_path = uploads_dir / stored_name
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    now = time.strftime("%Y-%m-%d %H:%M:%S")
    cursor = db.execute("""
    INSERT INTO documents (sid, filename, stored_name, page_count, char_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (sid, filename, stored_name, page_count, total_chars, now))
    doc_id = cursor.lastrowid

    # Insert pages
    for p in pages_data:
        db.execute("""
        INSERT INTO pages (doc_id, page_no, text)
        VALUES (?, ?, ?)
        """, (doc_id, p["page_no"], p["text"]))

    # Chunk the document
    chunk_document(doc_id, pages_data, db)
    db.commit()

    return {
        "id": doc_id,
        "filename": filename,
        "pages": page_count,
        "chars": total_chars,
        "warnings": warnings
    }
