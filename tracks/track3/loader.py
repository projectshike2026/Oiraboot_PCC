import csv
import io
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from config import Config
from core.errors import AppError

ALIASES: Dict[str, List[str]] = {
    "name": ["name", "scholarship", "scholarship_name", "title", "award_name"],
    "min_cgpa": ["min_cgpa", "cgpa", "minimum_cgpa", "required_cgpa", "gpa", "min_gpa"],
    "departments": ["departments", "department", "eligible_departments", "dept", "eligible_dept", "faculties"],
    "need_based": ["need_based", "financial_need", "needs_support", "financial_support", "need", "need_required"],
    "amount": ["amount", "value", "award", "benefit", "stipend", "amount_bdt"],
    "deadline": ["deadline", "due_date", "last_date", "closing_date", "due"],
    "provider": ["provider", "organisation", "organization", "sponsor", "offered_by", "authority"],
    "url": ["url", "link", "apply_link", "website"],
    "description": ["description", "details", "about", "notes"],
    "requirements": ["requirements", "documents", "how_to_apply", "apply_steps", "checklist"]
}

def normalize_header(h: str) -> str:
    return re.sub(r'[\s\-_\/]+', '', h.strip().lower())

def map_headers(found_headers: List[str]) -> Dict[str, str]:
    mapping = {}
    normalized_found = {normalize_header(h): h for h in found_headers}

    for canonical, synonyms in ALIASES.items():
        for syn in synonyms:
            norm_syn = normalize_header(syn)
            if norm_syn in normalized_found:
                mapping[canonical] = normalized_found[norm_syn]
                break

    # Validate required fields: name, min_cgpa, departments
    for req in ["name", "min_cgpa", "departments"]:
        if req not in mapping:
            raise AppError("data_missing", f"Required CSV column '{req}' could not be mapped. Found: {found_headers}", 400)

    return mapping

def parse_scholarships_csv(csv_content: str) -> List[Dict[str, Any]]:
    """Parse CSV text with flexible column mapping and robust type casting."""
    reader = csv.reader(io.StringIO(csv_content.strip()))
    rows = list(reader)
    if not rows or len(rows) < 2:
        raise AppError("data_missing", "CSV file is empty or missing headers.", 400)

    headers = rows[0]
    col_map = map_headers(headers)
    scholarships = []

    for idx, row in enumerate(rows[1:], start=1):
        if not any(cell.strip() for cell in row):
            continue
        row_dict = {headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))}

        def get_val(canonical: str, default: str = "") -> str:
            col = col_map.get(canonical)
            return (row_dict.get(col) or default).strip() if col else default

        name = get_val("name", f"Scholarship #{idx}")
        
        # CGPA Parsing
        cgpa_str = get_val("min_cgpa", "0.0")
        try:
            min_cgpa = float(re.findall(r'\d+(?:\.\d+)?', cgpa_str)[0]) if re.findall(r'\d+(?:\.\d+)?', cgpa_str) else 0.0
        except Exception:
            min_cgpa = 0.0

        # Departments parsing: split by ;, ,, |, /, &
        depts_raw = get_val("departments", "ALL").upper()
        if not depts_raw or depts_raw in ("ALL", "ANY", "OPEN", "EVERY", "*"):
            depts = ["ALL"]
        else:
            depts = [d.strip() for d in re.split(r'[;|,/&]|(?:\s+AND\s+)', depts_raw) if d.strip()]
            if not depts:
                depts = ["ALL"]

        # Need-based parsing
        need_str = get_val("need_based", "false").lower()
        need_based = 1 if need_str in ("true", "yes", "1", "y", "t", "required") else 0

        # Amount parsing
        amount_text = get_val("amount", "BDT 50,000")
        amt_match = re.search(r'\d[\d,]*', amount_text)
        amount_val = float(amt_match.group(0).replace(",", "")) if amt_match else 50000.0

        # Deadline parsing
        deadline_text = get_val("deadline", "2027-01-30")
        # Try finding YYYY-MM-DD
        date_match = re.search(r'\b\d{4}-\d{2}-\d{2}\b', deadline_text)
        deadline_iso = date_match.group(0) if date_match else deadline_text

        # Requirements checklist
        reqs_text = get_val("requirements", "")
        if reqs_text:
            checklist = [r.strip() for r in re.split(r'[;\n|]', reqs_text) if r.strip()]
        else:
            checklist = [
                "Verify academic transcripts and minimum CGPA criteria",
                "Complete the scholarship application declaration",
                "Submit certified documents before the deadline"
            ]

        scholarships.append({
            "id": idx,
            "name": name,
            "provider": get_val("provider", "Scholarship Committee"),
            "min_cgpa": min_cgpa,
            "departments": depts,
            "need_based": need_based,
            "amount_text": amount_text,
            "amount_value": amount_val,
            "deadline": deadline_iso,
            "deadline_text": deadline_text,
            "url": get_val("url", ""),
            "description": get_val("description", ""),
            "requirements": reqs_text,
            "checklist": checklist,
            "raw_json": json.dumps(row_dict)
        })

    return scholarships

def load_scholarships_into_db(db, csv_path: str = None) -> List[Dict[str, Any]]:
    """Loads and caches scholarships into SQLite."""
    path = Path(csv_path or Config.SCHOLARSHIPS_DATA_PATH)
    if not path.exists():
        return []

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

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
    return items
