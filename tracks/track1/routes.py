import csv
import io
import json
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file, g, session, Response, render_template
from config import Config
from core.errors import AppError
from core.db import get_db, get_session_id, touch_session
from core.security import verify_csrf, validate_pdf_upload
from core.i18n import get_current_lang
from tracks.track1.pdfio import extract_pdf
from tracks.track1.rag import answer_question
from tracks.track1.quiz import generate_quiz, submit_quiz

bp = Blueprint("track1", __name__)

@bp.route("/api/upload", methods=["POST"])
def upload():
    verify_csrf()
    sid = get_session_id()
    touch_session(sid, get_current_lang())
    db = get_db()

    file_storage = request.files.get("file")
    data, safe_name = validate_pdf_upload(file_storage)
    doc_info = extract_pdf(data, safe_name, file_storage.filename, sid, db)
    return jsonify({"doc": doc_info}), 201

@bp.route("/api/docs", methods=["GET"])
def list_docs():
    sid = get_session_id()
    touch_session(sid, get_current_lang())
    db = get_db()
    rows = db.execute("""
    SELECT id, filename, page_count, char_count, created_at
    FROM documents WHERE sid = ? ORDER BY id DESC
    """, (sid,)).fetchall()
    return jsonify({"docs": [dict(r) for r in rows]})

@bp.route("/api/docs/<int:doc_id>", methods=["DELETE"])
def delete_doc(doc_id: int):
    verify_csrf()
    sid = get_session_id()
    db = get_db()
    row = db.execute("SELECT stored_name FROM documents WHERE id = ? AND sid = ?", (doc_id, sid)).fetchone()
    if not row:
        raise AppError("not_found", "Document not found.", 404)

    stored_name = row["stored_name"]
    file_path = Path(Config.UPLOAD_FOLDER) / stored_name
    if file_path.exists():
        try:
            file_path.unlink()
        except OSError:
            pass

    db.execute("DELETE FROM documents WHERE id = ? AND sid = ?", (doc_id, sid))
    db.commit()
    return jsonify({"ok": True})

@bp.route("/doc/<int:doc_id>/file", methods=["GET"])
def serve_doc_file(doc_id: int):
    sid = get_session_id()
    db = get_db()
    row = db.execute("SELECT stored_name, filename FROM documents WHERE id = ? AND sid = ?", (doc_id, sid)).fetchone()
    if not row:
        raise AppError("not_found", "Document not found.", 404)

    file_path = Path(Config.UPLOAD_FOLDER) / row["stored_name"]
    if not file_path.exists():
        raise AppError("not_found", "Physical file missing on disk.", 404)

    return send_file(
        str(file_path),
        mimetype="application/pdf",
        as_attachment=False,
        download_name=row["filename"]
    )

@bp.route("/api/docs/<int:doc_id>/page/<int:page_no>", methods=["GET"])
def get_doc_page(doc_id: int, page_no: int):
    sid = get_session_id()
    db = get_db()
    row = db.execute("""
    SELECT p.page_no, p.text FROM pages p
    JOIN documents d ON p.doc_id = d.id
    WHERE p.doc_id = ? AND p.page_no = ? AND d.sid = ?
    """, (doc_id, page_no, sid)).fetchone()
    if not row:
        raise AppError("not_found", "Page not found.", 404)
    return jsonify({"page": row["page_no"], "text": row["text"]})

@bp.route("/api/chat", methods=["POST"])
def chat():
    verify_csrf()
    sid = get_session_id()
    touch_session(sid, get_current_lang())
    db = get_db()

    payload = request.get_json(silent=True) or {}
    doc_ids = payload.get("doc_ids", [])
    message = payload.get("message", "")

    result = answer_question(sid, doc_ids, message, db, ui_lang=get_current_lang())
    return jsonify(result)

@bp.route("/api/chat/history", methods=["GET"])
def chat_history():
    sid = get_session_id()
    db = get_db()
    doc_ids_param = request.args.get("doc_ids", "")
    scope_str = ",".join(str(int(i)) for i in sorted(doc_ids_param.split(",")) if i.strip().isdigit())

    query = "SELECT role, content, found, sources_json, created_at FROM messages WHERE sid = ?"
    params = [sid]
    if scope_str:
        query += " AND scope = ?"
        params.append(scope_str)
    query += " ORDER BY id ASC"

    rows = db.execute(query, params).fetchall()
    messages = []
    for r in rows:
        item = dict(r)
        if item.get("sources_json"):
            item["sources"] = json.loads(item["sources_json"])
        else:
            item["sources"] = []
        messages.append(item)

    return jsonify({"messages": messages})

@bp.route("/api/chat/history", methods=["DELETE"])
def clear_chat():
    verify_csrf()
    sid = get_session_id()
    db = get_db()
    db.execute("DELETE FROM messages WHERE sid = ?", (sid,))
    db.commit()
    return jsonify({"ok": True})

@bp.route("/api/quiz", methods=["POST"])
def make_quiz():
    verify_csrf()
    sid = get_session_id()
    touch_session(sid, get_current_lang())
    db = get_db()

    payload = request.get_json(silent=True) or {}
    doc_ids = payload.get("doc_ids", [])
    n = payload.get("n", 5)
    difficulty = payload.get("difficulty", "medium")
    language = payload.get("language", get_current_lang())

    result = generate_quiz(sid, doc_ids, n=n, difficulty=difficulty, language=language, db=db)
    return jsonify(result)

@bp.route("/api/quiz/<int:quiz_id>/submit", methods=["POST"])
def submit_quiz_answers(quiz_id: int):
    verify_csrf()
    sid = get_session_id()
    touch_session(sid, get_current_lang())
    db = get_db()

    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers", {})

    result = submit_quiz(sid, quiz_id, answers, db)
    return jsonify(result)

@bp.route("/result/<int:attempt_id>", methods=["GET"])
def view_result(attempt_id: int):
    sid = get_session_id()
    db = get_db()
    row = db.execute("""
    SELECT a.*, q.scope, q.difficulty, q.language, q.questions_json
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    WHERE a.id = ? AND q.sid = ?
    """, (attempt_id, sid)).fetchone()
    if not row:
        raise AppError("not_found", "Result not found.", 404)

    questions = json.loads(row["questions_json"])
    user_answers = json.loads(row["answers_json"])
    results = []
    for q in questions:
        chosen = user_answers.get(str(q["id"]))
        is_corr = (chosen == q["correct_index"])
        results.append({
            "no": q["id"],
            "q": q["q"],
            "chosen": q["options"][chosen] if chosen is not None and chosen < len(q["options"]) else "Unanswered",
            "correct": q["options"][q["correct_index"]],
            "is_correct": is_corr,
            "explanation": q["explanation"],
            "source": q["source"]
        })

    return render_template(
        "result.html",
        attempt_id=attempt_id,
        score=row["score"],
        total=row["total"],
        pct=round((row["score"] / max(1, row["total"])) * 100),
        difficulty=row["difficulty"],
        date=row["created_at"],
        results=results
    )

@bp.route("/result/<int:attempt_id>.csv", methods=["GET"])
def download_result_csv(attempt_id: int):
    sid = get_session_id()
    db = get_db()
    row = db.execute("""
    SELECT a.*, q.questions_json
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    WHERE a.id = ? AND q.sid = ?
    """, (attempt_id, sid)).fetchone()
    if not row:
        raise AppError("not_found", "Result not found.", 404)

    questions = json.loads(row["questions_json"])
    user_answers = json.loads(row["answers_json"])

    output = io.StringIO()
    # Add UTF-8 BOM so Excel opens Bengali correctly
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(["no", "question", "your_answer", "correct_answer", "is_correct", "explanation", "source_page", "source_file"])

    for q in questions:
        chosen = user_answers.get(str(q["id"]))
        chosen_text = q["options"][chosen] if chosen is not None and chosen < len(q["options"]) else "Unanswered"
        correct_text = q["options"][q["correct_index"]]
        is_corr = "Yes" if chosen == q["correct_index"] else "No"
        src = q.get("source", {})
        writer.writerow([
            q["id"],
            q["q"],
            chosen_text,
            correct_text,
            is_corr,
            q.get("explanation", ""),
            src.get("page", ""),
            src.get("filename", "")
        ])

    csv_data = output.getvalue()
    return Response(
        csv_data,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=PCIU_Quiz_Result_{attempt_id}.csv"}
    )
