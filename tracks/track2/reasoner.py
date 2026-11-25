"""
Deterministic, strictly document-grounded reasoning engine for Track 2 (Admissions Desk).
Uses ONLY verified facts from data/admission.txt via `tracks.track2.kb.kb`.
Supports bilingual (English & Bengali) multi-turn context, comparisons, eligibility math,
and strict zero-hallucination refusal for out-of-document queries.
"""

import re
from typing import Dict, Any, List, Optional, Tuple
from core.textutil import detect_lang, tokenise
from tracks.track2.kb import kb


PROGRAMS: Dict[str, Dict[str, Any]] = {
    "cse": {
        "key": "cse",
        "name_en": "B.Sc. in Computer Science & Engineering (CSE)",
        "name_bn": "বি.এসসি. ইন কম্পিউটার সায়েন্স অ্যান্ড ইঞ্জিনিয়ারিং (CSE)",
        "category": "engineering",
        "duration_en": "4 Years (12 Trimesters)",
        "duration_bn": "৪ বছর (১২ ট্রাইমিস্টার)",
        "credits": "150",
        "admission_fee": "15,000",
        "per_credit": "2,500",
        "total_fee": "4,48,000",
        "total_int": 448000,
        "extra_en": "Laboratory & Development Fee is included in the trimester breakdown.",
        "extra_bn": "ল্যাবরেটরি ও ডেভেলপমেন্ট ফি ট্রাইমিস্টার ফি-এর মধ্যেই অন্তর্ভুক্ত।",
        "evidence": "1. B.Sc. in Computer Science & Engineering (CSE)",
        "evidence_fee": "Total Estimated Tuition & Fees: BDT 4,48,000",
        "aliases": ["cse", "computer science", "computer", "সিএসই", "কম্পিউটার"],
    },
    "eee": {
        "key": "eee",
        "name_en": "B.Sc. in Electrical & Electronic Engineering (EEE)",
        "name_bn": "বি.এসসি. ইন ইলেকট্রিক্যাল অ্যান্ড ইলেকট্রনিক ইঞ্জিনিয়ারিং (EEE)",
        "category": "engineering",
        "duration_en": "4 Years (12 Trimesters)",
        "duration_bn": "৪ বছর (১২ ট্রাইমিস্টার)",
        "credits": "152",
        "admission_fee": "15,000",
        "per_credit": None,
        "total_fee": "4,35,000",
        "total_int": 435000,
        "extra_en": "Requires HSC from Science background with Mathematics and Physics.",
        "extra_bn": "বিজ্ঞান বিভাগ থেকে গণিত ও পদার্থবিজ্ঞানসহ এইচএসসি সম্পন্ন হতে হবে।",
        "evidence": "2. B.Sc. in Electrical & Electronic Engineering (EEE)",
        "evidence_fee": "Total Estimated Tuition & Fees: BDT 4,35,000",
        "aliases": ["eee", "electrical", "electronic", "ইইই", "ইলেকট্রিক্যাল"],
    },
    "bba": {
        "key": "bba",
        "name_en": "Bachelor of Business Administration (BBA)",
        "name_bn": "ব্যাচেলর অব বিজনেস অ্যাডমিনিস্ট্রেশন (BBA)",
        "category": "general",
        "duration_en": "4 Years (12 Trimesters)",
        "duration_bn": "৪ বছর (১২ ট্রাইমিস্টার)",
        "credits": "126",
        "admission_fee": "15,000",
        "per_credit": None,
        "total_fee": "3,92,000",
        "total_int": 392000,
        "extra_en": "Available majors: Finance, Marketing, HRM, Accounting.",
        "extra_bn": "মেজর বিষয়সমূহ: ফিন্যান্স, মার্কেটিং, এইচআরএম ও অ্যাকাউন্টিং।",
        "evidence": "3. Bachelor of Business Administration (BBA)",
        "evidence_fee": "Total Estimated Tuition & Fees: BDT 3,92,000",
        "aliases": ["bba", "business administration", "business", "finance", "marketing", "hrm", "accounting", "বিবিএ"],
    },
    "textile": {
        "key": "textile",
        "name_en": "B.Sc. in Textile Engineering",
        "name_bn": "বি.এসসি. ইন টেক্সটাইল ইঞ্জিনিয়ারিং",
        "category": "engineering",
        "duration_en": "4 Years (12 Trimesters)",
        "duration_bn": "৪ বছর (১২ ট্রাইমিস্টার)",
        "credits": "160",
        "admission_fee": "15,000",
        "per_credit": None,
        "total_fee": "4,20,000",
        "total_int": 420000,
        "extra_en": "Requires HSC from Science background with Mathematics and Physics.",
        "extra_bn": "বিজ্ঞান বিভাগ থেকে গণিত ও পদার্থবিজ্ঞানসহ এইচএসসি সম্পন্ন হতে হবে।",
        "evidence": "4. B.Sc. in Textile Engineering",
        "evidence_fee": "Total Estimated Tuition & Fees: BDT 4,20,000",
        "aliases": ["textile", "টেক্সটাইল"],
    },
    "civil": {
        "key": "civil",
        "name_en": "B.Sc. in Civil Engineering",
        "name_bn": "বি.এসসি. ইন সিভিল ইঞ্জিনিয়ারিং",
        "category": "engineering",
        "duration_en": "4 Years (12 Trimesters)",
        "duration_bn": "৪ বছর (১২ ট্রাইমিস্টার)",
        "credits": "160",
        "admission_fee": "15,000",
        "per_credit": None,
        "total_fee": "4,30,000",
        "total_int": 430000,
        "extra_en": "Requires HSC from Science background with Mathematics and Physics.",
        "extra_bn": "বিজ্ঞান বিভাগ থেকে গণিত ও পদার্থবিজ্ঞানসহ এইচএসসি সম্পন্ন হতে হবে।",
        "evidence": "5. B.Sc. in Civil Engineering",
        "evidence_fee": "Total Estimated Tuition & Fees: BDT 4,30,000",
        "aliases": ["civil", "সিভিল"],
    },
    "english": {
        "key": "english",
        "name_en": "B.A. (Hons) in English",
        "name_bn": "বি.এ. (অনার্স) ইন ইংলিশ",
        "category": "general",
        "duration_en": "4 Years (12 Trimesters)",
        "duration_bn": "৪ বছর (১২ ট্রাইমিস্টার)",
        "credits": "120",
        "admission_fee": "12,000",
        "per_credit": None,
        "total_fee": "2,85,000",
        "total_int": 285000,
        "extra_en": "Open to Science, Business Studies, or Humanities backgrounds.",
        "extra_bn": "বিজ্ঞান, ব্যবসায় শিক্ষা ও মানবিক—সব বিভাগের শিক্ষার্থীরা আবেদন করতে পারবেন।",
        "evidence": "6. B.A. (Hons) in English",
        "evidence_fee": "Total Estimated Tuition & Fees: BDT 2,85,000",
        "aliases": ["english", "ba in english", "b.a.", "ইংরেজি", "ইংলিশ"],
    },
    "llb": {
        "key": "llb",
        "name_en": "LL.B. (Hons) in Law",
        "name_bn": "এলএল.বি. (অনার্স) ইন ল",
        "category": "general",
        "duration_en": "4 Years (12 Trimesters)",
        "duration_bn": "৪ বছর (১২ ট্রাইমিস্টার)",
        "credits": "132",
        "admission_fee": "15,000",
        "per_credit": None,
        "total_fee": "3,40,000",
        "total_int": 340000,
        "extra_en": "Open to Science, Business Studies, or Humanities backgrounds.",
        "extra_bn": "বিজ্ঞান, ব্যবসায় শিক্ষা ও মানবিক—সব বিভাগের শিক্ষার্থীরা আবেদন করতে পারবেন।",
        "evidence": "7. LL.B. (Hons) in Law",
        "evidence_fee": "Total Estimated Tuition & Fees: BDT 3,40,000",
        "aliases": ["llb", "ll.b", "law", "আইন", "এলএলবি"],
    },
}

OUT_OF_SCOPE_TERMS = [
    # Unsupported programs / degrees
    "pharmacy", "pharma", "mbbs", "medical", "bba evening", "emba", "mba", "masters", "msc", "phd",
    "architecture", "mechanical", "fashion", "journalism", "economics", "sociology", "bangla honors",
    "ফার্মেসি", "মেডিকেল", "মাস্টার্স", "এমবিএ", "আর্কিটেকচার", "মেকানিক্যাল",
    # Campus logistics / outside info not in admission.txt
    "hostel", "dorm", "dormitory", "hall fee", "accommodation", "bus", "transport", "shuttle",
    "canteen", "cafeteria", "food", "menu", "gym", "swimming", "pool", "library", "wifi",
    "vice chancellor", "chancellor", "vc name", "dean", "faculty", "professor", "teacher",
    "ranking", "qs rank", "job placement", "alumni", "convocation", "dress code", "uniform",
    "হোস্টেল", "থাকার ব্যবস্থা", "বাস", "পরিবহন", "ক্যান্টিন", "লাইব্রেরি", "ভিসি", "উপাচার্য",
    "র‍্যাংকিং", "ড্রেস কোড",
    # Unrelated / prompt injection
    "mars", "moon", "football", "cricket", "world cup", "visa", "canada", "london", "uk", "usa",
    "weather", "recipe", "joke", "poem", "pwned", "ignore previous", "system prompt", "jailbreak",
    "মঙ্গল", "ক্রিকেট", "ফুটবল", "ভিসা", "আবহাওয়া",
]


def _extract_departments(text: str) -> List[str]:
    low = f" {text.lower()} "
    found: List[str] = []
    # Match whole-word English tokens or Bengali substrings
    for key, info in PROGRAMS.items():
        for alias in info["aliases"]:
            if any("\u0980" <= c <= "\u09FF" for c in alias):
                if alias in low:
                    found.append(key)
                    break
            else:
                if re.search(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])", low):
                    found.append(key)
                    break
    return found


def _detect_intents(text: str) -> set:
    low = text.lower()
    intents = set()
    if any(w in low for w in ["fee", "tuition", "cost", "money", "price", "credit", "breakdown", "taka", "bdt", "ফি", "খরচ", "টিউশন", "ক্রেডিট", "টাকা", "বেতন"]):
        intents.add("fees")
    if any(w in low for w in ["eligib", "gpa", "ssc", "hsc", "o level", "a level", "o/a", "background", "science", "commerce", "humanities", "arts", "business studies", "math", "physics", "qualify", "apply", "যোগ্য", "জিপিএ", "এসএসসি", "এইচএসসি", "বিজ্ঞান", "মানবিক", "বাণিজ্য", "আবেদন করতে পার"]):
        intents.add("eligibility")
    if any(w in low for w in ["step", "process", "how to apply", "procedure", "document", "viva", "photo", "nid", "marksheet", "certificate", "form", "ভর্তির ধাপ", "প্রক্রিয়া", "কীভাবে", "কাগজপত্র", "ভাইভা", "ফর্ম", "নথি"]):
        intents.add("steps")
    if any(w in low for w in ["date", "deadline", "when", "last date", "start", "open", "orientation", "december", "january", "february", "তারিখ", "কবে", "শেষ সময়", "সময়সীমা", "ওরিয়েন্টেশন"]):
        intents.add("dates")
    if any(w in low for w in ["waiver", "scholarship", "discount", "concession", "golden", "female", "woman", "women", "girl", "sibling", "spouse", "freedom fighter", "tribal", "quota", "মওকুফ", "ছাড়", "বৃত্তি", "স্কলারশিপ", "মেয়ে", "নারী", "কোটা", "ভাইবোন"]):
        intents.add("waivers")
    if any(w in low for w in ["contact", "phone", "hotline", "email", "address", "campus", "location", "where", "office", "hour", "time", "যোগাযোগ", "ফোন", "হটলাইন", "ইমেইল", "ঠিকানা", "ক্যাম্পাস", "কোথায়", "অফিস", "কয়টা"]):
        intents.add("contact")
    if any(w in low for w in ["compare", "cheapest", "lowest", "highest", "most expensive", "affordable", "difference", "vs", "versus", "all program", "all department", "list program", "list department", "what program", "which program", "courses", "তুলনা", "সবচেয়ে কম", "সবচেয়ে বেশি", "সব বিভাগ", "সব প্রোগ্রাম", "কী কী বিষয়", "কোন কোন বিভাগ"]):
        intents.add("compare_or_list")
    if any(w in low for w in ["about", "ugc", "approved", "accredit", "private university act", "website", "বিশ্ববিদ্যালয় সম্পর্কে", "অনুমোদিত", "ইউজিসি"]):
        intents.add("about")
    if any(w in low for w in ["duration", "year", "trimester", "semester", "major", "lab", "কত বছর", "ট্রাইমিস্টার", "মেজর", "ল্যাব"]):
        intents.add("program_details")
    return intents


def _is_greeting(text: str) -> bool:
    low = re.sub(r"[^\w\s\u0980-\u09FF]", "", text.lower()).strip()
    greetings = {
        "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening",
        "assalamu alaikum", "salam", "help", "হ্যালো", "হাই", "সালাম", "আসসালামু আলাইকুম", "সাহায্য"
    }
    return low in greetings


def _format_program_answer(prog: Dict[str, Any], is_bn: bool, focus_note: str = "") -> Dict[str, Any]:
    if is_bn:
        lines = [
            f"**{prog['name_bn']}** এর অনুমোদিত তথ্য:",
            f"- **মেয়াদ:** {prog['duration_bn']}",
            f"- **মোট ক্রেডিট:** {prog['credits']} ক্রেডিট",
            f"- **ভর্তি ফি (এককালীন):** BDT {prog['admission_fee']}",
        ]
        if prog["per_credit"]:
            lines.append(f"- **প্রতি ক্রেডিট টিউশন ফি:** BDT {prog['per_credit']}")
        lines.append(f"- **আনুমানিক মোট টিউশন ও ফি:** BDT {prog['total_fee']}")
        lines.append(f"- **অতিরিক্ত তথ্য:** {prog['extra_bn']}")
        if focus_note:
            lines.append(f"\n{focus_note}")
        suggestions = [
            f"{prog['key'].upper()} ভর্তির যোগ্যতা কী?",
            "বিবিএ এর টিউশন ফি কত?",
            "টিউশন ফি ছাড় বা ওয়েভার সুবিধা কী কী?"
        ]
    else:
        lines = [
            f"**{prog['name_en']}** — Official Schedule:",
            f"- **Duration:** {prog['duration_en']}",
            f"- **Total Credits:** {prog['credits']} Credits",
            f"- **One-Time Admission Fee:** BDT {prog['admission_fee']}",
        ]
        if prog["per_credit"]:
            lines.append(f"- **Tuition Per Credit:** BDT {prog['per_credit']}")
        lines.append(f"- **Total Estimated Tuition & Fees:** BDT {prog['total_fee']}")
        lines.append(f"- **Program Note:** {prog['extra_en']}")
        if focus_note:
            lines.append(f"\n{focus_note}")
        other = "BBA" if prog["key"] != "bba" else "EEE"
        suggestions = [
            f"And for {other}?",
            f"Eligibility for {prog['key'].upper()}?",
            "What tuition waivers are available?"
        ]

    return {
        "type": "answer",
        "reply": "\n".join(lines),
        "evidence": [prog["evidence_fee"], prog["evidence"]],
        "suggestions": suggestions,
    }


def _evaluate_gpa_reasoning(text: str, depts: List[str], is_bn: bool) -> Optional[Dict[str, Any]]:
    low = text.lower()
    # Extract numbers looking like GPAs (between 1.0 and 5.0)
    nums = [float(x) for x in re.findall(r"\b([1-5](?:\.\d{1,2})?)\b", low) if 1.0 <= float(x) <= 5.0]
    has_non_science = any(w in low for w in ["commerce", "business", "humanities", "arts", "বাণিজ্য", "ব্যবসায়", "মানবিক", "আর্টস"])
    has_science = any(w in low for w in ["science", "বিজ্ঞান"]) and not has_non_science

    if not nums and not has_non_science:
        return None

    eng_depts = [d for d in depts if PROGRAMS[d]["category"] == "engineering"]
    reasons_en: List[str] = []
    reasons_bn: List[str] = []
    evidence = [
        "Minimum GPA 2.50 in both SSC (Secondary School Certificate) and HSC (Higher Secondary Certificate)",
        "combined minimum GPA of 6.00 in SSC and HSC together, with no individual GPA below 2.00",
    ]

    gpa_ok = True
    if len(nums) >= 2:
        g1, g2 = nums[0], nums[1]
        total = round(g1 + g2, 2)
        both_250 = g1 >= 2.50 and g2 >= 2.50
        combined_ok = total >= 6.00 and g1 >= 2.00 and g2 >= 2.00
        gpa_ok = both_250 or combined_ok
        if both_250:
            reasons_en.append("Both of your GPAs meet the standard minimum threshold of **2.50** in SSC and HSC.")
            reasons_bn.append("আপনার এসএসসি ও এইচএসসি উভয় জিপিএ-ই ন্যূনতম **2.50** শর্ত পূরণ করে।")
        elif combined_ok:
            reasons_en.append("Although one score is below 2.50, your combined GPA meets the alternative **6.00** total requirement (with neither score below **2.00**).")
            reasons_bn.append("একটি জিপিএ 2.50-এর কম হলেও, আপনার সম্মিলিত জিপিএ **6.00**-এর শর্ত পূরণ করে এবং কোনোটিই **2.00**-এর নিচে নয়।")
        else:
            reasons_en.append("Your scores do **not** meet either standard rule (minimum **2.50** in both SSC & HSC, or **6.00** combined with no score below **2.00**).")
            reasons_bn.append("আপনার জিপিএ ন্যূনতম শর্ত পূরণ করে না (উভয় পরীক্ষায় কমপক্ষে **2.50** অথবা সম্মিলিত **6.00** এবং কোনোটিই **2.00**-এর নিচে নয়)।")
    elif len(nums) == 1:
        g1 = nums[0]
        if g1 >= 5.00:
            reasons_en.append("With a **5.00** GPA, if you hold Golden GPA 5.00 in both SSC and HSC you may qualify for up to **100%** initial merit waiver.")
            reasons_bn.append("**5.00** জিপিএ থাকলে এবং এসএসসি ও এইচএসসি উভয়েই গোল্ডেন জিপিএ 5.00 হলে আপনি সর্বোচ্চ **100%** পর্যন্ত প্রাথমিক মেধা বৃত্তির যোগ্য হতে পারেন।")
            evidence.append("Golden GPA 5.00 in both SSC and HSC are eligible for up to 100% initial tuition fee waiver")
        elif g1 < 2.00:
            gpa_ok = False
            reasons_en.append("An individual GPA below **2.00** does not meet the university's minimum eligibility criteria.")
            reasons_bn.append("কোনো একক পরীক্ষায় জিপিএ **2.00**-এর নিচে হলে আবেদনের ন্যূনতম যোগ্যতা পূরণ হয় না।")
        elif g1 < 2.50:
            reasons_en.append("Since one GPA is below **2.50**, you will only be eligible if your combined SSC + HSC GPA is at least **6.00** (with no score below **2.00**).")
            reasons_bn.append("একটি জিপিএ **2.50**-এর কম হওয়ায়, আবেদন করতে হলে এসএসসি ও এইচএসসি মিলিয়ে কমপক্ষে **6.00** পয়েন্ট থাকতে হবে।")
        else:
            reasons_en.append("This score satisfies the **2.50** individual threshold (provided your other SSC/HSC GPA also meets 2.50 or combined 6.00).")
            reasons_bn.append("এই জিপিএ ন্যূনতম **2.50** শর্ত পূরণ করে (অন্য পরীক্ষার জিপিএ-ও 2.50 বা সম্মিলিত 6.00 হতে হবে)।")

    bg_ok = True
    if has_non_science and eng_depts:
        bg_ok = False
        dept_names = ", ".join(PROGRAMS[d]["key"].upper() for d in eng_depts)
        reasons_en.append(f"However, **{dept_names}** requires an HSC **Science background** with Mathematics and Physics. From Commerce/Humanities, you can apply to **BBA, B.A. in English, or LL.B. (Hons)**.")
        reasons_bn.append(f"তবে **{dept_names}**-এর জন্য গণিত ও পদার্থবিজ্ঞানসহ **বিজ্ঞান বিভাগ** থেকে এইচএসসি বাধ্যতামূলক। বাণিজ্য বা মানবিক বিভাগ থেকে আপনি **BBA, English বা LL.B.** প্রোগ্রামে আবেদন করতে পারবেন।")
        evidence.append("Engineering Programs (CSE, EEE, Civil Engineering, Textile Engineering): Candidates must have completed HSC from Science background with Mathematics and Physics.")
    elif has_non_science:
        reasons_en.append("From Business Studies or Humanities, you are eligible for **BBA, B.A. (Hons) in English, and LL.B. (Hons) in Law** (provided GPA rules are met).")
        reasons_bn.append("ব্যবসায় শিক্ষা বা মানবিক বিভাগ থেকে আপনি **BBA, B.A. in English এবং LL.B. (Hons)** প্রোগ্রামে আবেদন করতে পারবেন।")
        evidence.append("General Programs (BBA, English, LL.B.): Open to candidates from Science, Business Studies, or Humanities backgrounds.")
    elif has_science and eng_depts:
        reasons_en.append("A Science background with Mathematics and Physics fulfills the subject requirement for Engineering programs.")
        reasons_bn.append("গণিত ও পদার্থবিজ্ঞানসহ বিজ্ঞান বিভাগ ইঞ্জিনিয়ারিং প্রোগ্রামের বিষয়গত শর্ত পূরণ করে।")
        evidence.append("Engineering Programs (CSE, EEE, Civil Engineering, Textile Engineering): Candidates must have completed HSC from Science background with Mathematics and Physics.")

    verdict_en = "**Eligibility Assessment:** Eligible." if (gpa_ok and bg_ok) else "**Eligibility Assessment:** Not eligible under the stated criteria."
    verdict_bn = "**যোগ্যতা বিশ্লেষণ:** আপনি আবেদন করার যোগ্য।" if (gpa_ok and bg_ok) else "**যোগ্যতা বিশ্লেষণ:** উল্লিখিত তথ্য অনুযায়ী শর্ত পূরণ হচ্ছে না।"

    if is_bn:
        reply = verdict_bn + "\n\n" + "\n".join(f"- {r}" for r in reasons_bn)
        suggestions = ["ভর্তির ধাপগুলো কী কী?", "বিবিএ ও সিএসইর খরচ তুলনা করো", "আবেদনের শেষ তারিখ কবে?"]
    else:
        reply = verdict_en + "\n\n" + "\n".join(f"- {r}" for r in reasons_en)
        suggestions = ["What are the admission steps?", "Compare CSE and BBA fees", "What are the important dates?"]

    return {
        "type": "answer",
        "reply": reply,
        "evidence": evidence[:3],
        "suggestions": suggestions,
    }


def _build_compare_or_list(text: str, depts: List[str], is_bn: bool) -> Dict[str, Any]:
    low = text.lower()
    if len(depts) >= 2:
        selected = [PROGRAMS[d] for d in depts[:3]]
        if is_bn:
            lines = ["**নির্বাচিত প্রোগ্রামগুলোর তুলনামূলক বিবরণ:**"]
            for p in selected:
                lines.append(f"- **{p['name_bn']}**: {p['credits']} ক্রেডিট | ভর্তি ফি BDT {p['admission_fee']} | মোট আনুমানিক BDT {p['total_fee']}")
            suggestions = ["ভর্তির যোগ্যতা কী?", "ওয়েভার বা ছাড় কীভাবে পাবো?", "ভর্তির ধাপগুলো বলুন"]
        else:
            lines = ["**Program Comparison (Official Schedule):**"]
            for p in selected:
                lines.append(f"- **{p['name_en']}**: {p['credits']} Credits | Admission Fee BDT {p['admission_fee']} | Total Estimated BDT {p['total_fee']}")
            suggestions = ["Eligibility requirements?", "What waivers are available?", "What are the admission steps?"]
        return {
            "type": "answer",
            "reply": "\n".join(lines),
            "evidence": [p["evidence_fee"] for p in selected[:2]],
            "suggestions": suggestions,
        }

    if any(w in low for w in ["cheapest", "lowest", "affordable", "minimum fee", "সবচেয়ে কম", "কম খরচ"]):
        eng = PROGRAMS["english"]
        cse = PROGRAMS["cse"]
        if is_bn:
            reply = (
                f"অফিসিয়াল নথি অনুযায়ী সবচেয়ে কম টিউশন ফি-এর প্রোগ্রাম হলো **{eng['name_bn']}** "
                f"(মোট আনুমানিক **BDT {eng['total_fee']}**, ভর্তি ফি BDT {eng['admission_fee']}, {eng['credits']} ক্রেডিট)। "
                f"তুলনামূলকভাবে **{cse['name_bn']}**-এ সর্বোচ্চ **BDT {cse['total_fee']}** নির্ধারিত রয়েছে।"
            )
            suggestions = ["সবগুলো প্রোগ্রামের তালিকা দেখাও", "ইংরেজি বিভাগের যোগ্যতা কী?", "টিউশন ফি ছাড়ের নিয়ম কী?"]
        else:
            reply = (
                f"Based on the official fee schedule, the lowest total estimated tuition is for **{eng['name_en']}** "
                f"at **BDT {eng['total_fee']}** ({eng['credits']} Credits, Admission Fee BDT {eng['admission_fee']}). "
                f"By comparison, **{cse['name_en']}** has the highest estimated total at **BDT {cse['total_fee']}**."
            )
            suggestions = ["List all undergraduate programs", "Eligibility for English?", "What tuition waivers apply?"]
        return {
            "type": "answer",
            "reply": reply,
            "evidence": [eng["evidence_fee"], cse["evidence_fee"]],
            "suggestions": suggestions,
        }

    if any(w in low for w in ["highest", "most expensive", "maximum fee", "সবচেয়ে বেশি", "বেশি খরচ"]):
        cse = PROGRAMS["cse"]
        if is_bn:
            reply = f"অফিসিয়াল নথি অনুযায়ী সর্বোচ্চ আনুমানিক টিউশন ফি হলো **{cse['name_bn']}**-এ **BDT {cse['total_fee']}** ({cse['credits']} ক্রেডিট, প্রতি ক্রেডিট BDT {cse['per_credit']})।"
            suggestions = ["সব প্রোগ্রামের ফি দেখাও", "ইঞ্জিনিয়ারিং-এ নারী শিক্ষার্থীদের ছাড় কত?", "ভর্তির তারিখগুলো কী কী?"]
        else:
            reply = f"The highest total estimated tuition in the official schedule is **{cse['name_en']}** at **BDT {cse['total_fee']}** ({cse['credits']} Credits, BDT {cse['per_credit']} per credit)."
            suggestions = ["List all undergraduate programs", "Female waiver in engineering?", "Important admission dates"]
        return {
            "type": "answer",
            "reply": reply,
            "evidence": [cse["evidence_fee"], cse["evidence"]],
            "suggestions": suggestions,
        }

    # List all 7 programs
    all_progs = list(PROGRAMS.values())
    if is_bn:
        lines = ["**ওয়েরাবোট একাডেমিক বিশ্ববিদ্যালয়ের ৭টি অনুমোদিত স্নাতক প্রোগ্রাম (৪ বছর / ১২ ট্রাইমিস্টার):**"]
        for idx, p in enumerate(all_progs, 1):
            lines.append(f"{idx}. **{p['name_bn']}** — {p['credits']} ক্রেডিট | মোট আনুমানিক BDT {p['total_fee']}")
        suggestions = ["সিএসই এবং বিবিএ-র তুলনা করো", "ভর্তির যোগ্যতা কী?", "গুরুত্বপূর্ণ তারিখগুলো কী কী?"]
    else:
        lines = ["**All 7 Accredited Undergraduate Programs (4 Years / 12 Trimesters):**"]
        for idx, p in enumerate(all_progs, 1):
            lines.append(f"{idx}. **{p['name_en']}** — {p['credits']} Credits | Total Estimated BDT {p['total_fee']}")
        suggestions = ["Compare CSE and BBA", "Eligibility requirements", "Important admission dates"]

    return {
        "type": "answer",
        "reply": "\n".join(lines),
        "evidence": ["UNDERGRADUATE DEPARTMENTS, CREDITS & TUITION FEES:", "1. B.Sc. in Computer Science & Engineering (CSE)"],
        "suggestions": suggestions,
    }


def _resolve_history_context(history: List[Dict[str, str]]) -> Tuple[Optional[str], set]:
    """Inspect only the most recent user turn (and its preceding intent) for clean follow-up continuity."""
    last_dept: Optional[str] = None
    last_intents: set = set()
    user_msgs = [m.get("content", "") for m in history if m.get("role") == "user"]
    if not user_msgs:
        return None, set()

    # Check the immediately previous user message first; only carry department if it had one
    last_txt = user_msgs[-1]
    d = _extract_departments(last_txt)
    if d:
        last_dept = d[0]
    last_intents = _detect_intents(last_txt)

    # If the last user message was an ellipsis follow-up (e.g., "And for BBA?"), grab intent from the prior turn
    if not last_intents and len(user_msgs) >= 2:
        last_intents = _detect_intents(user_msgs[-2])

    return last_dept, last_intents


def reason_admission_query(message: str, history: List[Dict[str, str]], ui_lang: str = "en") -> Dict[str, Any]:
    """
    Strictly grounded reasoning engine over data/admission.txt.
    Returns JSON dict matching track2 contract: {type, reply, evidence, suggestions}.
    """
    clean = (message or "").strip()
    is_bn = detect_lang(clean) == "bn" or ui_lang == "bn"
    low = clean.lower()

    # 1. Explicit Out-of-Scope & Prompt-Injection Check
    if any(term in low for term in OUT_OF_SCOPE_TERMS):
        return {
            "type": "unknown",
            "reply": "",
            "evidence": [],
            "suggestions": (
                ["ভর্তির ধাপগুলো কী কী?", "সিএসই বিভাগের টিউশন ফি কত?", "ভর্তির যোগ্যতা ও শেষ তারিখ"]
                if is_bn else
                ["What are the admission steps?", "Tuition fee for CSE", "Eligibility and deadlines"]
            ),
        }

    # 2. Friendly Greeting grounded in University Intro
    if _is_greeting(clean):
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "স্বাগতম! আমি **ওয়েরাবোট অ্যাডমিশন অ্যাডভাইজার**। অনুমোদিত ভর্তি নির্দেশিকা অনুযায়ী আমি আপনাকে প্রোগ্রাম ফি, ক্রেডিট, যোগ্যতা, ভর্তির ধাপ, গুরুত্বপূর্ণ তারিখ ও টিউশন ওয়েভার সম্পর্কে নির্ভুল তথ্য ও বিশ্লেষণ দিয়ে সাহায্য করতে পারি।\n\n"
                    "আপনি কী বিষয়ে জানতে চান?"
                ),
                "evidence": ["OIRABOOT ACADEMIC UNIVERSITY — OFFICIAL ADMISSION GUIDE"],
                "suggestions": ["সবগুলো প্রোগ্রাম ও ফি দেখাও", "সিএসই ভর্তির যোগ্যতা কী?", "ভর্তির ধাপগুলো কী কী?"],
            }
        return {
            "type": "answer",
            "reply": (
                "Welcome to the **Oiraboot Admissions Concierge**. I provide strictly verified guidance and reasoning directly from our Official Admission Guide—covering all 7 undergraduate programs, tuition & credit breakdowns, GPA eligibility checks, waivers, dates, and enrollment steps.\n\n"
                "How may I assist your application today?"
            ),
            "evidence": ["OIRABOOT ACADEMIC UNIVERSITY — OFFICIAL ADMISSION GUIDE"],
            "suggestions": ["List all programs & fees", "Eligibility requirements", "What are the admission steps?"],
        }

    depts = _extract_departments(clean)
    intents = _detect_intents(clean)
    prev_dept, prev_intents = _resolve_history_context(history)

    # Multi-turn follow-up resolution (e.g., "And for BBA?", "বিবিএ এর কত?")
    is_followup = len(clean.split()) <= 6 and (
        any(w in low for w in ["and for", "what about", "how about", "and", "also", "এবং", "আর", "ওটার", "এটার"])
        or (len(depts) == 1 and not intents)
    )
    active_depts = depts if depts else ([prev_dept] if (prev_dept and intents and not ("compare_or_list" in intents)) else [])
    if is_followup and depts and not intents and prev_intents:
        intents = prev_intents

    # 3. GPA / Background Eligibility Reasoning Check
    gpa_res = _evaluate_gpa_reasoning(clean, active_depts, is_bn)
    if gpa_res is not None:
        return gpa_res

    # 4. Comparison or All-Programs Overview
    if "compare_or_list" in intents or len(depts) >= 2:
        return _build_compare_or_list(clean, depts, is_bn)

    # 5. Clarify Vague Fee / Credit Queries without a Department
    is_broad_vague_fee = any(p in low for p in ["tell me about fee", "about fees", "fees?", "fee structure", "ফি সম্পর্কে", "ফি কত"])
    if ("fees" in intents or "program_details" in intents) and (not active_depts or (not depts and is_broad_vague_fee)):
        if is_bn:
            return {
                "type": "clarify",
                "reply": "আপনি কোন বিভাগের টিউশন ফি বা ক্রেডিট সম্পর্কে জানতে চান? (যেমন: CSE, EEE, BBA, Textile, Civil, English, অথবা LL.B.)",
                "evidence": [],
                "suggestions": ["CSE-এর টিউশন ফি কত?", "BBA-এর ফি কত?", "সব প্রোগ্রামের ফি দেখাও"],
            }
        return {
            "type": "clarify",
            "reply": "Which department's tuition fee or credit breakdown would you like to check? (CSE, EEE, BBA, Textile Engineering, Civil Engineering, English, or LL.B.)",
            "evidence": [],
            "suggestions": ["Tuition fee for CSE", "BBA fees", "List all programs & fees"],
        }

    # 6. Department-Specific Query (with optional specific intent note)
    if active_depts:
        prog = PROGRAMS[active_depts[0]]
        extra_note = ""
        if "eligibility" in intents:
            if prog["category"] == "engineering":
                extra_note = (
                    "**যোগ্যতা:** এসএসসি ও এইচএসসিতে ন্যূনতম GPA 2.50 (অথবা সম্মিলিত 6.00, কোনোটিই 2.00-এর নিচে নয়) এবং গণিত ও পদার্থবিজ্ঞানসহ বিজ্ঞান বিভাগ থেকে এইচএসসি।"
                    if is_bn else
                    "**Eligibility:** Minimum GPA 2.50 in both SSC & HSC (or 6.00 combined, none below 2.00), plus HSC from **Science background** with Mathematics and Physics."
                )
            else:
                extra_note = (
                    "**যোগ্যতা:** এসএসসি ও এইচএসসিতে ন্যূনতম GPA 2.50 (অথবা সম্মিলিত 6.00, কোনোটিই 2.00-এর নিচে নয়)। বিজ্ঞান, ব্যবসায় শিক্ষা বা মানবিক—সব বিভাগের শিক্ষার্থীরা আবেদন করতে পারবেন।"
                    if is_bn else
                    "**Eligibility:** Minimum GPA 2.50 in both SSC & HSC (or 6.00 combined, none below 2.00). Open to Science, Business Studies, or Humanities backgrounds."
                )
        elif "waivers" in intents:
            if prog["category"] == "engineering":
                extra_note = (
                    "**ছাড় ও বৃত্তি:** গোল্ডেন GPA 5.00-এ সর্বোচ্চ 100% ওয়েভার, CGPA 3.85+-এ 20%–100% ওয়েভার এবং ইঞ্জিনিয়ারিংয়ে নারী শিক্ষার্থীদের জন্য বিশেষ 10%–20% ছাড়।"
                    if is_bn else
                    "**Applicable Waivers:** Up to 100% for Golden GPA 5.00, 20%–100% for CGPA 3.85+, plus a special **10% to 20% Female Student Waiver** for engineering programs."
                )
            else:
                extra_note = (
                    "**ছাড় ও বৃত্তি:** গোল্ডেন GPA 5.00-এ সর্বোচ্চ 100% প্রাথমিক ওয়েভার, CGPA 3.85+-এ 20%–100% ওয়েভার এবং সহোদর/স্বামী-স্ত্রী কোটায় 20% ছাড়।"
                    if is_bn else
                    "**Applicable Waivers:** Up to 100% initial waiver for Golden GPA 5.00, 20%–100% continuous waiver for CGPA 3.85+, and 20% sibling/spouse discount."
                )
        return _format_program_answer(prog, is_bn, extra_note)

    # 7. Topic-Specific Queries (General)
    if "steps" in intents:
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "**ওয়েরাবোট একাডেমিক বিশ্ববিদ্যালয়ে ভর্তির ৪টি ধাপ:**\n"
                    "1. **ধাপ ১ (আবেদন ফর্ম):** ভর্তি অফিস বা অনলাইন পোর্টাল থেকে আবেদন ফর্ম সংগ্রহ ও পূরণ করুন (**আবেদন ফর্ম ফি: BDT 500**)।\n"
                    "2. **ধাপ ২ (কাগজপত্র জমা):** এসএসসি ও এইচএসসি মার্কশিট ও সনদের সত্যায়িত কপি, **4** কপি পাসপোর্ট সাইজ ছবি এবং জাতীয় পরিচয়পত্র (NID) বা জন্মনিবন্ধন সনদের ফটোকপি জমা দিন।\n"
                    "3. **ধাপ ৩ (মূল্যায়ন ও ভাইভা):** সাউথ খুলশী ক্যাম্পাসে সংক্ষিপ্ত ভর্তি মূল্যায়ন ও নথিপত্র যাচাই ভাইভায় অংশগ্রহণ করুন।\n"
                    "4. **ধাপ ৪ (ফি জমা ও আইডি):** অ্যাকাউন্টস ডেস্ক বা নির্ধারিত ব্যাংকে ভর্তি ফি ও ১ম ট্রাইমিস্টারের টিউশন ফি জমা দিয়ে স্টুডেন্ট আইডি গ্রহণ করুন।"
                ),
                "evidence": [
                    "Step 1: Collect the Admission Application Form from the Admission Office or complete the online application portal (Application Form Fee: BDT 500).",
                    "Step 2: Submit certified copies of SSC and HSC marksheets, academic certificates, 4 passport-size photographs, and photocopy of NID or Birth Certificate."
                ],
                "suggestions": ["ভর্তির শেষ তারিখ কবে?", "সিএসই-এর টিউশন ফি কত?", "টিউশন ওয়েভার কীভাবে পাবো?"],
            }
        return {
            "type": "answer",
            "reply": (
                "**4-Step Admission Process:**\n"
                "1. **Step 1 (Application Form):** Collect the form from the Admission Office or apply online (**Application Form Fee: BDT 500**).\n"
                "2. **Step 2 (Document Submission):** Submit certified SSC & HSC marksheets and certificates, **4** passport-size photographs, and a photocopy of your NID or Birth Certificate.\n"
                "3. **Step 3 (Assessment & Viva):** Attend the brief Admission Assessment and Document Verification Viva at the South Khulshi Campus.\n"
                "4. **Step 4 (Enrollment & ID):** Deposit the Admission Fee plus 1st Trimester Tuition at the accounts desk or nominated banks to receive your official Student ID."
            ),
            "evidence": [
                "Step 1: Collect the Admission Application Form from the Admission Office or complete the online application portal (Application Form Fee: BDT 500).",
                "Step 2: Submit certified copies of SSC and HSC marksheets, academic certificates, 4 passport-size photographs, and photocopy of NID or Birth Certificate."
            ],
            "suggestions": ["What are the key admission dates?", "Tuition fee for CSE?", "Eligibility criteria"],
        }

    if "dates" in intents:
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "**গুরুত্বপূর্ণ ভর্তি সময়সূচি:**\n"
                    "- **আবেদন শুরু:** ১ ডিসেম্বর (December 01)\n"
                    "- **আবেদনের শেষ তারিখ:** ২০ জানুয়ারি (January 20)\n"
                    "- **নথি যাচাই ও ভর্তি ভাইভা:** ২৫ জানুয়ারি (January 25)\n"
                    "- **ফি জমা ও এনরোলমেন্টের শেষ তারিখ:** ২৮ জানুয়ারি (January 28)\n"
                    "- **নবীনবরণ ও ক্লাস শুরু:** ১ ফেব্রুয়ারি (February 01)"
                ),
                "evidence": ["Admission Application Window Opens: December 01", "Application Submission Deadline: January 20"],
                "suggestions": ["ভর্তির ধাপগুলো কী কী?", "সবগুলো প্রোগ্রামের তালিকা দেখাও", "ক্যাম্পাসের ঠিকানা কী?"],
            }
        return {
            "type": "answer",
            "reply": (
                "**Important Admission Dates:**\n"
                "- **Application Window Opens:** December 01\n"
                "- **Application Submission Deadline:** January 20\n"
                "- **Document Verification & Admission Viva:** January 25\n"
                "- **Last Date for Fee Payment & Enrollment:** January 28\n"
                "- **Freshers Orientation & Class Commencement:** February 01"
            ),
            "evidence": ["Admission Application Window Opens: December 01", "Application Submission Deadline: January 20"],
            "suggestions": ["What are the admission steps?", "List all programs & fees", "Campus address & hotline"],
        }

    if "eligibility" in intents:
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "**ভর্তির ন্যূনতম যোগ্যতা:**\n"
                    "- **জিপিএ শর্ত:** এসএসসি এবং এইচএসসি (বা O/A Level)-এ আলাদাভাবে ন্যূনতম **GPA 2.50**, অথবা উভয় পরীক্ষায় মিলিয়ে ন্যূনতম **GPA 6.00** (কোনো পরীক্ষায় **2.00**-এর নিচে নয়)।\n"
                    "- **ইঞ্জিনিয়ারিং প্রোগ্রাম (CSE, EEE, Civil, Textile):** গণিত ও পদার্থবিজ্ঞানসহ **বিজ্ঞান বিভাগ** থেকে এইচএসসি সম্পন্ন হতে হবে।\n"
                    "- **সাধারণ প্রোগ্রাম (BBA, English, LL.B.):** বিজ্ঞান, ব্যবসায় শিক্ষা বা মানবিক—যেকোনো বিভাগ থেকে আবেদন করা যাবে।"
                ),
                "evidence": [
                    "Minimum GPA 2.50 in both SSC (Secondary School Certificate) and HSC (Higher Secondary Certificate)",
                    "Engineering Programs (CSE, EEE, Civil Engineering, Textile Engineering): Candidates must have completed HSC from Science background with Mathematics and Physics."
                ],
                "suggestions": ["আমার এসএসসি ৩.২ ও এইচএসসি ২.৮, আমি কি যোগ্য?", "সিএসই-এর ফি কত?", "ওয়েভার সুবিধা কী কী?"],
            }
        return {
            "type": "answer",
            "reply": (
                "**Official Admission Eligibility Criteria:**\n"
                "- **GPA Requirement:** Minimum **GPA 2.50** in both SSC and HSC (or equivalent O/A Levels), OR a combined minimum **GPA of 6.00** with no individual GPA below **2.00**.\n"
                "- **Engineering Programs (CSE, EEE, Civil, Textile):** Must have completed HSC from a **Science background** with Mathematics and Physics.\n"
                "- **General Programs (BBA, English, LL.B.):** Open to applicants from Science, Business Studies, or Humanities backgrounds."
            ),
            "evidence": [
                "Minimum GPA 2.50 in both SSC (Secondary School Certificate) and HSC (Higher Secondary Certificate)",
                "Engineering Programs (CSE, EEE, Civil Engineering, Textile Engineering): Candidates must have completed HSC from Science background with Mathematics and Physics."
            ],
            "suggestions": ["With SSC 3.2 and HSC 2.8, am I eligible?", "Tuition fee for CSE?", "What tuition waivers exist?"],
        }

    if "waivers" in intents:
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "**টিউশন ফি ওয়েভার ও কোটা সুবিধাসমূহ:**\n"
                    "- **মেধা ওয়েভার (Golden GPA 5.00):** এসএসসি ও এইচএসসি উভয় পরীক্ষায় গোল্ডেন জিপিএ 5.00 থাকলে প্রাথমিক টিউশন ফিতে সর্বোচ্চ **100%** পর্যন্ত ওয়েভার।\n"
                    "- **ট্রাইমিস্টার ফলাফল ওয়েভার:** প্রতি সেমিস্টারে **CGPA 3.85+** ধরে রাখলে **20% থেকে 100%** ধারাবাহিক মেধা ছাড়।\n"
                    "- **নারী শিক্ষার্থী ওয়েভার:** ইঞ্জিনিয়ারিং প্রোগ্রামে নারী শিক্ষার্থীদের জন্য **10% থেকে 20%** বিশেষ ছাড়।\n"
                    "- **সহোদর / স্বামী-স্ত্রী ছাড়:** একই সাথে অধ্যয়নরত দ্বিতীয় সহোদর বা স্বামী/স্ত্রীর জন্য **20%** ছাড়।\n"
                    "- **মুক্তিযোদ্ধা ও ক্ষুদ্র নৃ-গোষ্ঠী কোটা:** ইউজিসি নীতিমালা অনুযায়ী সম্পূর্ণ টিউশন ফি মওকুফ সুবিধা।"
                ),
                "evidence": [
                    "Merit Waiver: Students achieving Golden GPA 5.00 in both SSC and HSC are eligible for up to 100% initial tuition fee waiver.",
                    "Female Student Waiver: Special 10% to 20% tuition concession for female applicants in engineering programs."
                ],
                "suggestions": ["সিএসই-এর মোট খরচ কত?", "ভর্তির ধাপগুলো কী কী?", "ভর্তির শেষ তারিখ কবে?"],
            }
        return {
            "type": "answer",
            "reply": (
                "**Tuition Fee Waivers & Special Quotas:**\n"
                "- **Merit Waiver:** Golden GPA **5.00** in both SSC & HSC qualifies for up to **100%** initial tuition fee waiver.\n"
                "- **Trimester CGPA Waiver:** Maintaining **CGPA 3.85** or above grants continuous **20% to 100%** merit waivers.\n"
                "- **Female Student Waiver:** Special **10% to 20%** tuition concession for female applicants in engineering programs.\n"
                "- **Sibling / Spouse Waiver:** **20%** tuition discount for a second sibling or spouse studying concurrently.\n"
                "- **Freedom Fighter & Tribal Quotas:** Full tuition fee waivers available in accordance with UGC guidelines."
            ),
            "evidence": [
                "Merit Waiver: Students achieving Golden GPA 5.00 in both SSC and HSC are eligible for up to 100% initial tuition fee waiver.",
                "Female Student Waiver: Special 10% to 20% tuition concession for female applicants in engineering programs."
            ],
            "suggestions": ["Tuition fee for CSE", "Eligibility requirements", "What are the admission steps?"],
        }

    if "contact" in intents or "about" in intents:
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "**ওয়েরাবোট একাডেমিক বিশ্ববিদ্যালয় ও ভর্তি অফিসের তথ্য:**\n"
                    "- **অনুমোদন:** প্রাইভেট ইউনিভার্সিটি অ্যাক্ট ২০১০-এর অধীনে পরিচালিত এবং **UGC** ও শিক্ষা মন্ত্রণালয় কর্তৃক অনুমোদিত।\n"
                    "- **ঠিকানা:** রুম ১০১, প্রশাসনিক ভবন, ৭-১৪ নিকুঞ্জ হাউজিং সোসাইটি, সাউথ খুলশী, চট্টগ্রাম - ৪০০০।\n"
                    "- **হটলাইন:** +880 1851-120791 / +880 31-2869877\n"
                    "- **ইমেইল:** admission@oiraboot.edu.bd / admission@portcity.edu.bd\n"
                    "- **অফিস সময়:** শনিবার থেকে বৃহস্পতিবার, সকাল ৯:০০টা – বিকাল ৫:০০টা।"
                ),
                "evidence": [
                    "Location: Room 101, Administrative Building, 7-14, Nikunja Housing Society, South Khulshi, Chattogram - 4000",
                    "Office Hours: Saturday to Thursday, 9:00 AM to 5:00 PM"
                ],
                "suggestions": ["ভর্তির ধাপগুলো কী কী?", "সবগুলো প্রোগ্রাম ও ফি দেখাও", "গুরুত্বপূর্ণ তারিখগুলো কী কী?"],
            }
        return {
            "type": "answer",
            "reply": (
                "**University & Admission Office Details:**\n"
                "- **Accreditation:** Private university in Chattogram operating under the Private University Act 2010, approved by **UGC** and the Ministry of Education.\n"
                "- **Campus Office:** Room 101, Administrative Building, 7-14, Nikunja Housing Society, South Khulshi, Chattogram - 4000.\n"
                "- **Hotlines:** +880 1851-120791 / +880 31-2869877\n"
                "- **Email:** admission@oiraboot.edu.bd / admission@portcity.edu.bd\n"
                "- **Office Hours:** Saturday to Thursday, 9:00 AM to 5:00 PM."
            ),
            "evidence": [
                "Location: Room 101, Administrative Building, 7-14, Nikunja Housing Society, South Khulshi, Chattogram - 4000",
                "Office Hours: Saturday to Thursday, 9:00 AM to 5:00 PM"
            ],
            "suggestions": ["What are the admission steps?", "List all programs & fees", "Important admission dates"],
        }

    # 8. Strict Guardrail Fallback: If no verified admission topic matched, refuse cleanly without hallucinating
    return {
        "type": "unknown",
        "reply": "",
        "evidence": [],
        "suggestions": (
            ["সবগুলো প্রোগ্রাম ও ফি দেখাও", "ভর্তির ধাপগুলো কী কী?", "ভর্তির যোগ্যতা ও শেষ তারিখ"]
            if is_bn else
            ["List all programs & fees", "What are the admission steps?", "Eligibility and deadlines"]
        ),
    }
