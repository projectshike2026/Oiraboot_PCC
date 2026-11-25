"""
app.py - Flask Web Application for Document Intelligence & Semantic Search (RAG)
PCIU Computer Club Beginner AI Hackathon - Track 1: Chat & Quiz with Your PDF.
"""

import os
import uuid
import json
from datetime import datetime
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
    send_file,
    Response,
    make_response
)
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment
load_dotenv()

from rag_engine import (
    extract_text_from_pdf_stream,
    extract_pdf_with_meta,
    extract_book_outline,
    get_or_build_document_index,
    query_document_qa,
    generate_document_quiz
)
from seed_data import (
    DEFAULT_SAMPLE_DOC,
    SAMPLE_PROMPTS,
    ensure_sample_pdf_file
)

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "trackone-oiraboot-oonori-secret-2026")
app.config["SESSION_COOKIE_NAME"] = "trackone_session"
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
SESSIONS_FOLDER = os.path.join(UPLOAD_FOLDER, ".sessions")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(SESSIONS_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 250 * 1024 * 1024  # 250MB max upload for full books

# In-memory document storage backed by disk session cache so uploads survive server restarts
SESSION_DOC_STORE = {}

# Ensure the sample PDF exists on disk
ensure_sample_pdf_file(UPLOAD_FOLDER)


@app.errorhandler(413)
def request_entity_too_large(_err):
    return jsonify({
        "ok": False,
        "error": "Uploaded PDF exceeds the 250MB limit."
    }), 413


def _session_file_path(uid: str) -> str:
    safe_uid = "".join(c for c in uid if c.isalnum() or c in "-_")
    return os.path.join(SESSIONS_FOLDER, f"{safe_uid}.json")


def _save_user_session(uid: str, docs: list) -> None:
    try:
        with open(_session_file_path(uid), "w", encoding="utf-8") as f:
            json.dump(docs, f, ensure_ascii=False)
    except Exception as exc:
        print(f"[Session Save Warning]: {exc}")


def get_user_session_id() -> str:
    """Returns or initializes a unique session identifier for the client."""
    if "uid" not in session:
        session["uid"] = str(uuid.uuid4())
    return session["uid"]


def get_user_documents() -> list:
    """Retrieves the list of PDF documents for the current user session (with disk restore)."""
    uid = get_user_session_id()
    if uid not in SESSION_DOC_STORE:
        path = _session_file_path(uid)
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                if isinstance(loaded, list):
                    SESSION_DOC_STORE[uid] = loaded
                    return SESSION_DOC_STORE[uid]
            except Exception as exc:
                print(f"[Session Load Warning]: {exc}")
        import copy
        SESSION_DOC_STORE[uid] = [copy.deepcopy(DEFAULT_SAMPLE_DOC)]
        _save_user_session(uid, SESSION_DOC_STORE[uid])
    return SESSION_DOC_STORE[uid]


@app.route("/")
def index():
    """Main application landing page with Chat, Quiz Studio, and Page Reader."""
    docs = get_user_documents()
    active_count = sum(1 for d in docs if d.get("enabled", True))
    total_pages = sum(len(d.get("pages", [])) for d in docs if d.get("enabled", True))

    return render_template(
        "index.html",
        documents=docs,
        active_doc_count=active_count,
        total_pages=total_pages,
        sample_prompts=SAMPLE_PROMPTS,
        current_year=2026
    )


@app.route("/api/documents", methods=["GET"])
def api_get_documents():
    """Returns metadata for all documents in the active session."""
    docs = get_user_documents()
    summaries = []
    for d in docs:
        pages = d.get("pages", [])
        total_words = d.get("totalWords") or sum(len(p.get("text", "").split()) for p in pages)
        summaries.append({
            "id": d["id"],
            "name": d["name"],
            "enabled": d.get("enabled", True),
            "totalPages": d.get("physicalPages") or len(pages),
            "extractedPages": len(pages),
            "totalWords": total_words,
            "preview": pages[0]["text"][:160] + "..." if pages else ""
        })
    return jsonify({"ok": True, "documents": summaries})


@app.route("/api/upload", methods=["POST"])
def api_upload_pdf():
    """
    Handles single or multiple PDF file uploads, extracts per-page text,
    and indexes them into the active vault.
    """
    uploaded_files = request.files.getlist("pdf_files")
    if not uploaded_files or (len(uploaded_files) == 1 and uploaded_files[0].filename == ""):
        # Check single file parameter fallback
        if "file" in request.files:
            uploaded_files = [request.files["file"]]

    if not uploaded_files or (len(uploaded_files) == 1 and uploaded_files[0].filename == ""):
        return jsonify({"ok": False, "error": "No PDF files selected for upload."}), 400

    docs = get_user_documents()
    newly_added = []
    failed_files = []

    for file_obj in uploaded_files:
        filename = secure_filename(file_obj.filename)
        if not filename.lower().endswith(".pdf"):
            failed_files.append({"filename": filename, "reason": "Not a valid PDF file"})
            continue

        try:
            # Save file to disk
            saved_path = os.path.join(app.config["UPLOAD_FOLDER"], f"{uuid.uuid4().hex[:8]}_{filename}")
            file_obj.save(saved_path)

            # Extract per-page text (with automatic Vision OCR fallback for scanned PDFs)
            pages, physical_pages = extract_pdf_with_meta(saved_path, filename=filename)
            if not pages:
                failed_files.append({"filename": filename, "reason": "Could not extract readable text from this PDF."})
                continue

            total_words = sum(len(p.get("text", "").split()) for p in pages)
            display_pages = max(physical_pages, len(pages))

            doc_entry = {
                "id": f"doc-{uuid.uuid4().hex[:8]}",
                "name": filename,
                "enabled": True,
                "pages": pages,
                "totalPages": display_pages,
                "physicalPages": display_pages,
                "extractedPages": len(pages),
                "totalWords": total_words,
                "filePath": saved_path
            }
            docs.append(doc_entry)
            newly_added.append({
                "id": doc_entry["id"],
                "name": doc_entry["name"],
                "totalPages": display_pages,
                "extractedPages": len(pages),
                "totalWords": total_words
            })
        except Exception as e:
            failed_files.append({"filename": filename, "reason": str(e)})

    if newly_added:
        _save_user_session(get_user_session_id(), docs)
        try:
            get_or_build_document_index(docs)
        except Exception:
            pass

    return jsonify({
        "ok": True,
        "added": newly_added,
        "failed": failed_files,
        "totalActive": sum(1 for d in docs if d.get("enabled", True))
    })


@app.route("/api/documents/toggle", methods=["POST"])
def api_toggle_document():
    """Toggles active/inactive state of a specific document for workspace filtering."""
    data = request.get_json() or {}
    doc_id = data.get("id")
    enabled = bool(data.get("enabled", True))

    docs = get_user_documents()
    found = False
    for d in docs:
        if d["id"] == doc_id:
            d["enabled"] = enabled
            found = True
            break

    if not found:
        return jsonify({"ok": False, "error": "Document not found."}), 404

    _save_user_session(get_user_session_id(), docs)
    return jsonify({"ok": True, "id": doc_id, "enabled": enabled})


@app.route("/api/documents/<doc_id>", methods=["DELETE"])
def api_delete_document(doc_id):
    """Deletes a document from the session vault."""
    docs = get_user_documents()
    initial_len = len(docs)
    docs[:] = [d for d in docs if d["id"] != doc_id]

    if len(docs) == initial_len:
        return jsonify({"ok": False, "error": "Document not found."}), 404

    _save_user_session(get_user_session_id(), docs)
    return jsonify({"ok": True, "remaining": len(docs)})


@app.route("/api/documents/clear", methods=["POST"])
def api_clear_documents():
    """Clears all documents from the current user session vault."""
    uid = get_user_session_id()
    SESSION_DOC_STORE[uid] = []
    _save_user_session(uid, [])
    return jsonify({"ok": True, "remaining": 0})


@app.route("/api/documents/reset-sample", methods=["POST"])
def api_reset_sample():
    """Resets the user's document vault to the default sample CS301 PDF notes."""
    import copy
    uid = get_user_session_id()
    SESSION_DOC_STORE[uid] = [copy.deepcopy(DEFAULT_SAMPLE_DOC)]
    _save_user_session(uid, SESSION_DOC_STORE[uid])
    return jsonify({"ok": True, "message": "Sample notes restored successfully."})


@app.route("/api/chat", methods=["POST"])
def api_chat():
    """
    Core Document Chat endpoint. Answers strictly using PDF content,
    with exact citation page number and verbatim excerpt, or strict refusal.
    Supports response_mode ('exact' | 'thinking') and extensive cross-verification.
    """
    data = request.get_json() or {}
    query = (data.get("query") or "").strip()
    lang = data.get("lang", "auto")
    response_mode = str(data.get("response_mode", "thinking")).lower()

    if not query:
        return jsonify({"ok": False, "error": "Query cannot be empty."}), 400

    docs = get_user_documents()
    enabled_docs = [d for d in docs if d.get("enabled", True)]

    if not enabled_docs:
        return jsonify({
            "ok": True,
            "data": {
                "found": False,
                "answer": "Not found in the document.",
                "sourceDoc": "",
                "pageNumber": 0,
                "excerpt": "",
                "citations": [],
                "notice": "No documents are currently enabled in your workspace."
            }
        })

    extensive = bool(data.get("extensive", False))
    history = data.get("history", [])
    if not isinstance(history, list):
        history = []
    result = query_document_qa(
        query,
        enabled_docs,
        requested_lang=lang,
        extensive=extensive,
        response_mode=response_mode,
        history=history
    )
    return jsonify({"ok": True, "data": result})


@app.route("/api/quiz/generate", methods=["POST"])
def api_quiz_generate():
    """
    Generates multi-format comprehension questions (MCQ, True/False, Matching, Mixed)
    from active PDF documents with verbatim citations and page proofs.
    """
    data = request.get_json() or {}
    count = int(data.get("count", 5))
    difficulty = str(data.get("difficulty", "Intermediate"))
    quiz_type = str(data.get("quiz_type", "mixed")).lower()
    lang = str(data.get("lang", "en"))
    topic = str(data.get("topic", "")).strip()

    docs = get_user_documents()
    enabled_docs = [d for d in docs if d.get("enabled", True)]

    if not enabled_docs:
        return jsonify({"ok": False, "error": "No documents enabled. Please enable or upload a PDF first."}), 400

    questions = generate_document_quiz(
        enabled_docs,
        count=count,
        difficulty=difficulty,
        quiz_type=quiz_type,
        lang=lang,
        topic=topic
    )

    if not questions:
        return jsonify({"ok": False, "error": "Could not generate questions from active documents."}), 500

    return jsonify({"ok": True, "questions": questions, "count": len(questions), "quiz_type": quiz_type})


@app.route("/api/quiz/export", methods=["POST"])
def api_quiz_export():
    """
    Generates and downloads a clean, printable assessment report
    containing score, percentage, questions, answers, and PDF source proofs.
    """
    data = request.get_json() or {}
    export_format = data.get("format", "html")
    score = data.get("score", 0)
    total = data.get("total", 0)
    percentage = data.get("percentage", 0)
    questions = data.get("questions", [])
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if export_format == "json":
        report_data = {
            "title": "Document Intelligence Quiz Report",
            "generatedAt": timestamp,
            "score": score,
            "total": total,
            "percentage": percentage,
            "questions": questions
        }
        response = make_response(json.dumps(report_data, indent=2))
        response.headers["Content-Type"] = "application/json"
        response.headers["Content-Disposition"] = "attachment; filename=quiz_result_report.json"
        return response

    # Default to formatted printable HTML report
    html_content = render_template(
        "quiz_report.html",
        score=score,
        total=total,
        percentage=percentage,
        questions=questions,
        timestamp=timestamp
    )
    response = make_response(html_content)
    response.headers["Content-Type"] = "text/html"
    response.headers["Content-Disposition"] = "attachment; filename=quiz_result_report.html"
    return response


@app.route("/api/document/<doc_id>/outline", methods=["GET"])
def api_get_outline(doc_id):
    """Returns detected chapters/sections and page metadata for the Page Reader."""
    docs = get_user_documents()
    target_doc = next((d for d in docs if d["id"] == doc_id or d["name"] == doc_id), None)
    if not target_doc:
        return jsonify({"ok": False, "error": "Document not found"}), 404

    pages = target_doc.get("pages", [])
    total_pages = max(target_doc.get("physicalPages") or 0, len(pages))
    outline = extract_book_outline(target_doc, limit=60)
    return jsonify({
        "ok": True,
        "docId": target_doc["id"],
        "docName": target_doc["name"],
        "totalPages": total_pages,
        "outline": outline
    })


@app.route("/api/document/<doc_id>/page/<int:page_num>", methods=["GET"])
def api_get_page(doc_id, page_num):
    """Returns page text and details for the Interactive Page Reader."""
    docs = get_user_documents()
    target_doc = next((d for d in docs if d["id"] == doc_id or d["name"] == doc_id), None)

    if not target_doc:
        return jsonify({"ok": False, "error": "Document not found"}), 404

    pages = target_doc.get("pages", [])
    total_pages = max(target_doc.get("physicalPages") or 0, len(pages))
    matching_page = next((p for p in pages if p["pageNumber"] == page_num), None)

    if not matching_page:
        if 1 <= page_num <= total_pages:
            return jsonify({
                "ok": True,
                "docId": target_doc["id"],
                "docName": target_doc["name"],
                "pageNumber": page_num,
                "totalPages": total_pages,
                "text": "[This page contains no extractable text or is a blank/cover/image page.]"
            })
        return jsonify({"ok": False, "error": f"Page {page_num} not found in {target_doc['name']}"}), 404

    return jsonify({
        "ok": True,
        "docId": target_doc["id"],
        "docName": target_doc["name"],
        "pageNumber": page_num,
        "totalPages": total_pages,
        "text": matching_page["text"]
    })


@app.route("/sample-pdf", methods=["GET"])
def api_download_sample_pdf():
    """Serves the generated sample CS301 PDF notes file."""
    pdf_path = os.path.join(app.config["UPLOAD_FOLDER"], "CS301_AI_and_RAG_Notes.pdf")
    if not os.path.exists(pdf_path):
        ensure_sample_pdf_file(app.config["UPLOAD_FOLDER"])
    return send_file(pdf_path, as_attachment=True, download_name="CS301_AI_and_RAG_Notes.pdf")


if __name__ == "__main__":
    target_port = int(os.getenv("PORT", 5050))
    # NEVER auto-fallback: always use the configured port so the frontend always knows where to connect.
    # If 5050 is busy, kill the occupant first (the server startup will error clearly instead of silently moving ports).
    print(f"🚀 Document Intelligence Studio running at http://localhost:{target_port}")
    app.run(host="0.0.0.0", port=target_port, debug=False, use_reloader=False)
