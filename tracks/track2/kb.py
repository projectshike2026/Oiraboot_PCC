import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from config import Config
from core.errors import AppError
from core.textutil import normalise, tokenise, bm25

class KnowledgeBase:
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        self.raw_text: str = ""
        self.sections: List[Dict[str, Any]] = []
        self.contacts: Dict[str, str] = {
            "phone": "+880 1851-120791",
            "email": "admission@oiraboot.edu.bd",
            "address": "7-14, Nikunja Housing Society, South Khulshi, Chattogram - 4000",
            "website": "www.oiraboot.edu.bd"
        }
        self.numbers_in_kb: set[str] = set()
        self.load()

    def load(self):
        if not self.file_path.exists():
            return

        with open(self.file_path, "r", encoding="utf-8") as f:
            self.raw_text = normalise(f.read())

        if not self.raw_text:
            return

        # Extract contacts if present in text
        phone_match = re.search(r'(\+?880[\s\-]?\d{4}[\s\-]?\d{6}|\+?880[\s\-]?\d{2}[\s\-]?\d{7})', self.raw_text)
        if phone_match:
            self.contacts["phone"] = phone_match.group(1).strip()

        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', self.raw_text)
        if email_match:
            self.contacts["email"] = email_match.group(0).strip()

        # Cache all distinct numbers (integer, float, comma-separated) found in the KB for numeric grounding
        raw_nums = re.findall(r'\b\d{1,3}(?:,\d{2,3})*(?:\.\d+)?\b|\b\d+\b', self.raw_text)
        for n in raw_nums:
            cleaned = n.replace(",", "")
            self.numbers_in_kb.add(cleaned)
            self.numbers_in_kb.add(n)

        # Split text into sections based on major uppercase headings or double newlines
        raw_sections = re.split(r'\n(?=[A-Z\s]{4,}:|\d+\.\s+[A-Z])', self.raw_text)
        self.sections = []

        for idx, sec in enumerate(raw_sections):
            sec_clean = sec.strip()
            if sec_clean:
                self.sections.append({
                    "id": f"s{idx + 1}",
                    "text": sec_clean,
                    "tokens": tokenise(sec_clean)
                })

    def get_context_for_query(self, query: str) -> str:
        """Return full text if small, else retrieve top 6 sections via BM25."""
        if len(self.raw_text) <= Config.FULL_CONTEXT_CHARS or len(self.sections) <= 6:
            return self.raw_text

        q_toks = tokenise(query)
        scored = bm25(q_toks, self.sections)
        top = scored[:6]
        return "\n\n---\n\n".join(s["text"] for s in top)

kb = KnowledgeBase(Config.ADMISSION_DATA_PATH)
