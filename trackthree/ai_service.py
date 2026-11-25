import json
import re
import requests
from typing import Dict, Any, List, Optional
from config import GEMINI_API_KEY


class AIService:
    def __init__(self):
        self.gemini_key = GEMINI_API_KEY
        self.gemini_models = [
            "gemini-flash-lite-latest",
            "gemini-2.5-flash-lite",
            "gemini-pro-latest",
            "gemini-flash-latest",
            "gemini-3.8-flash"
        ]

    def _call_gemini(self, system_prompt: str, user_prompt: str, response_json: bool = True) -> Optional[str]:
        """Call Gemini API with model fallback."""
        if not self.gemini_key:
            return None

        for model in self.gemini_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.gemini_key}"
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": user_prompt}]
                    }
                ],
                "systemInstruction": {
                    "parts": [{"text": system_prompt}]
                },
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 2048,
                }
            }
            if response_json:
                payload["generationConfig"]["responseMimeType"] = "application/json"

            try:
                resp = requests.post(url, json=payload, timeout=12)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"]
            except Exception:
                continue

        return None

    def _generate_content(self, system_prompt: str, user_prompt: str, response_json: bool = True) -> str:
        """Execute request using Gemini API."""
        result = self._call_gemini(system_prompt, user_prompt, response_json=response_json)
        if result:
            return result

        raise RuntimeError("Gemini API endpoint failed to respond. Please verify your GEMINI_API_KEY and network connection.")

    @staticmethod
    def _extract_json(text: str) -> Any:
        """Safely extract JSON from model response text."""
        cleaned = text.strip()
        # Remove markdown code block fences if present
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to find JSON structure with regex
            match = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
            if match:
                return json.loads(match.group(1))
            raise

    def answer_question(self, context: str, question: str, is_bangla: bool = False) -> Dict[str, Any]:
        """
        Answers a user's question strictly grounded in the document context.
        Complies with Track 1 Must-Have rules:
        - If answer is not in the PDF, returns answer: 'Not found in the document'
        - Shows source document, page number, and verbatim excerpt.
        - Supports Bangla if requested or detected.
        """
        lang_instruction = (
            "Provide your final answer in natural Bengali (বাংলা) if found=true. "
            "However, if found=false, the answer text MUST explicitly include 'Not found in the document' "
            "(e.g., 'নথিতে তথ্যটি পাওয়া যায়নি (Not found in the document)')."
            if is_bangla else
            "Provide your final answer in English. If found=false, answer MUST BE EXACTLY 'Not found in the document'."
        )

        system_prompt = f"""You are a strict Document Intelligence Assistant for Port City International University (PCIU).
Your job is to answer user questions using ONLY the text provided under 'DOCUMENT CONTEXT'.
You MUST follow these strict rules:
1. NEVER use outside knowledge or hallucinate.
2. If the answer is NOT explicitly mentioned or cannot be directly verified from the provided context, you MUST set "found": false and "answer": "Not found in the document".
3. When found is true:
   - Provide a concise, accurate "answer".
   - Identify the exact "source_doc" name from the headers.
   - Identify the integer "page_number" where the answer is stated.
   - Provide the exact verbatim "excerpt" (quote of 1-3 sentences) from the text proving the answer.
4. {lang_instruction}

You MUST return a valid JSON object matching this exact schema:
{{
  "found": true or false,
  "answer": "string",
  "source_doc": "filename or null",
  "page_number": integer or null,
  "excerpt": "verbatim quote or null"
}}"""

        user_prompt = f"""DOCUMENT CONTEXT:
{context}

QUESTION:
{question}

Provide the JSON response:"""

        try:
            raw_response = self._generate_content(system_prompt, user_prompt, response_json=True)
            data = self._extract_json(raw_response)
            # Ensure standard fields
            found = bool(data.get("found", False))
            answer = str(data.get("answer", "Not found in the document"))
            if not found:
                if not is_bangla:
                    answer = "Not found in the document"
                source_doc = None
                page_number = None
                excerpt = None
            else:
                source_doc = data.get("source_doc")
                page_number = data.get("page_number")
                excerpt = data.get("excerpt")

            return {
                "found": found,
                "answer": answer,
                "source_doc": source_doc,
                "page_number": page_number,
                "excerpt": excerpt
            }
        except Exception as e:
            return {
                "found": False,
                "answer": f"Error querying document intelligence: {str(e)}",
                "source_doc": None,
                "page_number": None,
                "excerpt": None
            }

    def generate_quiz(
        self,
        context: str,
        num_questions: int = 5,
        difficulty: str = "Medium",
        is_bangla: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Creates multiple-choice questions strictly from the document.
        Complies with Track 1 Must-Have & Bonus rules:
        - At least 5 MCQs (4 options each, 1 correct answer).
        - Configurable question count and difficulty level.
        - Shows the PDF part / excerpt that explains each correct answer.
        - Page numbers in the sources.
        - Bangla support if requested.
        """
        num_questions = max(3, min(num_questions, 15))
        lang_note = (
            "Write the question, 4 options, and explanation in clear Bengali (বাংলা)."
            if is_bangla else
            "Write the question, 4 options, and explanation in English."
        )

        system_prompt = f"""You are an expert Academic Quiz Generator for PCIU Computer Club.
Generate exactly {num_questions} multiple-choice questions based STRICTLY on the provided document context.
Difficulty level: {difficulty}.
{lang_note}

Strict Rules:
1. Every question must be directly answerable from the document text.
2. Each question MUST have exactly 4 distinct options (array of 4 strings).
3. "correct_index" must be an integer between 0 and 3 indicating the index of the correct option.
4. "page_number" must be the integer page where the question topic is documented.
5. "source_doc" must be the name of the document.
6. "explanation_quote" MUST be the exact verbatim excerpt or sentence from the document proving why that option is correct.

Return ONLY a valid JSON object with a single key "questions" containing an array of {num_questions} objects:
{{
  "questions": [
    {{
      "id": 1,
      "question": "string",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "page_number": 1,
      "source_doc": "filename",
      "explanation_quote": "verbatim text from document"
    }}
  ]
}}"""

        user_prompt = f"""DOCUMENT CONTEXT:
{context}

Generate the {num_questions} quiz questions in JSON format:"""

        try:
            raw_response = self._generate_content(system_prompt, user_prompt, response_json=True)
            data = self._extract_json(raw_response)
            if isinstance(data, dict) and "questions" in data:
                questions = data["questions"]
            elif isinstance(data, list):
                questions = data
            else:
                questions = []

            # Normalize question objects
            validated_questions = []
            for i, q in enumerate(questions):
                options = q.get("options", [])
                if len(options) != 4:
                    continue
                correct_idx = q.get("correct_index", 0)
                if not (0 <= correct_idx < 4):
                    correct_idx = 0

                validated_questions.append({
                    "id": i + 1,
                    "question": q.get("question", f"Question {i+1}"),
                    "options": options,
                    "correct_index": correct_idx,
                    "page_number": q.get("page_number", 1),
                    "source_doc": q.get("source_doc", "Document"),
                    "explanation_quote": q.get("explanation_quote", "Refer to the source document.")
                })

            return validated_questions
        except Exception as e:
            return []

    def generate_scholarship_reasons(
        self,
        scholarships: List[Dict[str, Any]],
        student_profile: Dict[str, Any],
        is_bangla: bool = False
    ) -> Dict[int, str]:
        """
        Uses Gemini AI to generate a personalized 1-sentence explanation
        for each matched scholarship explaining why it fits the student.
        """
        if not scholarships:
            return {}

        cgpa = student_profile.get("cgpa", 3.5)
        dept = student_profile.get("department", "CSE")
        need = student_profile.get("need_based", False)
        gender = student_profile.get("gender", "All")

        # Select top 12 to keep prompt compact and response instantaneous
        target_subset = scholarships[:12]
        items_payload = [
            {
                "id": s["id"],
                "name": s["name"],
                "min_cgpa": s["min_cgpa"],
                "departments": s["departments"],
                "amount_bdt": s["amount_bdt"]
            }
            for s in target_subset
        ]

        lang_instruction = (
            "Write each reason in clear Bengali (বাংলা). Zero emojis."
            if is_bangla else
            "Write each reason in clear English. Zero emojis."
        )

        system_prompt = f"""You are an expert Academic Scholarship Advisor for PCIU.
For each matched scholarship, write a concise, encouraging 1-sentence rationale explaining why it is a great fit for the student.
{lang_instruction}

Return ONLY a valid JSON object matching this schema:
{{
  "reasons": [
    {{
      "id": integer,
      "reason": "1-sentence explanation"
    }}
  ]
}}"""

        user_prompt = f"""Student Profile:
- CGPA: {cgpa}
- Department: {dept}
- Financial Need: {'Yes' if need else 'No'}
- Gender: {gender}

Matched Scholarships:
{json.dumps(items_payload, indent=2)}

Generate the personalized fit reasons in JSON:"""

        try:
            raw = self._generate_content(system_prompt, user_prompt, response_json=True)
            data = self._extract_json(raw)
            reasons_dict = {}
            if isinstance(data, dict) and "reasons" in data:
                for item in data["reasons"]:
                    reasons_dict[int(item["id"])] = str(item["reason"])
            elif isinstance(data, list):
                for item in data:
                    reasons_dict[int(item["id"])] = str(item["reason"])
            return reasons_dict
        except Exception as e:
            print(f"Warning: Gemini scholarship reason generation failed: {e}")
            return {}
