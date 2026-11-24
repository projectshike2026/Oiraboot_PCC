import csv
import io
import json
import time
from flask import Blueprint, request, jsonify, Response
from core.errors import AppError
from core.db import get_db, get_session_id, touch_session
from core.security import verify_csrf
from core.i18n import get_current_lang
from tracks.track3.loader import load_scholarships_into_db, parse_scholarships_csv
from tracks.track3.matcher import match_scholarships
from tracks.track3.reasons import generate_batch_reasons

bp = Blueprint("track3", __name__)

def _get_all_scholarships(db):
    rows = db.execute("SELECT * FROM scholarships ORDER BY amount_value DESC").fetchall()
    if not rows:
        return load_scholarships_into_db(db)
    items = []
    for r in rows:
        d = dict(r)
        d["departments"] = json.loads(d["departments_json"])
        raw = json.loads(d["raw_json"])
        d["checklist"] = [x.strip() for x in d["requirements"].split(";") if x.strip()] if d["requirements"] else [
            "Verify academic transcripts and minimum CGPA criteria",
            "Complete the scholarship application declaration",
            "Submit certified documents before the deadline"
        ]
        items.append(d)
    return items

@bp.route("/api/scholarships/match", methods=["POST"])
def evaluate():
    verify_csrf()
    sid = get_session_id()
    touch_session(sid, get_current_lang())
    db = get_db()

    payload = request.get_json(silent=True) or {}
    try:
        cgpa = float(payload.get("cgpa", 3.75))
    except (ValueError, TypeError):
        cgpa = 3.75

    department = str(payload.get("department", "CSE")).strip()
    needs_support = bool(payload.get("needs_support", True))
    sort_by = str(payload.get("sort", "amount")).strip()
    lang = payload.get("lang") or get_current_lang()

    all_scholarships = _get_all_scholarships(db)
    matched, almost = match_scholarships(all_scholarships, cgpa, department, needs_support, sort_by=sort_by, lang=lang)

    # Generate immediate template reasons so frontend renders instantly
    reasons_map = generate_batch_reasons(matched, cgpa, department, needs_support, lang=lang, db=db)

    now = time.strftime("%Y-%m-%d %H:%M:%S")
    cursor = db.execute("""
    INSERT INTO searches (sid, cgpa, department, needs_support, lang, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (sid, cgpa, department, 1 if needs_support else 0, lang, now))
    search_id = cursor.lastrowid
    db.commit()

    return jsonify({
        "search_id": search_id,
        "matched": matched,
        "almost": almost,
        "reasons": reasons_map
    })

@bp.route("/api/scholarships/reasons", methods=["POST"])
def update_reasons():
    verify_csrf()
    sid = get_session_id()
    touch_session(sid, get_current_lang())
    db = get_db()

    payload = request.get_json(silent=True) or {}
    search_id = payload.get("search_id")
    row = db.execute("SELECT * FROM searches WHERE id = ? AND sid = ?", (search_id, sid)).fetchone()
    if not row:
        raise AppError("not_found", "Search record not found.", 404)

    all_scholarships = _get_all_scholarships(db)
    matched, _ = match_scholarships(
        all_scholarships,
        row["cgpa"],
        row["department"],
        bool(row["needs_support"]),
        lang=row["lang"]
    )

    reasons_map = generate_batch_reasons(
        matched,
        row["cgpa"],
        row["department"],
        bool(row["needs_support"]),
        lang=row["lang"],
        db=db
    )
    return jsonify({"reasons": reasons_map})

@bp.route("/api/scholarships/export.csv", methods=["POST", "GET"])
def export_csv():
    sid = get_session_id()
    db = get_db()

    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        cgpa = float(payload.get("cgpa", 3.75))
        department = str(payload.get("department", "CSE"))
        needs_support = bool(payload.get("needs_support", True))
        lang = payload.get("lang") or get_current_lang()
    else:
        cgpa = float(request.args.get("cgpa", 3.75))
        department = request.args.get("department", "CSE")
        needs_support = request.args.get("needs_support", "true").lower() in ("true", "1")
        lang = request.args.get("lang") or get_current_lang()

    all_scholarships = _get_all_scholarships(db)
    matched, almost = match_scholarships(all_scholarships, cgpa, department, needs_support, lang=lang)
    reasons_map = generate_batch_reasons(matched, cgpa, department, needs_support, lang=lang, db=db)

    output = io.StringIO()
    output.write('\ufeff')  # UTF-8 BOM
    writer = csv.writer(output)
    writer.writerow([
        "Status", "Scholarship Name", "Provider", "Award (BDT)",
        "Min CGPA", "Eligible Departments", "Financial Need Required",
        "Deadline", "Fit Rationale / Missing Criteria"
    ])

    for s in matched:
        sid_str = str(s["id"])
        reason = reasons_map.get(sid_str, {}).get("reason", "")
        writer.writerow([
            "Eligible", s["name"], s["provider"], s["amount_value"],
            s["min_cgpa"], "|".join(s["departments"]), "Yes" if s["need_based"] else "No",
            s["deadline"], reason
        ])

    for s in almost:
        missing_str = "; ".join(s.get("missing", []))
        writer.writerow([
            "Near Match", s["name"], s["provider"], s["amount_value"],
            s["min_cgpa"], "|".join(s["departments"]), "Yes" if s["need_based"] else "No",
            s["deadline"], missing_str
        ])

    return Response(
        output.getvalue(),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=PCIU_Scholarship_Matching_Report.csv"}
    )

@bp.route("/api/scholarships/catalog", methods=["GET"])
def catalog():
    db = get_db()
    items = _get_all_scholarships(db)
    return jsonify({"count": len(items), "scholarships": items})

@bp.route("/api/scholarships/upload", methods=["POST"])
def upload_csv():
    verify_csrf()
    db = get_db()
    file_storage = request.files.get("file")
    if not file_storage:
        raise AppError("data_missing", "No CSV file provided.", 400)

    content = file_storage.read().decode("utf-8", errors="replace")
    items = parse_scholarships_csv(content)

    db.execute("DELETE FROM scholarships")
    for s in items:
        db.execute("""
        INSERT INTO scholarships (
            id, name, provider, min_cgpa, departments_json, need_based,
            amount_text, amount_value, deadline, deadline_text, url,
            description, requirements, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            s["id"], s["name"], s["provider"], s["min_cgpa"], json.dumps(s["departments"]),
            s["need_based"], s["amount_text"], s["amount_value"], s["deadline"],
            s["deadline_text"], s["url"], s["description"], s["requirements"], s["raw_json"]
        ))
    db.commit()
    return jsonify({"ok": True, "count": len(items)})
