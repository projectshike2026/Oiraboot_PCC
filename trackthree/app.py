import os
import shutil
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file, Response, session
from werkzeug.utils import secure_filename

import config
from rag_engine import RAGEngine
from scholarship_engine import ScholarshipEngine
from ai_service import AIService

app = Flask(__name__)
app.config["SECRET_KEY"] = config.SECRET_KEY
app.config["UPLOAD_FOLDER"] = str(config.UPLOAD_FOLDER)
app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH

# Initialize engines
rag = RAGEngine()
ai = AIService()
scholarship_engine = ScholarshipEngine()

# Ensure uploads folder exists
upload_path = Path(config.UPLOAD_FOLDER)
upload_path.mkdir(exist_ok=True)

# Preload default sample PDF if available
DEFAULT_PDF = Path(__file__).resolve().parent / "problem-statement-e3fb21da4b4a.pdf"
if DEFAULT_PDF.exists():
    try:
        dest = upload_path / DEFAULT_PDF.name
        if not dest.exists():
            shutil.copy(DEFAULT_PDF, dest)
        rag.extract_pdf(str(dest), original_filename=DEFAULT_PDF.name)
    except Exception as e:
        print(f"Warning: Failed to load default PDF: {e}")


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in config.ALLOWED_EXTENSIONS


# =========================================================================
# TRACK 3: SCHOLARSHIP ATLAS ROUTES (DEFAULT HOME)
# =========================================================================

@app.route("/")
def index():
    return render_template(
        "scholarships.html",
        total_scholarships=len(scholarship_engine.records),
        current_lang=session.get("lang", "en")
    )


@app.route("/api/match_scholarships", methods=["POST"])
def match_scholarships():
    data = request.get_json() or {}
    try:
        cgpa = float(data.get("cgpa", 3.85))
    except (TypeError, ValueError):
        cgpa = 3.85
    dept = data.get("department", "CSE")
    need = bool(data.get("need_based", False))
    gender = data.get("gender", "All")
    client_lang = data.get("lang", "en")
    is_bangla = (client_lang == "bn")

    result = scholarship_engine.evaluate_profile(cgpa, dept, need, gender)
    eligible = result["eligible"]
    near_miss = result["near_miss"]

    return jsonify({
        "success": True,
        "total_catalog": result["total_catalog"],
        "total_matched": len(eligible),
        "total_almost": len(near_miss),
        "total_potential_bdt": result["total_potential_bdt"],
        "max_single_award_bdt": result["max_single_award_bdt"],
        "matched": eligible,
        "almost": near_miss,
        "is_bangla": is_bangla
    })


@app.route("/api/ai_advise", methods=["POST"])
def ai_advise():
    data = request.get_json() or {}
    cgpa = data.get("cgpa", 3.85)
    dept = data.get("department", "CSE")
    need = data.get("need_based", False)
    matched_names = data.get("matched_names", [])
    client_lang = data.get("lang", "en")
    is_bangla = (client_lang == "bn")

    system_prompt = (
        "You are a Senior Academic Scholarship Counselor at Port City International University (PCIU). "
        "You MUST write your entire response in natural, fluent Bengali (বাংলা). "
        "Write a concise 2-paragraph strategic recommendation advising the student on which scholarships to prioritize, "
        "how to maximize their odds, and key application steps in Bengali (বাংলা)."
        if is_bangla else
        "You are a Senior Academic Scholarship Counselor at Port City International University (PCIU). "
        "Write a concise 2-paragraph strategic recommendation advising the student on which scholarships to prioritize, "
        "how to maximize their odds, and key application steps in English."
    )

    user_prompt = f"""Student Profile:
- CGPA: {cgpa}
- Department: {dept}
- Financial Support Needed: {'Yes' if need else 'No'}
- Top Matched Awards: {', '.join(matched_names[:8])}

Provide your strategic advisory recommendation:"""

    try:
        advice = ai._generate_content(system_prompt, user_prompt, response_json=False)
        return jsonify({"success": True, "advice": advice})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/api/export_scholarships", methods=["POST"])
def export_scholarships():
    data = request.get_json() or {}
    items = data.get("items", [])
    try:
        cgpa = float(data.get("cgpa", 3.85))
    except (TypeError, ValueError):
        cgpa = 3.85
    dept = data.get("department", "CSE")
    need = bool(data.get("need_based", False))
    client_lang = data.get("lang", "en")

    csv_content = scholarship_engine.export_csv_report(items, cgpa, dept, need, lang=client_lang)
    return Response(
        csv_content,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment;filename=scholarships_{dept}_cgpa{cgpa:.2f}.csv"}
    )


# =========================================================================
# TRACK 1: DOCUMENT INTELLIGENCE STUDIO ROUTES
# =========================================================================

@app.route("/track1")
def track1():
    docs = rag.get_document_summary()
    total_pages = sum(d["total_pages"] for d in docs)
    total_words = sum(d["total_words"] for d in docs)
    return render_template(
        "index.html",
        documents=docs,
        total_pages=total_pages,
        total_words=total_words,
        current_lang=session.get("lang", "en")
    )


@app.route("/api/documents", methods=["GET"])
def get_documents():
    docs = rag.get_document_summary()
    return jsonify({
        "success": True,
        "count": len(docs),
        "total_pages": sum(d["total_pages"] for d in docs),
        "total_words": sum(d["total_words"] for d in docs),
        "documents": docs
    })


@app.route("/upload", methods=["POST"])
def upload_file():
    if "files" not in request.files and "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400

    uploaded_files = request.files.getlist("files")
    if not uploaded_files or (len(uploaded_files) == 1 and uploaded_files[0].filename == ""):
        uploaded_files = [request.files.get("file")]

    added_docs = []
    errors = []

    for file in uploaded_files:
        if not file or file.filename == "":
            continue
        if not allowed_file(file.filename):
            errors.append(f"'{file.filename}' is not a valid PDF file.")
            continue

        filename = secure_filename(file.filename)
        # Avoid empty secure filename
        if not filename:
            filename = "document.pdf"
        saved_path = upload_path / filename

        # Ensure unique filename if already exists
        counter = 1
        stem = saved_path.stem
        while saved_path.exists():
            filename = f"{stem}_{counter}.pdf"
            saved_path = upload_path / filename
            counter += 1

        try:
            file.save(str(saved_path))
            doc_data = rag.extract_pdf(str(saved_path), original_filename=file.filename)
            added_docs.append({
                "filename": doc_data["filename"],
                "total_pages": doc_data["total_pages"],
                "total_words": doc_data["total_words"]
            })
        except Exception as e:
            errors.append(f"Failed to process '{file.filename}': {str(e)}")

    docs = rag.get_document_summary()
    return jsonify({
        "success": len(added_docs) > 0,
        "added": added_docs,
        "errors": errors,
        "documents": docs,
        "total_pages": sum(d["total_pages"] for d in docs),
        "total_words": sum(d["total_words"] for d in docs)
    })


@app.route("/remove_doc", methods=["POST"])
def remove_doc():
    data = request.get_json() or {}
    filename = data.get("filename")
    if not filename:
        return jsonify({"success": False, "error": "Filename is required"}), 400

    removed = rag.remove_document(filename)
    docs = rag.get_document_summary()
    return jsonify({
        "success": removed,
        "documents": docs,
        "total_pages": sum(d["total_pages"] for d in docs),
        "total_words": sum(d["total_words"] for d in docs)
    })


@app.route("/clear_docs", methods=["POST"])
def clear_docs():
    rag.clear_documents()
    return jsonify({
        "success": True,
        "documents": [],
        "total_pages": 0,
        "total_words": 0
    })


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    question = (data.get("question") or "").strip()
    client_lang = data.get("lang", "en")

    if not question:
        return jsonify({"success": False, "error": "Question cannot be empty"}), 400

    if not rag.documents:
        return jsonify({
            "success": False,
            "error": "No documents uploaded. Please upload a PDF first."
        }), 400

    # Detect if user wrote in Bengali or client requested Bengali
    is_bangla = (client_lang == "bn") or rag.is_bangla(question)

    # Build page-grounded context
    context = rag.build_context(query=question)
    if not context:
        return jsonify({
            "success": True,
            "found": False,
            "answer": "Not found in the document",
            "source_doc": None,
            "page_number": None,
            "excerpt": None
        })

    # Call AI Service with fallback
    result = ai.answer_question(context=context, question=question, is_bangla=is_bangla)

    return jsonify({
        "success": True,
        "found": result.get("found", False),
        "answer": result.get("answer", "Not found in the document"),
        "source_doc": result.get("source_doc"),
        "page_number": result.get("page_number"),
        "excerpt": result.get("excerpt"),
        "is_bangla": is_bangla
    })


@app.route("/generate_quiz", methods=["POST"])
def generate_quiz():
    data = request.get_json() or {}
    num_questions = int(data.get("num_questions", 5))
    difficulty = data.get("difficulty", "Medium")
    client_lang = data.get("lang", "en")
    is_bangla = (client_lang == "bn")

    if not rag.documents:
        return jsonify({
            "success": False,
            "error": "No documents uploaded. Please upload a PDF first."
        }), 400

    context = rag.build_context(max_chars=36000)
    questions = ai.generate_quiz(
        context=context,
        num_questions=num_questions,
        difficulty=difficulty,
        is_bangla=is_bangla
    )

    if not questions:
        return jsonify({
            "success": False,
            "error": "Could not generate questions from the current document. Try uploading another PDF or reducing question count."
        }), 500

    return jsonify({
        "success": True,
        "questions": questions,
        "count": len(questions),
        "difficulty": difficulty,
        "is_bangla": is_bangla
    })


@app.route("/submit_quiz", methods=["POST"])
def submit_quiz():
    data = request.get_json() or {}
    questions = data.get("questions", [])
    user_answers = data.get("answers", {})  # {question_id: selected_index}

    if not questions:
        return jsonify({"success": False, "error": "No questions provided"}), 400

    results = []
    correct_count = 0

    for q in questions:
        q_id = str(q.get("id"))
        correct_idx = q.get("correct_index", 0)
        user_idx = user_answers.get(q_id)
        if user_idx is not None:
            user_idx = int(user_idx)

        is_correct = (user_idx == correct_idx)
        if is_correct:
            correct_count += 1

        results.append({
            "id": q.get("id"),
            "question": q.get("question"),
            "options": q.get("options", []),
            "user_index": user_idx,
            "correct_index": correct_idx,
            "is_correct": is_correct,
            "page_number": q.get("page_number"),
            "source_doc": q.get("source_doc"),
            "explanation_quote": q.get("explanation_quote")
        })

    total = len(questions)
    percentage = round((correct_count / total * 100), 1) if total > 0 else 0

    return jsonify({
        "success": True,
        "total": total,
        "correct_count": correct_count,
        "percentage": percentage,
        "results": results
    })


@app.route("/download_quiz", methods=["POST"])
def download_quiz():
    data = request.get_json() or {}
    results = data.get("results", [])
    score = data.get("score", "0/0")
    percentage = data.get("percentage", 0)

    lines = [
        "=" * 64,
        "PORT CITY INTERNATIONAL UNIVERSITY — PCIU COMPUTER CLUB",
        "Track 1: Document Intelligence & RAG — Quiz Assessment Report",
        "=" * 64,
        f"Final Score: {score} ({percentage}%)",
        f"Generated At: Track 1 AI Academic Platform",
        "-" * 64,
        ""
    ]

    for i, item in enumerate(results, start=1):
        lines.append(f"Question {i}: {item.get('question')}")
        options = item.get("options", [])
        user_idx = item.get("user_index")
        correct_idx = item.get("correct_index")

        for opt_i, opt in enumerate(options):
            marker = "   "
            if opt_i == correct_idx:
                marker = " [CORRECT] "
            if opt_i == user_idx:
                marker = " [YOUR ANSWER] " + marker
            lines.append(f"  {chr(65+opt_i)}. {opt}{marker}")

        status = "PASSED" if item.get("is_correct") else "INCORRECT"
        lines.append(f"Status: {status}")
        lines.append(f"Source Document: {item.get('source_doc', 'Document')}")
        lines.append(f"Source Page: Page {item.get('page_number', 'N/A')}")
        lines.append(f"Document Proof Excerpt: \"{item.get('explanation_quote', 'N/A')}\"")
        lines.append("-" * 64)
        lines.append("")

    report_content = "\n".join(lines)
    return Response(
        report_content,
        mimetype="text/plain; charset=utf-8",
        headers={"Content-Disposition": "attachment;filename=quiz_result_report.txt"}
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=config.PORT, debug=False, use_reloader=False)
