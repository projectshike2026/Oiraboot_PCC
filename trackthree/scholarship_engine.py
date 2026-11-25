import csv
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

CSV_PATH = Path(__file__).resolve().parent / "public" / "assets" / "aistudio" / "track3_scholarships__1__8b56b284.csv"

NEAR_MISS_CGPA_WINDOW = 0.50
NEAR_MISS_COMBO_WINDOW = 0.30

def format_bdt(amount: int) -> str:
    return f"BDT {amount:,}"

def department_display_label(dept_raw: str, lang: str = "en") -> str:
    if dept_raw == "All":
        return "সকল বিভাগ" if lang == "bn" else "All departments"
    return dept_raw.replace(";", ", ")

def detect_additional_condition(description: str) -> Dict[str, Any]:
    d = description.lower()
    if "github" in d:
        return {
            "condition_en": "Requires a public GitHub profile demonstrating real project work.",
            "condition_bn": "বাস্তব প্রজেক্টসহ একটি পাবলিক GitHub প্রোফাইল থাকা প্রয়োজন।",
            "doc_step_en": "Prepare your public GitHub profile URL with pinned software repositories.",
            "doc_step_bn": "আপনার প্রজেক্টগুলোসহ পাবলিক GitHub প্রোফাইলের লিংক প্রস্তুত করুন।"
        }
    if "research" in d or "join a lab" in d or "higher studies" in d:
        return {
            "condition_en": "Targets students pursuing research, lab work, or higher studies.",
            "condition_bn": "গবেষণা, ল্যাব কার্যক্রম বা উচ্চশিক্ষায় আগ্রহী শিক্ষার্থীদের জন্য প্রযোজ্য।",
            "doc_step_en": "Draft a short statement of research interest or faculty lab preference.",
            "doc_step_bn": "গবেষণার আগ্রহ বা ল্যাব সংক্রান্ত একটি সংক্ষিপ্ত বিবরণী প্রস্তুত করুন।"
        }
    if "startup" in d or "small business" in d or "online business" in d:
        return {
            "condition_en": "Requires a startup concept or active small/online business.",
            "condition_bn": "স্টার্টআপ আইডিয়া অথবা চলমান ক্ষুদ্র বা অনলাইন ব্যবসা থাকা প্রয়োজন।",
            "doc_step_en": "Prepare a 1-page summary of your startup idea or business activity.",
            "doc_step_bn": "আপনার স্টার্টআপ আইডিয়া বা ব্যবসার ১ পৃষ্ঠার সংক্ষিপ্তসার তৈরি করুন।"
        }
    if "volunteer" in d or "community" in d or "blood donor" in d:
        return {
            "condition_en": "Requires verified community service, volunteer hours, or blood donation record.",
            "condition_bn": "স্বেচ্ছাসেবামূলক কাজ, কমিউনিটি সেবা বা রক্তদানের প্রমাণপত্র প্রয়োজন।",
            "doc_step_en": "Collect volunteer certificates or organization verification letters.",
            "doc_step_bn": "স্বেচ্ছাসেবী সনদ বা সংশ্লিষ্ট সংগঠনের প্রত্যয়নপত্র সংগ্রহ করুন।"
        }
    if "hackathon" in d or "programming contest" in d or "competition" in d or "debate" in d or "sports" in d:
        return {
            "condition_en": "Prioritizes documented competition, hackathon, debate, or sports participation.",
            "condition_bn": "প্রতিযোগিতা, হ্যাকাথন, বিতর্ক বা খেলাধুলায় অংশগ্রহণের প্রমাণপত্র প্রয়োজন।",
            "doc_step_en": "Attach participation certificates, awards, or team selection proof.",
            "doc_step_bn": "অংশগ্রহণ সনদ, পুরস্কার বা টিম নির্বাচনের প্রমাণপত্র সংযুক্ত করুন।"
        }
    if "software project" in d or "electronics" in d or "power project" in d or "buildings" in d:
        return {
            "condition_en": "Requires documented hands-on academic or technical project work.",
            "condition_bn": "সংশ্লিষ্ট একাডেমিক বা টেকনিক্যাল প্রজেক্টের বিবরণ ও প্রমাণ প্রয়োজন।",
            "doc_step_en": "Compile a brief portfolio or report of your relevant technical projects.",
            "doc_step_bn": "আপনার সংশ্লিষ্ট টেকনিক্যাল প্রজেক্টগুলোর সংক্ষিপ্ত রিপোর্ট বা পোর্টফোলিও তৈরি করুন।"
        }
    if "first in their family" in d or "rural" in d or "coastal" in d or "haor" in d or "freedom fighter" in d or "disability" in d:
        return {
            "condition_en": "Includes specific background or regional eligibility criteria — verify status.",
            "condition_bn": "নির্দিষ্ট আঞ্চলিক বা পারিবারিক যোগ্যতার শর্ত রয়েছে — প্রযোজ্যতা যাচাই করুন।",
            "doc_step_en": "Keep supporting background, regional residency, or official status documents ready.",
            "doc_step_bn": "প্রযোজ্য আঞ্চলিক, পারিবারিক বা সরকারি সনদপত্র প্রস্তুত রাখুন।"
        }
    if "writing" in d or "journalist" in d or "magazine" in d or "photography" in d:
        return {
            "condition_en": "Requires writing, journalism, arts, or media portfolio samples.",
            "condition_bn": "লেখালেখি, সাংবাদিকতা, শিল্পকলা বা মিডিয়া কাজের নমুনা প্রয়োজন।",
            "doc_step_en": "Select 2–3 published articles, creative pieces, or media work samples.",
            "doc_step_bn": "আপনার প্রকাশিত লেখা, সৃজনশীল কাজ বা মিডিয়া নমুনা সংগ্রহ করুন।"
        }
    return {
        "condition_en": None,
        "condition_bn": None,
        "doc_step_en": "Prepare a brief 1-paragraph statement explaining how you fit the scholarship focus.",
        "doc_step_bn": "বৃত্তির লক্ষ্যের সাথে আপনার সামঞ্জস্য তুলে ধরে ১ অনুচ্ছেদের একটি বিবৃতি লিখুন।"
    }

def build_checklist(record: Dict[str, Any]) -> List[Dict[str, str]]:
    extra = detect_additional_condition(record["description"])
    steps = [
        {
            "id": f"sch-{record['id']}-step-1",
            "title_en": f"Verify CGPA ({record['min_cgpa']:.2f}+) & Department ({department_display_label(record['department_raw'], 'en')})",
            "title_bn": f"CGPA ({record['min_cgpa']:.2f}+) ও বিভাগ ({department_display_label(record['department_raw'], 'bn')}) যাচাই করুন",
            "detail_en": "Download your latest official university grade sheet or academic transcript.",
            "detail_bn": "আপনার সর্বশেষ অফিসিয়াল একাডেমিক ট্রান্সক্রিপ্ট বা গ্রেড শিট সংগ্রহ করুন।"
        }
    ]

    if record["need_based"]:
        steps.append({
            "id": f"sch-{record['id']}-step-need",
            "title_en": "Prepare Financial Support Documentation",
            "title_bn": "আর্থিক সহায়তার প্রয়োজনীয় কাগজপত্র প্রস্তুত করুন",
            "detail_en": "Include family income certificate or hardship explanation required for need-based review.",
            "detail_bn": "নিড-বেজড যাচাইয়ের জন্য পারিবারিক আয়ের সনদ বা আর্থিক বিবরণী সংযুক্ত করুন।"
        })

    if record["gender"] == "Female":
        steps.append({
            "id": f"sch-{record['id']}-step-gender",
            "title_en": "Include Student ID / Female Applicant Verification",
            "title_bn": "শিক্ষার্থী আইডি ও ছাত্রী হিসেবে পরিচয় নিশ্চিত করুন",
            "detail_en": "Attach your valid student ID card confirming enrollment under female applicant eligibility.",
            "detail_bn": "বৈধ স্টুডেন্ট আইডি কার্ড সংযুক্ত করুন।"
        })

    steps.append({
        "id": f"sch-{record['id']}-step-focus",
        "title_en": "Prepare Criterion-Specific Supporting Evidence",
        "title_bn": "বৃত্তির নির্ধারিত শর্ত অনুযায়ী প্রমাণপত্র প্রস্তুত করুন",
        "detail_en": f"{extra['doc_step_en']} ({record['description']})",
        "detail_bn": f"{extra['doc_step_bn']} ({record['description']})"
    })

    steps.append({
        "id": f"sch-{record['id']}-step-submit",
        "title_en": f"Submit to {record['provider']} before {record['deadline']}",
        "title_bn": f"{record['deadline']} তারিখের আগে {record['provider']}-এ আবেদন জমা দিন",
        "detail_en": f"Confirm all attachments for the {format_bdt(record['amount_bdt'])} award prior to cutoff.",
        "detail_bn": f"{record['deadline']} শেষ তারিখের আগে {format_bdt(record['amount_bdt'])} বৃত্তির সম্পূর্ণ আবেদন জমা দিন।"
    })

    return steps


class ScholarshipEngine:
    def __init__(self, csv_path: Path = CSV_PATH):
        self.csv_path = csv_path
        self.records: List[Dict[str, Any]] = []
        self.load_dataset()
        self.scholarships = self.records

    def load_dataset(self):
        self.records = []
        if not self.csv_path.exists():
            self.scholarships = self.records
            return

        with open(self.csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    s_id = int(row.get("id", len(self.records) + 1))
                except ValueError:
                    s_id = len(self.records) + 1

                try:
                    min_cgpa = float(row.get("min_cgpa", 0.0))
                except ValueError:
                    min_cgpa = 0.0

                try:
                    amount = int(float(row.get("amount_bdt", 0)))
                except ValueError:
                    amount = 0

                dept_raw = row.get("department", "All").strip()
                depts = [d.strip() for d in dept_raw.split(";")] if ";" in dept_raw else [dept_raw]

                need_based = row.get("need_based", "no").strip().lower() in ["yes", "true", "1"]
                gender = row.get("gender", "All").strip()

                self.records.append({
                    "id": s_id,
                    "name": row.get("name", f"Scholarship {s_id}").strip(),
                    "provider": row.get("provider", "University").strip(),
                    "min_cgpa": min_cgpa,
                    "department_raw": dept_raw,
                    "departments": depts,
                    "need_based": need_based,
                    "gender": gender,
                    "amount_bdt": amount,
                    "deadline": row.get("deadline", "2027-12-31").strip(),
                    "description": row.get("description", "").strip()
                })
        self.scholarships = self.records

    def evaluate_scholarship(
        self,
        record: Dict[str, Any],
        student_cgpa: float,
        department: str,
        need_needed: bool,
        gender: str
    ) -> Dict[str, Any]:
        cgpa_diff = round(student_cgpa - record["min_cgpa"], 2)
        cgpa_gap = abs(cgpa_diff) if cgpa_diff < 0 else 0.0
        cgpa_passes = student_cgpa >= record["min_cgpa"]

        dept_passes = ("All" in record["departments"]) or (department in record["departments"]) or (department == "All")
        need_passes = (not record["need_based"]) or need_needed
        gender_passes = (record["gender"] == "All") or (gender == "All") or (gender.lower() == "female")

        gaps = []
        if not dept_passes:
            gaps.append({
                "type": "department",
                "label_en": f"Department: requires {department_display_label(record['department_raw'], 'en')} (yours: {department})",
                "label_bn": f"বিভাগ: {department_display_label(record['department_raw'], 'bn')} প্রয়োজন (আপনার বিভাগ: {department})"
            })
        if not cgpa_passes:
            gaps.append({
                "type": "cgpa",
                "cgpa_delta": round(cgpa_gap, 2),
                "label_en": f"CGPA: need +{cgpa_gap:.2f} more (requires {record['min_cgpa']:.2f}, yours is {student_cgpa:.2f})",
                "label_bn": f"CGPA: আরও +{cgpa_gap:.2f} প্রয়োজন (ন্যূনতম {record['min_cgpa']:.2f}, আপনার {student_cgpa:.2f})"
            })
        if not need_passes:
            gaps.append({
                "type": "need_based",
                "label_en": "Financial Need: restricted to students requiring financial support",
                "label_bn": "আর্থিক সহায়তা: শুধুমাত্র অসচ্ছল শিক্ষার্থীদের জন্য নির্ধারিত"
            })
        if not gender_passes:
            gaps.append({
                "type": "gender",
                "label_en": "Gender: open exclusively to Female students",
                "label_bn": "লিঙ্গ শর্ত: শুধুমাত্র নারী শিক্ষার্থীদের জন্য নির্ধারিত"
            })

        status = "ineligible"
        if not gaps:
            status = "eligible"
        elif dept_passes:
            only_cgpa_gap = (not cgpa_passes) and need_passes and gender_passes and (cgpa_gap <= NEAR_MISS_CGPA_WINDOW)
            only_single_non_dept_gap = cgpa_passes and ((not need_passes) or (not gender_passes)) and (len(gaps) == 1)
            small_cgpa_combo_gap = (not cgpa_passes) and (cgpa_gap <= NEAR_MISS_COMBO_WINDOW) and (len(gaps) == 2)

            if only_cgpa_gap or only_single_non_dept_gap or small_cgpa_combo_gap:
                status = "near_miss"

        # Construct grounded AI match reasons
        if cgpa_diff > 0:
            cgpa_clause_en = f"Your {student_cgpa:.2f} CGPA clears the {record['min_cgpa']:.2f} requirement by +{cgpa_diff:.2f}."
            cgpa_clause_bn = f"আপনার {student_cgpa:.2f} CGPA নির্ধারিত {record['min_cgpa']:.2f} শর্তের চেয়ে +{cgpa_diff:.2f} বেশি।"
        elif cgpa_diff == 0:
            cgpa_clause_en = f"Your {student_cgpa:.2f} CGPA meets the exact {record['min_cgpa']:.2f} minimum."
            cgpa_clause_bn = f"আপনার {student_cgpa:.2f} CGPA ঠিক {record['min_cgpa']:.2f} ন্যূনতম শর্ত পূরণ করে।"
        else:
            cgpa_clause_en = f"Requires {record['min_cgpa']:.2f} CGPA (+{cgpa_gap:.2f} above your {student_cgpa:.2f})."
            cgpa_clause_bn = f"ন্যূনতম {record['min_cgpa']:.2f} CGPA প্রয়োজন (আপনার {student_cgpa:.2f} থেকে +{cgpa_gap:.2f} বেশি)।"

        dept_clause_en = f"Open to all departments including {department}." if "All" in record["departments"] else f"Specifically targets {department_display_label(record['department_raw'], 'en')} including {department}."
        dept_clause_bn = f"{department}-সহ সকল বিভাগের জন্য উন্মুক্ত।" if "All" in record["departments"] else f"বিশেষভাবে {department}-সহ {department_display_label(record['department_raw'], 'bn')} বিভাগের জন্য নির্ধারিত।"

        need_clause_en = "Matches your financial support profile (need-based)." if record["need_based"] else "Open merit/activity award (financial need proof not required)."
        need_clause_bn = "আপনার আর্থিক সহায়তার প্রয়োজনের সাথে সামঞ্জস্যপূর্ণ (নিড-বেজড)।" if record["need_based"] else "মেধা ও কার্যক্রমভিত্তিক বৃত্তি (আর্থিক অসচ্ছলতার প্রমাণ বাধ্যতামূলক নয়)।"

        gender_clause_en = " Specifically reserves funding for female scholars." if record["gender"] == "Female" else ""
        gender_clause_bn = " বিশেষভাবে নারী শিক্ষার্থীদের জন্য সংরক্ষিত।" if record["gender"] == "Female" else ""

        match_reason_en = f"{cgpa_clause_en} {dept_clause_en} {need_clause_en}{gender_clause_en} Scope: \"{record['description']}\""
        match_reason_bn = f"{cgpa_clause_bn} {dept_clause_bn} {need_clause_bn}{gender_clause_bn} বিবরণ: \"{record['description']}\""

        missing_summary_en = " · ".join(g["label_en"] for g in gaps)
        missing_summary_bn = " · ".join(g["label_bn"] for g in gaps)

        return {
            "record": record,
            "status": status,
            "cgpa_margin": cgpa_diff,
            "cgpa_gap": cgpa_gap,
            "gaps": gaps,
            "match_reason_en": match_reason_en,
            "match_reason_bn": match_reason_bn,
            "missing_summary_en": missing_summary_en,
            "missing_summary_bn": missing_summary_bn,
            "checklist": build_checklist(record)
        }

    def evaluate_profile(
        self,
        cgpa: float,
        department: str,
        financial_support_needed: bool,
        gender: str = "All"
    ) -> Dict[str, Any]:
        all_evaluated = [
            self.evaluate_scholarship(r, cgpa, department, financial_support_needed, gender)
            for r in self.records
        ]

        eligible = [item for item in all_evaluated if item["status"] == "eligible"]
        near_miss = [item for item in all_evaluated if item["status"] == "near_miss"]

        total_potential_bdt = sum(item["record"]["amount_bdt"] for item in eligible)
        max_single_award = max((item["record"]["amount_bdt"] for item in eligible), default=0)

        return {
            "eligible": eligible,
            "near_miss": near_miss,
            "total_catalog": len(self.records),
            "total_potential_bdt": total_potential_bdt,
            "max_single_award_bdt": max_single_award
        }

    def export_csv_report(
        self,
        items: List[Dict[str, Any]],
        cgpa: float,
        department: str,
        need: bool,
        lang: str = "en"
    ) -> str:
        headers = [
            "ID",
            "Scholarship Name",
            "Provider",
            "Status",
            "Amount (BDT)",
            "Min CGPA",
            "Department",
            "Need-Based",
            "Gender",
            "Deadline",
            "Description",
            "Match Reason / Gap",
            "How to Apply Checklist"
        ]

        def escape(v: Any) -> str:
            val = str(v).replace('"', '""')
            return f'"{val}"'

        rows = []
        for item in items:
            rec = item["record"]
            reason = (item["match_reason_bn"] if lang == "bn" else item["match_reason_en"]) if item["status"] == "eligible" else (item["missing_summary_bn"] if lang == "bn" else item["missing_summary_en"])
            steps_str = " | ".join(f"{i+1}. {s['title_bn'] if lang == 'bn' else s['title_en']}" for i, s in enumerate(item["checklist"]))

            rows.append([
                rec["id"],
                rec["name"],
                rec["provider"],
                item["status"].upper(),
                rec["amount_bdt"],
                f"{rec['min_cgpa']:.2f}",
                rec["department_raw"],
                "yes" if rec["need_based"] else "no",
                rec["gender"],
                rec["deadline"],
                rec["description"],
                reason,
                steps_str
            ])

        meta = f"# Oiraboot Scholarship Atlas Report | Profile: CGPA={cgpa:.2f}, Dept={department}, FinancialNeed={'Yes' if need else 'No'}"
        header_line = ",".join(escape(h) for h in headers)
        data_lines = [",".join(escape(cell) for cell in r) for r in rows]
        return "\n".join([meta, header_line] + data_lines)
