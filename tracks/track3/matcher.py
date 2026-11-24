import datetime
from typing import List, Dict, Any, Tuple

NEAR_CGPA_GAP = 0.45

def calculate_fit_score(s: Dict[str, Any], cgpa: float, needs_support: bool) -> float:
    """Computes ranking fit score based on CGPA headroom, need alignment, and deadline."""
    score = 100.0

    # Need-based alignment bonus
    if s["need_based"] and needs_support:
        score += 20.0

    # CGPA Headroom bonus (up to 15 points)
    headroom = max(0.0, cgpa - s["min_cgpa"])
    score += min(headroom, 0.5) / 0.5 * 15.0

    # Urgent deadline penalty (-20 points if under 7 days)
    deadline_str = s.get("deadline")
    if deadline_str:
        try:
            dl_date = datetime.date.fromisoformat(deadline_str[:10])
            today = datetime.date.today()
            days_left = (dl_date - today).days
            if 0 <= days_left < 7:
                score -= 20.0
        except ValueError:
            pass

    return round(score, 2)

def match_scholarships(
    scholarships: List[Dict[str, Any]],
    cgpa: float,
    department: str,
    needs_support: bool,
    sort_by: str = "amount",
    lang: str = "en"
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Evaluates scholarships against student profile.
    Returns (matched_scholarships, almost_qualified_scholarships).
    """
    dept_clean = department.strip().upper()
    matched = []
    almost = []
    is_bn = (lang == "bn")

    for s in scholarships:
        s_copy = dict(s)
        depts_upper = [d.upper() for d in s_copy["departments"]]
        dept_ok = ("ALL" in depts_upper or dept_clean in depts_upper)
        cgpa_ok = (cgpa >= s_copy["min_cgpa"])
        need_ok = (not s_copy["need_based"] or needs_support)

        s_copy["fit_score"] = calculate_fit_score(s_copy, cgpa, needs_support)

        if dept_ok and cgpa_ok and need_ok:
            matched.append(s_copy)
        else:
            # Check for almost-qualifying (gap radar)
            failures = []
            if not cgpa_ok:
                gap = s_copy["min_cgpa"] - cgpa
                if gap <= NEAR_CGPA_GAP:
                    if is_bn:
                        failures.append(f"ন্যূনতম CGPA {s_copy['min_cgpa']:.2f} প্রয়োজন (আপনার {cgpa:.2f}, বাকি {gap:.2f})")
                    else:
                        failures.append(f"Needs CGPA {s_copy['min_cgpa']:.2f} (you have {cgpa:.2f}, {gap:.2f} short)")
                else:
                    failures.append("CGPA gap too large")
            if not dept_ok:
                if is_bn:
                    failures.append(f"শুধুমাত্র {', '.join(s_copy['departments'])} বিভাগের জন্য")
                else:
                    failures.append(f"Open to {', '.join(s_copy['departments'])} only")
            if not need_ok:
                if is_bn:
                    failures.append("আর্থিক সহায়তার প্রয়োজনীয়তা কোটা আবশ্যক")
                else:
                    failures.append("Requires demonstrated financial need")

            # Qualifies as near-match if only 1 failure and CGPA gap wasn't too large
            if len(failures) == 1 and failures[0] != "CGPA gap too large":
                s_copy["missing"] = failures
                almost.append(s_copy)

    # Sorting
    if sort_by == "deadline":
        matched.sort(key=lambda x: str(x.get("deadline", "9999-99-99")))
    elif sort_by == "fit":
        matched.sort(key=lambda x: x["fit_score"], reverse=True)
    else:  # amount (default)
        matched.sort(key=lambda x: x["amount_value"], reverse=True)

    almost.sort(key=lambda x: x["amount_value"], reverse=True)
    return matched, almost
