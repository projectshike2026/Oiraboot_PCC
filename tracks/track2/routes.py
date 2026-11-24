import json
from flask import Blueprint, request, jsonify
from core.errors import AppError
from core.db import get_db, get_session_id, touch_session
from core.security import verify_csrf
from core.i18n import get_current_lang
from tracks.track2.chat import chat_admission, get_admission_checklist
from tracks.track2.kb import kb

bp = Blueprint("track2", __name__)

@bp.route("/api/admission/chat", methods=["POST"])
def admission_chat():
    verify_csrf()
    sid = get_session_id()
    touch_session(sid, get_current_lang())
    db = get_db()

    payload = request.get_json(silent=True) or {}
    message = payload.get("message", "")

    result = chat_admission(sid, message, db, ui_lang=get_current_lang())
    return jsonify(result)

@bp.route("/api/admission/history", methods=["GET"])
def admission_history():
    sid = get_session_id()
    touch_session(sid, get_current_lang())
    db = get_db()

    rows = db.execute("""
    SELECT role, content, kind, evidence_json, suggestions_json, created_at
    FROM admission_messages
    WHERE sid = ? ORDER BY id ASC
    """, (sid,)).fetchall()

    messages = []
    for r in rows:
        item = dict(r)
        item["evidence"] = json.loads(item["evidence_json"]) if item.get("evidence_json") else []
        item["suggestions"] = json.loads(item["suggestions_json"]) if item.get("suggestions_json") else []
        messages.append(item)

    return jsonify({"messages": messages})

@bp.route("/api/admission/history", methods=["DELETE"])
def clear_admission_history():
    verify_csrf()
    sid = get_session_id()
    db = get_db()
    db.execute("DELETE FROM admission_messages WHERE sid = ?", (sid,))
    db.commit()
    return jsonify({"ok": True})

@bp.route("/api/admission/checklist", methods=["GET"])
def checklist():
    lang = request.args.get("lang") or get_current_lang()
    items = get_admission_checklist(lang)
    return jsonify({"items": items})

@bp.route("/api/admission/data", methods=["GET"])
def admission_data():
    return jsonify({
        "raw_text": kb.raw_text,
        "contacts": kb.contacts,
        "sections_count": len(kb.sections)
    })
