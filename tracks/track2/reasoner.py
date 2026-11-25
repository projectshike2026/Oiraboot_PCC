"""
Bilingual, strictly document-grounded reasoning engine for Track 2 (Admissions Desk).
Uses ONLY verified facts from data/admission.txt (Bayview International University - BIU)
via `tracks.track2.kb.kb`.
Supports bilingual (English & Bengali) multi-turn context, program comparisons, GPA/subject
eligibility reasoning, friendly explanation for unlisted courses/topics, and contact referral.
"""

import re
from typing import Dict, Any, List, Optional, Tuple
from core.textutil import detect_lang, tokenise
from tracks.track2.kb import kb


PROGRAMS: Dict[str, Dict[str, Any]] = {
    "cse": {
        "key": "cse",
        "name_en": "Computer Science and Engineering (CSE)",
        "name_bn": "কম্পিউটার সায়েন্স অ্যান্ড ইঞ্জিনিয়ারিং (CSE)",
        "degree_en": "B.Sc., 4 Years",
        "degree_bn": "বি.এসসি., ৪ বছর",
        "category": "engineering",
        "credits": "140",
        "tuition_per_credit": "4,500",
        "admission_fee": "15,000",
        "semester_fee": "6,000",
        "lab_fee": "3,000",
        "min_hsc_gpa": 3.50,
        "min_ssc_gpa": 3.00,
        "hsc_group": "Science (Math & Physics required)",
        "evidence": "- Computer Science and Engineering (CSE): B.Sc., 4 years, 140 credits",
        "evidence_fee": "BDT 4,500 per credit for CSE and EEE",
        "aliases": ["cse", "computer science", "computer", "সিএসই", "কম্পিউটার"],
    },
    "eee": {
        "key": "eee",
        "name_en": "Electrical and Electronic Engineering (EEE)",
        "name_bn": "ইলেকট্রিক্যাল অ্যান্ড ইলেকট্রনিক ইঞ্জিনিয়ারিং (EEE)",
        "degree_en": "B.Sc., 4 Years",
        "degree_bn": "বি.এসসি., ৪ বছর",
        "category": "engineering",
        "credits": "140",
        "tuition_per_credit": "4,500",
        "admission_fee": "15,000",
        "semester_fee": "6,000",
        "lab_fee": "3,000",
        "min_hsc_gpa": 3.50,
        "min_ssc_gpa": 3.00,
        "hsc_group": "Science (Math & Physics required)",
        "evidence": "- Electrical and Electronic Engineering (EEE): B.Sc., 4 years, 140 credits",
        "evidence_fee": "BDT 4,500 per credit for CSE and EEE",
        "aliases": ["eee", "electrical", "electronic", "ইইই", "ইলেকট্রিক্যাল"],
    },
    "ce": {
        "key": "ce",
        "name_en": "Civil Engineering (CE)",
        "name_bn": "সিভিল ইঞ্জিনিয়ারিং (CE)",
        "degree_en": "B.Sc., 4 Years",
        "degree_bn": "বি.এসসি., ৪ বছর",
        "category": "engineering",
        "credits": "150",
        "tuition_per_credit": "4,000",
        "admission_fee": "15,000",
        "semester_fee": "6,000",
        "lab_fee": "3,000",
        "min_hsc_gpa": 3.50,
        "min_ssc_gpa": 3.00,
        "hsc_group": "Science (Math & Physics required)",
        "evidence": "- Civil Engineering (CE): B.Sc., 4 years, 150 credits",
        "evidence_fee": "BDT 4,000 per credit for CE",
        "aliases": ["ce", "civil", "civil engineering", "সিভিল", "সিভিল ইঞ্জিনিয়ারিং"],
    },
    "bba": {
        "key": "bba",
        "name_en": "Business Administration (BBA)",
        "name_bn": "বিজনেস অ্যাডমিনিস্ট্রেশন (BBA)",
        "degree_en": "BBA, 4 Years",
        "degree_bn": "বিবিএ, ৪ বছর",
        "category": "general",
        "credits": "126",
        "tuition_per_credit": "3,500",
        "admission_fee": "15,000",
        "semester_fee": "6,000",
        "lab_fee": "0",
        "min_hsc_gpa": 3.00,
        "min_ssc_gpa": 3.00,
        "hsc_group": "Any group",
        "evidence": "- Business Administration (BBA): BBA, 4 years, 126 credits",
        "evidence_fee": "BDT 3,500 per credit for BBA and English",
        "aliases": ["bba", "business administration", "business", "বিবিএ", "ব্যবসা প্রশাসন"],
    },
    "english": {
        "key": "english",
        "name_en": "English",
        "name_bn": "ইংরেজি (English)",
        "degree_en": "B.A. (Hons), 4 Years",
        "degree_bn": "বি.এ. (অনার্স), ৪ বছর",
        "category": "general",
        "credits": "120",
        "tuition_per_credit": "3,500",
        "admission_fee": "15,000",
        "semester_fee": "6,000",
        "lab_fee": "0",
        "min_hsc_gpa": 3.00,
        "min_ssc_gpa": 3.00,
        "hsc_group": "Any group",
        "evidence": "- English: B.A. (Hons), 4 years, 120 credits",
        "evidence_fee": "BDT 3,500 per credit for BBA and English",
        "aliases": ["english", "ba in english", "b.a. english", "ইংরেজি", "ইংলিশ"],
    },
}

UNLISTED_COURSE_PATTERNS = [
    ("Bangla / Bengali", "বাংলা", ["bangla", "bengali", "বাংলা"]),
    ("Photography", "ফটোগ্রাফি", ["photography", "photo", "ফটোগ্রাফি"]),
    ("Pharmacy", "ফার্মেসি", ["pharmacy", "pharma", "ফার্মেসি"]),
    ("MBA / Master's", "এমবিএ / মাস্টার্স", ["mba", "emba", "masters", "master's", "msc", "phd", "মাস্টার্স", "এমবিএ"]),
    ("Textile Engineering", "টেক্সটাইল ইঞ্জিনিয়ারিং", ["textile", "টেক্সটাইল"]),
    ("Law / LL.B.", "আইন / এলএলবি", ["law", "llb", "ll.b", "আইন", "এলএলবি"]),
    ("Architecture", "আর্কিটেকচার", ["architecture", "আর্কিটেকচার", "স্থাপত্য"]),
    ("Mechanical Engineering", "মেকানিক্যাল ইঞ্জিনিয়ারিং", ["mechanical", "মেকানিক্যাল"]),
    ("Medical / MBBS", "মেডিকেল / এমবিবিএস", ["mbbs", "medical", "nursing", "মেডিকেল", "নার্সিং"]),
    ("Economics", "অর্থনীতি (Economics)", ["economics", "অর্থনীতি"]),
    ("Sociology", "সমাজবিজ্ঞান (Sociology)", ["sociology", "সমাজবিজ্ঞান"]),
    ("Journalism / Media", "সাংবাদিকতা", ["journalism", "media studies", "সাংবাদিকতা"]),
    ("Physics / Chemistry / Math Honors", "পদার্থবিজ্ঞান / রসায়ন / গণিত", ["physics honors", "chemistry", "পদার্থবিজ্ঞান নিয়ে", "রসায়ন"]),
    ("History / Islamic Studies", "ইতিহাস / ইসলামিক স্টাডিজ", ["history", "islamic studies", "ইতিহাস", "ইসলামিক"]),
    ("Art / Fine Arts", "চারুকলা / ফাইন আর্টস", ["fine arts", "arts course", "চারুকলা", "চিত্রকর্ম"]),
    ("Music / Performing Arts", "সংগীত", ["music", "গান", "সংগীত"]),
    ("Culinary / Cooking", "রন্ধনশিল্প", ["culinary", "cooking", "শেফ"]),
]

OUT_OF_SCOPE_TERMS = [
    "mars", "moon", "football", "cricket", "world cup", "visa", "canada", "london", "uk", "usa",
    "weather", "recipe", "joke", "poem", "pwned", "ignore previous", "system prompt", "jailbreak",
    "মঙ্গল", "ক্রিকেট", "ফুটবল", "ভিসা", "আবহাওয়া",
]


def _extract_departments(text: str) -> List[str]:
    low = f" {text.lower()} "
    found: List[str] = []
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
    if any(w in low for w in ["fee", "tuition", "cost", "money", "price", "credit", "breakdown", "taka", "bdt", "installment", "installments", "lab fee", "semester fee", "admission fee", "ফি", "খরচ", "টিউশন", "ক্রেডিট", "টাকা", "বেতন", "কিস্তি"]):
        intents.add("fees")
    if any(w in low for w in ["eligib", "gpa", "ssc", "hsc", "o level", "a level", "diploma", "background", "science", "commerce", "humanities", "arts", "business studies", "math", "physics", "qualify", "apply", "যোগ্য", "জিপিএ", "এসএসসি", "এইচএসসি", "বিজ্ঞান", "মানবিক", "বাণিজ্য", "আবেদন করতে পার"]):
        intents.add("eligibility")
    if any(w in low for w in ["step", "process", "how to apply", "procedure", "document", "test", "bkash", "form", "ভর্তির ধাপ", "প্রক্রিয়া", "কীভাবে", "কাগজপত্র", "পরীক্ষা", "বিকাশ", "ফর্ম", "নথি"]):
        intents.add("steps")
    if any(w in low for w in ["date", "deadline", "when", "last date", "start", "open", "may", "june", "july", "august", "spring", "fall", "তারিখ", "কবে", "শেষ সময়", "সময়সীমা", "শুরু"]):
        intents.add("dates")
    if any(w in low for w in ["waiver", "scholarship", "discount", "female", "woman", "women", "girl", "freedom fighter", "quota", "মওকুফ", "ছাড়", "বৃত্তি", "স্কলারশিপ", "মেয়ে", "নারী", "মুক্তিযোদ্ধা", "কোটা"]):
        intents.add("waivers")
    if any(w in low for w in ["facility", "facilities", "hostel", "hall", "dorm", "accommodation", "bus", "transport", "library", "wifi", "cafeteria", "sports", "prayer", "সুবিধা", "হোস্টেল", "থাকার", "বাস", "পরিবহন", "লাইব্রেরি", "ওয়াইফাই", "ক্যাফেটেরিয়া"]):
        intents.add("facilities")
        if any(w in low for w in ["bus", "transport", "hostel", "বাস", "পরিবহন", "হোস্টেল"]):
            intents.discard("fees")

    if any(w in low for w in ["application fee", "form fee", "bkash fee", "আবেদন ফি", "ফর্ম ফি"]):
        intents.add("steps")
        intents.discard("fees")
    if any(w in low for w in ["contact", "phone", "hotline", "email", "address", "campus", "location", "where", "office", "hour", "time", "যোগাযোগ", "ফোন", "হটলাইন", "ইমেইল", "ঠিকানা", "ক্যাম্পাস", "কোথায়", "অফিস", "কয়টা"]):
        intents.add("contact")
    if any(w in low for w in ["compare", "cheapest", "lowest", "highest", "most expensive", "affordable", "difference", "vs", "versus", "all program", "all department", "list program", "list department", "what program", "which program", "courses", "তুলনা", "সবচেয়ে কম", "সবচেয়ে বেশি", "সব বিভাগ", "সব প্রোগ্রাম", "কী কী বিষয়", "কোন কোন বিভাগ"]):
        intents.add("compare_or_list")
    if any(w in low for w in ["about", "bayview", "biu", "chattogram", "বিশ্ববিদ্যালয় সম্পর্কে"]):
        intents.add("about")
    if any(w in low for w in ["duration", "year", "credit", "semesters", "মেয়াদ", "কত বছর", "সেমিস্টার"]):
        intents.add("program_details")
    return intents


def _detect_language_switch_request(text: str) -> Optional[str]:
    """Detects meta requests like 'can you reply me in bangla?' (including typos like 'rply')."""
    low = text.lower()
    asks_lang = any(w in low for w in [
        "reply", "rply", "rely", "speak", "talk", "answer", "respond", "write", "chat", "explain",
        "bol", "bolo", "বল", "বলো", "উত্তর", "কথা", "লিখ", "বুঝা", "in bangla", "in bengali", "in english"
    ])
    if not asks_lang and len(low.split()) <= 3:
        asks_lang = any(w in low for w in ["bangla", "bengali", "english", "বাংলা", "ইংরেজি"])
    if not asks_lang:
        return None
    if any(w in low for w in ["bangla", "bengali", "bngla", "বাংলা"]):
        return "bn"
    if any(w in low for w in ["english", "ingreji", "ইংরেজি"]):
        return "en"
    return None


def _detect_unlisted_course(text: str) -> Optional[Tuple[str, str]]:
    """Checks if the user is asking about a specific course/program not offered in the official admission guide."""
    low = text.lower()
    for en_name, bn_name, kws in UNLISTED_COURSE_PATTERNS:
        if any(kw in low for kw in kws):
            return (en_name, bn_name)

    # General course question detection: require the word course/program/subject/degree/department
    course_q_match = re.search(r'(?:is there any|do you have|can i study|can i do|offer|any)\s+([a-zA-Z\s]{2,25})\s+(?:course|program|department|degree|subject|major)\b', low)
    if course_q_match:
        cand = course_q_match.group(1).strip()
        cand_clean = " ".join([w for w in cand.split() if w not in ["a", "an", "any", "the", "other"]])
        if cand_clean and not _extract_departments(cand_clean):
            return (cand_clean.title(), cand_clean)

    bn_q_match = re.search(r'([^\s]+)\s+(?:কোর্স|বিষয়|বিভাগ|পড়াশোনা|পড়া যাবে|করা যাবে)', text)
    if bn_q_match:
        cand_bn = bn_q_match.group(1).strip()
        if cand_bn and not _extract_departments(cand_bn):
            return (cand_bn, cand_bn)

    return None


def _build_unlisted_course_response(course_en: str, course_bn: str, is_bn: bool) -> Dict[str, Any]:
    phone = kb.contacts.get("phone", "01700-000000")
    email = kb.contacts.get("email", "admission@biu.example")
    address = kb.contacts.get("address", "Admission Office, Bayview International University, Chattogram")
    hours = kb.contacts.get("hours", "Sunday to Thursday, 9:00 AM to 5:00 PM")

    if is_bn:
        reply = (
            f"আমাদের আপলোডকৃত অফিসিয়াল ভর্তি নির্দেশিকায় **{course_bn}** সম্পর্কে কোনো তথ্য উল্লেখ নেই, "
            f"তাই আমি এর প্রাপ্যতা নিশ্চিত করতে পারছি না (বর্তমানে এই বিষয়টি আমাদের বিশ্ববিদ্যালয়ে চালু না থাকার সম্ভাবনাই বেশি)।\n\n"
            "**বর্তমানে বেভিউ ইন্টারন্যাশনাল ইউনিভার্সিটি (BIU)-তে ৫টি বিভাগে স্নাতক প্রোগ্রাম রয়েছে:**\n"
            "- **কম্পিউটার সায়েন্স অ্যান্ড ইঞ্জিনিয়ারিং (CSE):** বি.এসসি. (৪ বছর, ১৪০ ক্রেডিট)\n"
            "- **ইলেকট্রিক্যাল অ্যান্ড ইলেকট্রনিক ইঞ্জিনিয়ারিং (EEE):** বি.এসসি. (৪ বছর, ১৪০ ক্রেডিট)\n"
            "- **সিভিল ইঞ্জিনিয়ারিং (CE):** বি.এসসি. (৪ বছর, ১৫০ ক্রেডিট)\n"
            "- **বিজনেস অ্যাডমিনিস্ট্রেশন (BBA):** বিবিএ (৪ বছর, ১২৬ ক্রেডিট)\n"
            "- **ইংরেজি (English):** বি.এ. অনার্স (৪ বছর, ১২০ ক্রেডিট)\n\n"
            f"**{course_bn}** বা অন্য কোনো বিশেষ কোর্স সম্পর্কে নিশ্চিত হতে সরাসরি ভর্তি অফিসে যোগাযোগ করার পরামর্শ দিচ্ছি:\n"
            f"• **ফোন:** {phone}\n"
            f"• **ইমেইল:** {email}\n"
            f"• **ঠিকানা:** {address} ({hours})"
        )
        suggestions = ["৫টি প্রোগ্রামের ফি ও তথ্য দেখাও", "সিএসই ভর্তির যোগ্যতা কী?", "ভর্তির ধাপগুলো কী কী?"]
    else:
        reply = (
            f"Our official admission documentation does not contain any information regarding **{course_en}**, "
            f"so I cannot confirm its availability (it is likely not currently offered at Bayview International University).\n\n"
            "**Currently, Bayview International University offers undergraduate programs in 5 departments:**\n"
            "- **Computer Science and Engineering (CSE):** B.Sc., 4 years, 140 credits\n"
            "- **Electrical and Electronic Engineering (EEE):** B.Sc., 4 years, 140 credits\n"
            "- **Civil Engineering (CE):** B.Sc., 4 years, 150 credits\n"
            "- **Business Administration (BBA):** BBA, 4 years, 126 credits\n"
            "- **English:** B.A. (Hons), 4 years, 120 credits\n\n"
            f"For direct confirmation or inquiries about whether **{course_en}** or related coursework is planned, please contact our Admission Office directly:\n"
            f"• **Phone:** {phone}\n"
            f"• **Email:** {email}\n"
            f"• **Location:** {address} ({hours})"
        )
        suggestions = ["List all 5 programs & fees", "Tell me about English department", "What are the admission steps?"]

    return {
        "type": "answer",
        "reply": reply,
        "evidence": [
            "2. DEPARTMENTS AND PROGRAMS",
            "- Computer Science and Engineering (CSE): B.Sc., 4 years, 140 credits",
            "9. CONTACT"
        ],
        "suggestions": suggestions,
    }


def _is_greeting(text: str) -> bool:
    low = re.sub(r"[^\w\s\u0980-\u09FF]", "", text.lower()).strip()
    greetings = {
        "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening",
        "assalamu alaikum", "salam", "help", "হ্যালো", "হাই", "সালাম", "আসসালামু আলাইকুম", "সাহায্য"
    }
    return low in greetings


def _is_thanks(text: str) -> bool:
    low = re.sub(r"[^\w\s\u0980-\u09FF]", "", text.lower()).strip()
    return low in {"thanks", "thank you", "thank you very much", "ok", "okay", "got it", "ধন্যবাদ", "অনেক ধন্যবাদ", "ঠিক আছে"}


def _format_program_answer(prog: Dict[str, Any], is_bn: bool, focus_note: str = "") -> Dict[str, Any]:
    if is_bn:
        lines = [
            f"**{prog['name_bn']}** — অফিসিয়াল নির্দেশিকা অনুযায়ী তথ্য:",
            f"- **ডিগ্রি ও মেয়াদ:** {prog['degree_bn']}",
            f"- **মোট ক্রেডিট:** {prog['credits']} ক্রেডিট",
            f"- **ভর্তি ফি (এককালীন):** BDT {prog['admission_fee']}",
            f"- **প্রতি ক্রেডিট টিউশন ফি:** BDT {prog['tuition_per_credit']}",
            f"- **প্রতি সেমিস্টার ফি:** BDT {prog['semester_fee']}",
        ]
        if prog["lab_fee"] != "0":
            lines.append(f"- **প্রতি সেমিস্টার ল্যাব ফি:** BDT {prog['lab_fee']}")
        lines.append(f"- **এইচএসসি যোগ্যতা:** {prog['hsc_group']} থেকে ন্যূনতম জিপিএ {prog['min_hsc_gpa']:.2f}")
        lines.append(f"- **এসএসসি যোগ্যতা:** ন্যূনতম জিপিএ {prog['min_ssc_gpa']:.2f}")
        lines.append("- একজন শিক্ষার্থী সাধারণত প্রতি সেমিস্টারে ১২ থেকে ১৫ ক্রেডিট সম্পন্ন করে থাকে। ফি ৩টি কিস্তিতে পরিশোধযোগ্য।")
        if focus_note:
            lines.append(f"\n{focus_note}")
        other = "BBA" if prog["key"] != "bba" else "EEE"
        suggestions = [
            f"{other} বিভাগের ফি কত?",
            f"{prog['name_bn'].split('(')[-1].replace(')', '')} ভর্তির যোগ্যতা কী?",
            "টিউশন ফি ছাড় বা ওয়েভার সুবিধা কী কী?"
        ]
    else:
        lines = [
            f"**{prog['name_en']}** — Official Schedule:",
            f"- **Degree & Duration:** {prog['degree_en']}",
            f"- **Total Credits:** {prog['credits']} Credits",
            f"- **One-Time Admission Fee:** BDT {prog['admission_fee']}",
            f"- **Tuition Per Credit:** BDT {prog['tuition_per_credit']}",
            f"- **Semester Fee:** BDT {prog['semester_fee']} per semester",
        ]
        if prog["lab_fee"] != "0":
            lines.append(f"- **Lab Fee:** BDT {prog['lab_fee']} per semester")
        lines.append(f"- **HSC Eligibility:** Minimum GPA {prog['min_hsc_gpa']:.2f} ({prog['hsc_group']})")
        lines.append(f"- **SSC Eligibility:** Minimum GPA {prog['min_ssc_gpa']:.2f}")
        lines.append("- A student usually takes 12 to 15 credits in a semester. Fees can be paid in three installments each semester.")
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
    nums = [float(x) for x in re.findall(r"\b([1-5](?:\.\d{1,2})?)\b", low) if 1.0 <= float(x) <= 5.0]
    has_non_science = any(w in low for w in ["commerce", "business", "humanities", "arts", "বাণিজ্য", "ব্যবসায়", "মানবিক", "আর্টস"])
    has_science = any(w in low for w in ["science", "বিজ্ঞান"]) and not has_non_science

    if not nums and not has_non_science:
        return None

    target_dept = depts[0] if depts else "cse"
    prog = PROGRAMS.get(target_dept, PROGRAMS["cse"])
    is_eng = (prog["category"] == "engineering")

    reasons_en: List[str] = []
    reasons_bn: List[str] = []
    evidence = [
        "Engineering programs (CSE, EEE, CE): HSC (Science group) with a minimum GPA of 3.50 out of 5.00, and Mathematics and Physics must be passed.",
        "SSC GPA must be at least 3.00 for all programs."
    ]

    gpa_ok = True
    if len(nums) >= 2:
        ssc_gpa, hsc_gpa = nums[0], nums[1]
        req_hsc = 3.50 if is_eng else 3.00
        req_ssc = 3.00

        if ssc_gpa >= req_ssc and hsc_gpa >= req_hsc:
            gpa_ok = True
            reasons_en.append(f"Your SSC GPA ({ssc_gpa:.2f}) meets the minimum 3.00, and your HSC GPA ({hsc_gpa:.2f}) meets the required {req_hsc:.2f} for {prog['name_en']}.")
            reasons_bn.append(f"আপনার এসএসসি জিপিএ ({ssc_gpa:.2f}) ন্যূনতম ৩.০০ এবং এইচএসসি জিপিএ ({hsc_gpa:.2f}) {prog['name_bn']}-এর জন্য প্রয়োজনীয় {req_hsc:.2f} শর্ত পূরণ করে।")
        else:
            gpa_ok = False
            if ssc_gpa < req_ssc:
                reasons_en.append(f"Your SSC GPA ({ssc_gpa:.2f}) is below the minimum required 3.00.")
                reasons_bn.append(f"আপনার এসএসসি জিপিএ ({ssc_gpa:.2f}) ন্যূনতম ৩.০০ শর্ত পূরণ করে না।")
            if hsc_gpa < req_hsc:
                reasons_en.append(f"Your HSC GPA ({hsc_gpa:.2f}) is below the required {req_hsc:.2f} for {prog['name_en']}.")
                reasons_bn.append(f"আপনার এইচএসসি জিপিএ ({hsc_gpa:.2f}) {prog['name_bn']}-এর জন্য প্রয়োজনীয় {req_hsc:.2f}-এর চেয়ে কম।")

    elif len(nums) == 1:
        g = nums[0]
        req_hsc = 3.50 if is_eng else 3.00
        if g >= 5.00:
            reasons_en.append(f"A 5.00 GPA qualifies for admission and makes you eligible for a **50% tuition waiver** in the first semester.")
            reasons_bn.append(f"৫.০০ জিপিএ থাকলে আপনি ভর্তির যোগ্য হবেন এবং প্রথম সেমিস্টারে **৫০% টিউশন ফি ছাড়** (waiver) পাওয়ার সুযোগ রয়েছে।")
            evidence.append("Students with GPA 5.00 in HSC get a 50 percent tuition waiver in the first semester.")
        elif g >= 4.80:
            reasons_en.append(f"With an HSC GPA between 4.80 and 4.99, you are eligible for admission and a **30% tuition waiver** in the first semester.")
            reasons_bn.append(f"এইচএসসিতে ৪.৮০ থেকে ৪.৯৯ জিপিএ থাকলে আপনি প্রথম সেমিস্টারে **৩০% টিউশন ফি ছাড়** পাবেন।")
            evidence.append("Students with GPA 4.80 to 4.99 in HSC get a 30 percent tuition waiver in the first semester.")
        elif g >= req_hsc:
            reasons_en.append(f"Your GPA ({g:.2f}) satisfies the minimum requirement of {req_hsc:.2f} for {prog['name_en']}.")
            reasons_bn.append(f"আপনার জিপিএ ({g:.2f}) {prog['name_bn']}-এর জন্য নির্ধারিত ন্যূনতম {req_hsc:.2f} শর্ত পূরণ করে।")
        else:
            gpa_ok = False
            reasons_en.append(f"A GPA of {g:.2f} is below the {req_hsc:.2f} threshold required for {prog['name_en']}.")
            reasons_bn.append(f"জিপিএ {g:.2f} {prog['name_bn']}-এর জন্য প্রয়োজনীয় {req_hsc:.2f}-এর চেয়ে কম।")

    bg_ok = True
    if has_non_science and is_eng:
        bg_ok = False
        reasons_en.append(f"Engineering programs ({prog['name_en']}) strictly require an HSC **Science background** with passed Mathematics and Physics. Applicants from Commerce or Humanities can apply to **BBA** or **English**.")
        reasons_bn.append(f"ইঞ্জিনিয়ারিং প্রোগ্রামের ({prog['name_bn']}) জন্য গণিত ও পদার্থবিজ্ঞানসহ **বিজ্ঞান বিভাগ** থেকে এইচএসসি পাস বাধ্যতামূলক। বাণিজ্য বা মানবিক থেকে আপনি **BBA** বা **English** প্রোগ্রামে আবেদন করতে পারেন।")
        evidence.append("Engineering programs (CSE, EEE, CE): HSC (Science group) with a minimum GPA of 3.50 out of 5.00, and Mathematics and Physics must be passed.")
    elif has_non_science:
        reasons_en.append("BBA and English accept students from any HSC group (Science, Business Studies, or Humanities) with minimum GPA 3.00.")
        reasons_bn.append("বিবিএ এবং ইংরেজি বিভাগে যেকোনো বিভাগ (বিজ্ঞান, বাণিজ্য বা মানবিক) থেকে ন্যূনতম জিপিএ ৩.০০ থাকলে আবেদন করা যাবে।")
        evidence.append("BBA: HSC (any group) with a minimum GPA of 3.00 out of 5.00.")

    verdict_en = "**Eligibility Assessment:** Eligible." if (gpa_ok and bg_ok) else "**Eligibility Assessment:** Not eligible under the stated criteria."
    verdict_bn = "**যোগ্যতা বিশ্লেষণ:** আপনি আবেদন করার যোগ্য।" if (gpa_ok and bg_ok) else "**যোগ্যতা বিশ্লেষণ:** উল্লিখিত তথ্য অনুযায়ী শর্ত পূরণ হচ্ছে না।"

    if is_bn:
        reply = verdict_bn + "\n\n" + "\n".join(f"- {r}" for r in reasons_bn)
        suggestions = ["ভর্তির ৬টি ধাপ কী কী?", "সিএসই ও ইইই-র টিউশন ফি কত?", "আবেদনের শেষ তারিখ কবে?"]
    else:
        reply = verdict_en + "\n\n" + "\n".join(f"- {r}" for r in reasons_en)
        suggestions = ["What are the 6 admission steps?", "Compare CSE and BBA fees", "Important dates for Fall 2027"]

    return {
        "type": "answer",
        "reply": reply,
        "evidence": evidence[:2],
        "suggestions": suggestions,
    }


def _build_compare_or_list(text: str, depts: List[str], is_bn: bool) -> Dict[str, Any]:
    low = text.lower()
    if len(depts) >= 2:
        selected = [PROGRAMS[d] for d in depts[:3]]
        if is_bn:
            lines = ["**নির্বাচিত প্রোগ্রামগুলোর তুলনামূলক বিবরণ (বেভিউ ইন্টারন্যাশনাল ইউনিভার্সিটি):**"]
            for p in selected:
                lines.append(f"- **{p['name_bn']}**: {p['credits']} ক্রেডিট | প্রতি ক্রেডিট BDT {p['tuition_per_credit']} | সেমিস্টার ফি BDT {p['semester_fee']}")
            suggestions = ["ভর্তির যোগ্যতা কী?", "টিউশন ফি ছাড়ের নিয়ম কী?", "ভর্তির ৬টি ধাপ বলুন"]
        else:
            lines = ["**Program Comparison (Bayview International University Schedule):**"]
            for p in selected:
                lines.append(f"- **{p['name_en']}**: {p['credits']} Credits | BDT {p['tuition_per_credit']}/credit | Semester Fee BDT {p['semester_fee']}")
            suggestions = ["Eligibility requirements?", "What waivers are available?", "What are the admission steps?"]
        return {
            "type": "answer",
            "reply": "\n".join(lines),
            "evidence": [p["evidence_fee"] for p in selected[:2]],
            "suggestions": suggestions,
        }

    if any(w in low for w in ["cheapest", "lowest", "affordable", "minimum fee", "সবচেয়ে কম", "কম খরচ"]):
        eng = PROGRAMS["english"]
        bba = PROGRAMS["bba"]
        if is_bn:
            reply = (
                f"অফিসিয়াল ভর্তি নির্দেশিকা অনুযায়ী সবচেয়ে কম প্রতি-ক্রেডিট টিউশন ফি হলো **{bba['name_bn']}** এবং **{eng['name_bn']}** "
                f"উভয়েই **প্রতি ক্রেডিট BDT ৩,৫০০**। এর মধ্যে মোট ক্রেডিটের দিক থেকে **{eng['name_bn']}** সবচেয়ে কম ({eng['credits']} ক্রেডিট)। "
                "ইঞ্জিনিয়ারিং প্রোগ্রামগুলোতে (CSE ও EEE) প্রতি ক্রেডিট BDT ৪,৫০০ এবং CE-তে BDT ৪,০০০।"
            )
            suggestions = ["সবগুলো প্রোগ্রামের তালিকা দেখাও", "ইংরেজি বিভাগের যোগ্যতা কী?", "টিউশন ফি ছাড়ের নিয়ম কী?"]
        else:
            reply = (
                f"Based on the official schedule, the lowest tuition rate is **BDT 3,500 per credit** for both **{bba['name_en']}** and **{eng['name_en']}**. "
                f"Between them, **{eng['name_en']}** has the fewest total credits ({eng['credits']} credits). "
                "Engineering programs are BDT 4,500 per credit (CSE & EEE) and BDT 4,000 per credit (CE)."
            )
            suggestions = ["List all 5 undergraduate programs", "Eligibility for English?", "What tuition waivers apply?"]
        return {
            "type": "answer",
            "reply": reply,
            "evidence": ["BDT 3,500 per credit for BBA and English", "5. FEES (PER SEMESTER, ESTIMATED)"],
            "suggestions": suggestions,
        }

    if any(w in low for w in ["highest", "most expensive", "maximum fee", "সবচেয়ে বেশি", "বেশি খরচ"]):
        cse = PROGRAMS["cse"]
        eee = PROGRAMS["eee"]
        if is_bn:
            reply = (
                f"অফিসিয়াল নির্দেশিকা অনুযায়ী সর্বোচ্চ প্রতি-ক্রেডিট টিউশন ফি হলো **{cse['name_bn']}** এবং **{eee['name_bn']}**-এ: "
                "**প্রতি ক্রেডিট BDT ৪,৫০০** (সাথে প্রতি সেমিস্টার ল্যাব ফি BDT ৩,০০০)।"
            )
            suggestions = ["সব প্রোগ্রামের ফি দেখাও", "নারী শিক্ষার্থীদের ছাড় কত?", "ভর্তির তারিখগুলো কী কী?"]
        else:
            reply = (
                f"According to the official schedule, the highest tuition rate is for **{cse['name_en']}** and **{eee['name_en']}** "
                "at **BDT 4,500 per credit** (plus BDT 3,000 lab fee per semester)."
            )
            suggestions = ["List all undergraduate programs", "Female waiver details", "Important admission dates"]
        return {
            "type": "answer",
            "reply": reply,
            "evidence": ["BDT 4,500 per credit for CSE and EEE", "5. FEES (PER SEMESTER, ESTIMATED)"],
            "suggestions": suggestions,
        }

    # List all 5 programs
    all_progs = list(PROGRAMS.values())
    if is_bn:
        lines = ["**বেভিউ ইন্টারন্যাশনাল ইউনিভার্সিটির (BIU) ৫টি অনুমোদিত স্নাতক প্রোগ্রাম:**"]
        for idx, p in enumerate(all_progs, 1):
            lines.append(f"{idx}. **{p['name_bn']}** — {p['credits']} ক্রেডিট | প্রতি ক্রেডিট BDT {p['tuition_per_credit']}")
        lines.append("\n(এককালীন ভর্তি ফি BDT ১৫,০০০; প্রতি সেমিস্টার ফি BDT ৬,০০০; ইঞ্জিনিয়ারিং ল্যাব ফি BDT ৩,০০০)")
        suggestions = ["সিএসই এবং বিবিএ-র তুলনা করো", "ভর্তির যোগ্যতা কী?", "গুরুত্বপূর্ণ তারিখগুলো কী কী?"]
    else:
        lines = ["**All 5 Undergraduate Programs at Bayview International University:**"]
        for idx, p in enumerate(all_progs, 1):
            lines.append(f"{idx}. **{p['name_en']}** — {p['credits']} Credits | BDT {p['tuition_per_credit']} per credit")
        lines.append("\n(Admission fee BDT 15,000 one-time; Semester fee BDT 6,000; Engineering lab fee BDT 3,000)")
        suggestions = ["Compare CSE and BBA", "Eligibility requirements", "Important admission dates"]

    return {
        "type": "answer",
        "reply": "\n".join(lines),
        "evidence": ["2. DEPARTMENTS AND PROGRAMS", "- Computer Science and Engineering (CSE): B.Sc., 4 years, 140 credits"],
        "suggestions": suggestions,
    }


def _resolve_history_context(history: List[Dict[str, str]]) -> Tuple[Optional[str], set]:
    last_dept: Optional[str] = None
    last_intents: set = set()
    user_msgs = [m.get("content", "") for m in history if m.get("role") == "user"]
    if not user_msgs:
        return None, set()

    last_txt = user_msgs[-1]
    d = _extract_departments(last_txt)
    if d:
        last_dept = d[0]
    last_intents = _detect_intents(last_txt)

    if not last_intents and len(user_msgs) >= 2:
        last_intents = _detect_intents(user_msgs[-2])

    return last_dept, last_intents


def _session_preferred_lang(history: List[Dict[str, str]]) -> Optional[str]:
    for msg in reversed(history):
        if msg.get("role") == "user":
            sw = _detect_language_switch_request(msg.get("content", ""))
            if sw:
                return sw
    return None


def reason_admission_query(message: str, history: List[Dict[str, str]], ui_lang: str = "en") -> Dict[str, Any]:
    """
    Strictly grounded reasoning engine over data/admission.txt (Bayview International University).
    Returns JSON dict matching track2 contract: {type, reply, evidence, suggestions}.
    """
    clean = (message or "").strip()
    low = clean.lower()

    # Determine language
    lang_switch = _detect_language_switch_request(clean)
    hist_lang = _session_preferred_lang(history)
    if lang_switch:
        is_bn = (lang_switch == "bn")
    elif detect_lang(clean) == "bn":
        is_bn = True
    elif hist_lang:
        is_bn = (hist_lang == "bn")
    else:
        is_bn = (ui_lang == "bn")

    # 0. Meta-Conversational Language Switch (e.g. "can you rply me in bangla ??")
    if lang_switch:
        if lang_switch == "bn":
            return {
                "type": "answer",
                "reply": (
                    "হ্যাঁ, অবশ্যই! আমি বাংলায় কথা বলতে ও তথ্য দিতে প্রস্তুত।\n\n"
                    "বেভিউ ইন্টারন্যাশনাল ইউনিভার্সিটির (BIU) ভর্তি সংক্রান্ত যেকোনো বিষয়ে (যেমন: ৫টি স্নাতক প্রোগ্রাম—CSE, EEE, CE, BBA, English, টিউশন ফি, ভর্তির যোগ্যতা, ওয়েভার বা আবেদন প্রক্রিয়া) আপনি বাংলায় বা ইংরেজিতে প্রশ্ন করতে পারেন। আমি আপনাকে কীভাবে সাহায্য করতে পারি?"
                ),
                "evidence": ["BAYVIEW INTERNATIONAL UNIVERSITY - ADMISSION INFORMATION (SAMPLE)"],
                "suggestions": ["৫টি প্রোগ্রাম ও ফি দেখাও", "সিএসই ভর্তির যোগ্যতা কী?", "ভর্তির ৬টি ধাপ কী কী?"],
            }
        return {
            "type": "answer",
            "reply": (
                "Certainly! I will communicate in English from now on.\n\n"
                "Feel free to ask about our 5 undergraduate programs (CSE, EEE, CE, BBA, English), tuition fees, GPA eligibility, waivers, key dates, or admission steps at Bayview International University. How can I help you today?"
            ),
            "evidence": ["BAYVIEW INTERNATIONAL UNIVERSITY - ADMISSION INFORMATION (SAMPLE)"],
            "suggestions": ["List all programs & fees", "Eligibility requirements", "What are the admission steps?"],
        }

    # 1. Explicit Out-of-Scope (Prompt injection / irrelevant topics like Mars, cricket, etc.)
    if any(term in low for term in OUT_OF_SCOPE_TERMS):
        phone = kb.contacts.get("phone", "01700-000000")
        email = kb.contacts.get("email", "admission@biu.example")
        if is_bn:
            return {
                "type": "unknown",
                "reply": (
                    "আমাদের অফিসিয়াল ভর্তি নির্দেশিকায় এ বিষয়ে কোনো তথ্য নেই। নথির বাইরের বিষয়ে বিভ্রান্তি এড়াতে আমি কোনো অপ্রাসঙ্গিক বা অনুমানভিত্তিক তথ্য প্রদান করি না।\n\n"
                    f"ভর্তি সংক্রান্ত অনুমোদিত তথ্যের জন্য সরাসরি ভর্তি অফিসে যোগাযোগ করুন:\n• ফোন: {phone}\n• ইমেইল: {email}"
                ),
                "evidence": ["9. CONTACT"],
                "suggestions": ["ভর্তির ধাপগুলো কী কী?", "সিএসই বিভাগের টিউশন ফি কত?", "ভর্তির যোগ্যতা ও শেষ তারিখ"],
            }
        return {
            "type": "unknown",
            "reply": (
                "This topic is outside our official admission documentation. To ensure accuracy, I do not provide unverified information outside the records.\n\n"
                f"For official admission inquiries, please contact the Admission Office directly:\n• Phone: {phone}\n• Email: {email}"
            ),
            "evidence": ["9. CONTACT"],
            "suggestions": ["What are the admission steps?", "Tuition fee for CSE", "Eligibility and deadlines"],
        }

    # 2. Unlisted Course / Subject Inquiry (Friendly smart reasoning, zero hallucination)
    unlisted = _detect_unlisted_course(clean)
    if unlisted:
        return _build_unlisted_course_response(unlisted[0], unlisted[1], is_bn)

    # 3. Friendly Greeting or Thanks
    if _is_thanks(clean):
        return {
            "type": "answer",
            "reply": (
                "আপনাকেও অনেক ধন্যবাদ! ভর্তি সংক্রান্ত আরও কোনো তথ্য প্রয়োজন হলে নির্দ্বিধায় জিজ্ঞাসা করুন।"
                if is_bn else
                "You're very welcome! Please feel free to ask if you have any other questions regarding programs, fees, or admission."
            ),
            "evidence": ["BAYVIEW INTERNATIONAL UNIVERSITY - ADMISSION INFORMATION (SAMPLE)"],
            "suggestions": (
                ["সবগুলো প্রোগ্রাম ও ফি দেখাও", "ভর্তির ধাপগুলো কী কী?", "ক্যাম্পাসের সুযোগ-সুবিধা কী?"]
                if is_bn else
                ["List all programs & fees", "What are the admission steps?", "Campus facilities & hostel"]
            ),
        }

    if _is_greeting(clean):
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "স্বাগতম! আমি **বেভিউ ইন্টারন্যাশনাল ইউনিভার্সিটির (BIU) অ্যাডমিশন ডেস্ক হেল্পার**। অফিসিয়াল ভর্তি নির্দেশিকা অনুযায়ী আমি আপনাকে ৫টি স্নাতক প্রোগ্রামের ফি, ক্রেডিট, যোগ্যতা, ৬-ধাপের আবেদন প্রক্রিয়া, গুরুত্বপূর্ণ তারিখ ও ওয়েভার সম্পর্কে নির্ভুল তথ্য দিয়ে সহায়তা করতে পারি।\n\n"
                    "আপনি কী বিষয়ে জানতে চান?"
                ),
                "evidence": ["BAYVIEW INTERNATIONAL UNIVERSITY - ADMISSION INFORMATION (SAMPLE)"],
                "suggestions": ["৫টি প্রোগ্রাম ও ফি দেখাও", "সিএসই ভর্তির যোগ্যতা কী?", "ভর্তির ৬টি ধাপ কী কী?"],
            }
        return {
            "type": "answer",
            "reply": (
                "Welcome to the **Bayview International University (BIU) Admissions Desk**. I provide verified admissions guidance directly from our Official Admission Guide—covering our 5 undergraduate programs, tuition rates, GPA eligibility, waivers, key dates, and enrollment steps.\n\n"
                "How may I assist your application today?"
            ),
            "evidence": ["BAYVIEW INTERNATIONAL UNIVERSITY - ADMISSION INFORMATION (SAMPLE)"],
            "suggestions": ["List all programs & fees", "Eligibility requirements", "What are the admission steps?"],
        }

    depts = _extract_departments(clean)
    intents = _detect_intents(clean)
    prev_dept, prev_intents = _resolve_history_context(history)

    # Multi-turn follow-up resolution (e.g. "And for BBA?", "বিবিএ এর কত?")
    is_followup = len(clean.split()) <= 6 and (
        any(w in low for w in ["and for", "what about", "how about", "and", "also", "এবং", "আর", "ওটার", "এটার"])
        or (len(depts) == 1 and not intents)
    )
    dept_specific_intents = {"fees", "eligibility", "program_details"}
    has_general_intent = any(i in intents for i in ["facilities", "steps", "dates", "contact", "about", "compare_or_list"])

    if depts:
        active_depts = depts
    elif prev_dept and (intents & dept_specific_intents) and not has_general_intent:
        active_depts = [prev_dept]
    else:
        active_depts = []

    if is_followup and depts and not intents and prev_intents:
        intents = prev_intents

    # 4. GPA / Background Eligibility Reasoning Check
    gpa_res = _evaluate_gpa_reasoning(clean, active_depts, is_bn)
    if gpa_res is not None:
        return gpa_res

    # 5. Comparison or All-Programs Overview
    if "compare_or_list" in intents or len(depts) >= 2:
        return _build_compare_or_list(clean, depts, is_bn)

    # 6. Clarify Vague Fee / Credit Queries without a Department
    is_broad_vague_fee = any(p in low for p in ["tell me about fee", "about fees", "fees?", "fee structure", "ফি সম্পর্কে", "ফি কত"])
    if ("fees" in intents or "program_details" in intents) and (not active_depts or (not depts and is_broad_vague_fee)):
        if is_bn:
            return {
                "type": "clarify",
                "reply": "আপনি কোন বিভাগের টিউশন ফি বা তথ্য জানতে চান? (আমাদের ৫টি বিভাগ: CSE, EEE, CE, BBA, অথবা English)",
                "evidence": [],
                "suggestions": ["CSE-এর টিউশন ফি কত?", "BBA-এর ফি কত?", "সব প্রোগ্রামের ফি দেখাও"],
            }
        return {
            "type": "clarify",
            "reply": "Which department's tuition fee would you like to check? (Our 5 departments: CSE, EEE, CE, BBA, or English)",
            "evidence": [],
            "suggestions": ["Tuition fee for CSE", "BBA fees", "List all programs & fees"],
        }

    # 7. Department-Specific Query
    if active_depts:
        prog = PROGRAMS[active_depts[0]]
        extra_note = ""
        if "eligibility" in intents:
            if prog["category"] == "engineering":
                extra_note = (
                    f"**ভর্তির যোগ্যতা:** এইচএসসিতে বিজ্ঞান বিভাগ থেকে ন্যূনতম জিপিএ ৩.৫০ (গণিত ও পদার্থবিজ্ঞান পাস আবশ্যক) এবং এসএসসিতে ন্যূনতম জিপিএ ৩.০০।"
                    if is_bn else
                    f"**Eligibility:** HSC (Science group) with minimum GPA 3.50 (Mathematics and Physics must be passed) and SSC minimum GPA 3.00."
                )
            else:
                extra_note = (
                    f"**ভর্তির যোগ্যতা:** এইচএসসিতে যেকোনো বিভাগ থেকে ন্যূনতম জিপিএ ৩.০০ এবং এসএসসিতে ন্যূনতম জিপিএ ৩.০০।"
                    if is_bn else
                    f"**Eligibility:** HSC (any group) with minimum GPA 3.00 and SSC minimum GPA 3.00."
                )
        elif "waivers" in intents:
            extra_note = (
                "**উপলব্ধ ছাড় (Waivers):** এইচএসসিতে জিপিএ ৫.০০ পেলে ১ম সেমিস্টারে ৫০% ছাড়, ৪.৮০–৪.৯৯ পেলে ৩০% ছাড়, ছাত্রীদের জন্য সকল সেমিস্টারে ১০% ছাড় (CGPA ৩.০০+ বজায় রাখলে), এবং মুক্তিযোদ্ধাদের সন্তানদের জন্য ২০% ছাড়।"
                if is_bn else
                "**Applicable Waivers:** 50% tuition waiver for HSC GPA 5.00 in 1st semester, 30% for GPA 4.80–4.99, 10% female waiver across all semesters (keeping CGPA >= 3.00), and 20% freedom fighter waiver."
            )
        return _format_program_answer(prog, is_bn, extra_note)

    # 8. Admission Steps (6 Steps in BIU doc)
    if "steps" in intents:
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "**বেভিউ ইন্টারন্যাশনাল ইউনিভার্সিটিতে ভর্তির ৬টি ধাপ:**\n"
                    "1. **ধাপ ১:** বিশ্ববিদ্যালয়ের ওয়েবসাইটে অনলাইন আবেদন ফর্ম পূরণ করুন।\n"
                    "2. **ধাপ ২:** বিকাশের (bKash) মাধ্যমে **১,০০০ টাকা** আবেদন ফি পরিশোধ করুন।\n"
                    "3. **ধাপ ৩:** প্রবেশপত্রে নির্ধারিত তারিখে ভর্তি পরীক্ষায় অংশগ্রহণ করুন (৬০ মিনিটে ৫০টি বহুনির্বাচনী প্রশ্ন: ইংরেজি, গণিত ও সাধারণ জ্ঞান)।\n"
                    "4. **ধাপ ৪:** বিশ্ববিদ্যালয়ের ওয়েবসাইটে ভর্তি পরীক্ষার ফলাফল যাচাই করুন (মেধা তালিকা অনুযায়ী নির্বাচিত শিক্ষার্থীদের প্রকাশ করা হয়)।\n"
                    "5. **ধাপ ৫:** ভর্তি অফিসে মূল সনদসমূহ (এসএসসি ও এইচএসসি সার্টিফিকেট, মার্কশিট, ২ কপি পাসপোর্ট সাইজ ছবি, এবং জাতীয় পরিচয়পত্র বা জন্মনিবন্ধন সনদ) জমা দিন।\n"
                    "6. **ধাপ ৬:** ভর্তি ফি পরিশোধ করে সেমিস্টারের কোর্স রেজিস্ট্রেশন সম্পন্ন করুন।"
                ),
                "evidence": [
                    "4. ADMISSION STEPS",
                    "Step 1: Fill in the online application form on the university website.",
                    "Step 2: Pay the application fee of BDT 1,000 by bKash."
                ],
                "suggestions": ["ভর্তির শেষ তারিখ কবে?", "সিএসই-এর টিউশন ফি কত?", "টিউশন ফি ছাড় কীভাবে পাবো?"],
            }
        return {
            "type": "answer",
            "reply": (
                "**6-Step Admission Process at Bayview International University:**\n"
                "1. **Step 1:** Fill in the online application form on the university website.\n"
                "2. **Step 2:** Pay the application fee of **BDT 1,000** by bKash.\n"
                "3. **Step 3:** Take the admission test on the date shown in your admit card (50 MCQ questions in 60 minutes: English, Mathematics, and General Knowledge).\n"
                "4. **Step 4:** Check the result on the website (selected students are listed by merit).\n"
                "5. **Step 5:** Submit original documents (SSC and HSC certificates, transcripts, 2 passport-size photos, National ID or birth certificate) at the Admission Office.\n"
                "6. **Step 6:** Pay the admission fee and register for courses."
            ),
            "evidence": [
                "4. ADMISSION STEPS",
                "Step 1: Fill in the online application form on the university website.",
                "Step 2: Pay the application fee of BDT 1,000 by bKash."
            ],
            "suggestions": ["What are the important dates?", "Tuition fee for CSE?", "Eligibility criteria"],
        }

    # 9. Important Dates (Fall 2027 Intake)
    if "dates" in intents:
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "**গুরুত্বপূর্ণ ভর্তি সময়সূচি (ফল ২০২৭ ইনটেক):**\n"
                    "- **আবেদন শুরু:** ১ মে ২০২৭ (1 May 2027)\n"
                    "- **আবেদনের শেষ তারিখ:** ৩০ জুন ২০২৭ (30 June 2027)\n"
                    "- **ভর্তি পরীক্ষা:** ৫ জুলাই ২০২৭ (5 July 2027)\n"
                    "- **ফলাফল প্রকাশ:** ৮ জুলাই ২০২৭ (8 July 2027)\n"
                    "- **ক্লাস শুরু:** ১ আগস্ট ২০২৭ (1 August 2027)\n\n"
                    "*(প্রতি বছর দুটি সেমিস্টারে ভর্তি নেওয়া হয়: স্প্রিং [জানুয়ারি] এবং ফল [জুলাই])*"
                ),
                "evidence": [
                    "7. IMPORTANT DATES (FALL 2027 INTAKE)",
                    "Application starts: 1 May 2027",
                    "Last date to apply: 30 June 2027"
                ],
                "suggestions": ["ভর্তির ধাপগুলো কী কী?", "সবগুলো প্রোগ্রামের তালিকা দেখাও", "ভর্তির যোগ্যতা কী?"],
            }
        return {
            "type": "answer",
            "reply": (
                "**Important Admission Dates (Fall 2027 Intake):**\n"
                "- **Application starts:** 1 May 2027\n"
                "- **Last date to apply:** 30 June 2027\n"
                "- **Admission test:** 5 July 2027\n"
                "- **Result publication:** 8 July 2027\n"
                "- **Classes start:** 1 August 2027\n\n"
                "*(Admission is open in two semesters every year: Spring [January] and Fall [July])*"
            ),
            "evidence": [
                "7. IMPORTANT DATES (FALL 2027 INTAKE)",
                "Application starts: 1 May 2027",
                "Last date to apply: 30 June 2027"
            ],
            "suggestions": ["What are the admission steps?", "List all programs & fees", "Eligibility requirements"],
        }

    # 10. General Eligibility Rules
    if "eligibility" in intents:
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "**ভর্তির ন্যূনতম যোগ্যতা নির্দেশিকা:**\n"
                    "- **এসএসসি শর্ত:** সব প্রোগ্রামের জন্যই এসএসসি-তে ন্যূনতম জিপিএ **৩.০০** থাকতে হবে।\n"
                    "- **ইঞ্জিনিয়ারিং প্রোগ্রাম (CSE, EEE, CE):** এইচএসসি (বিজ্ঞান বিভাগ) থেকে ন্যূনতম জিপিএ **৩.৫০** এবং গণিত ও পদার্থবিজ্ঞান পাস আবশ্যক।\n"
                    "- **সাধারণ প্রোগ্রাম (BBA ও English):** এইচএসসি (যেকোনো গ্রুপ) থেকে ন্যূনতম জিপিএ **৩.০০**।\n"
                    "- **ডিপ্লোমা বা এ-লেভেল:** ডিপ্লোমা বা এ-লেভেল সনদপ্রাপ্ত শিক্ষার্থীরাও আবেদন করতে পারবেন; ভর্তি অফিস প্রতিটি আবেদন স্বতন্ত্রভাবে মূল্যায়ন করে।"
                ),
                "evidence": [
                    "3. ELIGIBILITY",
                    "Engineering programs (CSE, EEE, CE): HSC (Science group) with a minimum GPA of 3.50 out of 5.00",
                    "SSC GPA must be at least 3.00 for all programs."
                ],
                "suggestions": ["আমার এসএসসি ৩.২ ও এইচএসসি ৩.৬, আমি কি CSE-তে আবেদন করতে পারব?", "সিএসই-এর ফি কত?", "ওয়েভার সুবিধা কী কী?"],
            }
        return {
            "type": "answer",
            "reply": (
                "**Official Eligibility Requirements:**\n"
                "- **SSC Requirement:** Minimum GPA **3.00** out of 5.00 for all programs.\n"
                "- **Engineering Programs (CSE, EEE, CE):** HSC (**Science group**) with a minimum GPA of **3.50**, with passed Mathematics and Physics.\n"
                "- **General Programs (BBA, English):** HSC (**any group**) with a minimum GPA of **3.00**.\n"
                "- **Diploma / A-Level:** Students with a diploma or A-Level certificate can apply; the Admission Office checks each case individually."
            ),
            "evidence": [
                "3. ELIGIBILITY",
                "Engineering programs (CSE, EEE, CE): HSC (Science group) with a minimum GPA of 3.50 out of 5.00",
                "SSC GPA must be at least 3.00 for all programs."
            ],
            "suggestions": ["With SSC 3.2 and HSC 3.6, am I eligible for CSE?", "Tuition fee for CSE?", "What tuition waivers exist?"],
        }

    # 11. Waivers & Scholarships
    if "waivers" in intents:
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "**টিউশন ফি ছাড় ও স্কলারশিপ (Waivers & Scholarships):**\n"
                    "- **এইচএসসি জিপিএ ৫.০০:** প্রথম সেমিস্টারে **৫০%** টিউশন ফি ছাড়।\n"
                    "- **এইচএসসি জিপিএ ৪.৮০ থেকে ৪.৯৯:** প্রথম সেমিস্টারে **৩০%** টিউশন ফি ছাড়।\n"
                    "- **নারী শিক্ষার্থী ছাড়:** সিজিপিএ ৩.০০ বা তার বেশি বজায় রাখলে সকল সেমিস্টারে **১০%** টিউশন ফি ছাড়।\n"
                    "- **মুক্তিযোদ্ধার সন্তান:** **২০%** টিউশন ফি ছাড়।\n"
                    "- **বিশেষ নিয়ম:** একসাথে কেবল একটি ছাড় গ্রহণ করা যাবে।"
                ),
                "evidence": [
                    "6. WAIVERS AND SCHOLARSHIPS",
                    "Students with GPA 5.00 in HSC get a 50 percent tuition waiver in the first semester.",
                    "Female students get a 10 percent tuition waiver in all semesters if they keep CGPA 3.00 or above."
                ],
                "suggestions": ["সিএসই-এর মোট খরচ কত?", "ভর্তির ধাপগুলো কী কী?", "ভর্তির শেষ তারিখ কবে?"],
            }
        return {
            "type": "answer",
            "reply": (
                "**Tuition Waivers and Scholarships:**\n"
                "- **HSC GPA 5.00:** **50%** tuition waiver in the first semester.\n"
                "- **HSC GPA 4.80 to 4.99:** **30%** tuition waiver in the first semester.\n"
                "- **Female Students:** **10%** tuition waiver in all semesters if CGPA 3.00 or above is maintained.\n"
                "- **Children of Freedom Fighters:** **20%** tuition waiver.\n"
                "- **Note:** Only one waiver can be taken at a time."
            ),
            "evidence": [
                "6. WAIVERS AND SCHOLARSHIPS",
                "Students with GPA 5.00 in HSC get a 50 percent tuition waiver in the first semester.",
                "Female students get a 10 percent tuition waiver in all semesters if they keep CGPA 3.00 or above."
            ],
            "suggestions": ["Tuition fee for CSE", "Eligibility requirements", "What are the admission steps?"],
        }

    # 12. Campus Facilities & Hostel & Bus
    if "facilities" in intents:
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "**ক্যাম্পাস সুযোগ-সুবিধা ও হোস্টেল তথ্য:**\n"
                    "- **ল্যাব ও লাইব্রেরি:** ফ্রি ওয়াইফাইসহ কম্পিউটার ল্যাব এবং সকাল ৯:০০ থেকে রাত ৮:০০ পর্যন্ত উন্মুক্ত লাইব্রেরি।\n"
                    "- **সুবিধাসমূহ:** ক্যাফেটেরিয়া, প্রার্থনাকক্ষ (Prayer Room), খেলার মাঠ এবং বিভিন্ন স্টুডেন্ট ক্লাব।\n"
                    "- **হোস্টেল সুবিধা:** ক্যাম্পাসের কাছে নারী শিক্ষার্থীদের জন্য আলাদা হোস্টেল সুবিধা রয়েছে। ছাত্রদের জন্য কোনো হোস্টেল নেই; ছাত্ররা চাইলে আশেপাশের অ্যাপার্টমেন্ট ভাড়া নিতে পারেন।\n"
                    "- **বাস সার্ভিস:** ক্যাম্পাস এবং শহরের প্রধান এলাকাগুলোর মধ্যে বিশ্ববিদ্যালয়ের বাস সার্ভিস চালু রয়েছে (বাস ফি: প্রতি মাসে ১,৫০০ টাকা)।"
                ),
                "evidence": [
                    "8. CAMPUS FACILITIES",
                    "A separate hostel facility for female students is available near the campus. A male hostel is not available.",
                    "A university bus service runs between the campus and the main city areas. The bus fee is BDT 1,500 per month."
                ],
                "suggestions": ["ভর্তির ধাপগুলো কী কী?", "সবগুলো প্রোগ্রামের তালিকা দেখাও", "ভর্তি অফিসের ফোন নাম্বার কী?"],
            }
        return {
            "type": "answer",
            "reply": (
                "**Campus Facilities, Hostel & Transportation:**\n"
                "- **Labs & Library:** Computer labs with free Wi-Fi, and a central library open from 9:00 AM to 8:00 PM.\n"
                "- **Amenities:** Cafeteria, prayer room, sports field, and student clubs.\n"
                "- **Hostel Facility:** A separate hostel facility for female students is available near the campus. A male hostel is NOT available (male students may rent nearby apartments).\n"
                "- **Bus Service:** A university bus service runs between the campus and main city areas (bus fee: BDT 1,500 per month)."
            ),
            "evidence": [
                "8. CAMPUS FACILITIES",
                "A separate hostel facility for female students is available near the campus. A male hostel is not available.",
                "A university bus service runs between the campus and the main city areas. The bus fee is BDT 1,500 per month."
            ],
            "suggestions": ["What are the admission steps?", "List all programs & fees", "Admission Office contact details"],
        }

    # 13. Contact & About
    if "contact" in intents or "about" in intents:
        phone = kb.contacts.get("phone", "01700-000000")
        email = kb.contacts.get("email", "admission@biu.example")
        if is_bn:
            return {
                "type": "answer",
                "reply": (
                    "**বেভিউ ইন্টারন্যাশনাল ইউনিভার্সিটি (BIU) ও ভর্তি অফিসের তথ্য:**\n"
                    "- **পরিচিতি:** বেভিউ ইন্টারন্যাশনাল ইউনিভার্সিটি চট্টগ্রামের একটি বেসরকারি বিশ্ববিদ্যালয়। এতে ৫টি বিভাগে আন্ডারগ্র্যাজুয়েট প্রোগ্রাম রয়েছে এবং প্রতি বছর স্প্রিং (জানুয়ারি) ও ফল (জুলাই) সেমিস্টারে ভর্তি নেওয়া হয়।\n"
                    "- **ভর্তি অফিস:** ভর্তি অফিস, বেভিউ ইন্টারন্যাশনাল ইউনিভার্সিটি, চট্টগ্রাম।\n"
                    "- **অফিস সময়:** রবিবার থেকে বৃহস্পতিবার, সকাল ৯:০০ – বিকাল ৫:০০।\n"
                    f"- **হটলাইন / ফোন:** {phone}\n"
                    f"- **ইমেইল:** {email}"
                ),
                "evidence": [
                    "1. ABOUT",
                    "Bayview International University (BIU) is a private university in Chattogram.",
                    "9. CONTACT"
                ],
                "suggestions": ["ভর্তির ধাপগুলো কী কী?", "৫টি প্রোগ্রাম ও ফি দেখাও", "গুরুত্বপূর্ণ তারিখগুলো কী কী?"],
            }
        return {
            "type": "answer",
            "reply": (
                "**Bayview International University & Admission Office:**\n"
                "- **About BIU:** A private university in Chattogram offering undergraduate programs in 5 departments. Admission opens twice a year: Spring (January) and Fall (July).\n"
                "- **Location:** Admission Office, Bayview International University, Chattogram.\n"
                "- **Office Hours:** Sunday to Thursday, 9:00 AM to 5:00 PM.\n"
                f"- **Phone:** {phone}\n"
                f"- **Email:** {email}"
            ),
            "evidence": [
                "1. ABOUT",
                "Bayview International University (BIU) is a private university in Chattogram.",
                "9. CONTACT"
            ],
            "suggestions": ["What are the admission steps?", "List all programs & fees", "Important admission dates"],
        }

    # 14. Fallback for unhandled queries: Polite explanation, no hallucination
    phone = kb.contacts.get("phone", "01700-000000")
    email = kb.contacts.get("email", "admission@biu.example")
    address = kb.contacts.get("address", "Admission Office, Bayview International University, Chattogram")
    hours = kb.contacts.get("hours", "Sunday to Thursday, 9:00 AM to 5:00 PM")

    if is_bn:
        reply = (
            "আমাদের আপলোডকৃত অফিসিয়াল ভর্তি নির্দেশিকায় এ বিষয়ে কোনো তথ্য উল্লেখ নেই। "
            "ভুল তথ্য এড়াতে আমি নথির বাইরের কোনো বিষয়ে অনুমানভিত্তিক উত্তর প্রদান করি না।\n\n"
            "সঠিক তথ্যের জন্য অনুগ্রহ করে সরাসরি ভর্তি অফিসে যোগাযোগ করুন:\n"
            f"• **ফোন:** {phone}\n"
            f"• **ইমেইল:** {email}\n"
            f"• **ঠিকানা:** {address} ({hours})"
        )
        suggestions = ["৫টি প্রোগ্রাম ও ফি দেখাও", "ভর্তির ৬টি ধাপ কী কী?", "ভর্তির যোগ্যতা ও শেষ তারিখ"]
    else:
        reply = (
            "I do not have specific information regarding this inquiry in our verified admission documentation. "
            "To prevent inaccurate guidance, I do not provide assumptions outside official records.\n\n"
            "For confirmed information, please contact the Admission Office directly:\n"
            f"• **Phone:** {phone}\n"
            f"• **Email:** {email}\n"
            f"• **Location:** {address} ({hours})"
        )
        suggestions = ["List all 5 programs & fees", "What are the admission steps?", "Eligibility and deadlines"]

    return {
        "type": "unknown",
        "reply": reply,
        "evidence": ["9. CONTACT"],
        "suggestions": suggestions,
    }
