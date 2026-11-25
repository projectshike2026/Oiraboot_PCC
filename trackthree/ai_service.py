import json
import re
import requests
import threading
from typing import Dict, Any, List, Optional, Tuple
from config import GEMINI_API_KEY, SECONDARY_GEMINI_KEY, GROQ_API_KEY


class AIService:
    def __init__(self):
        self.gemini_key = GEMINI_API_KEY
        self.secondary_gemini_key = SECONDARY_GEMINI_KEY
        self.groq_key = GROQ_API_KEY
        self.gemini_models = [
            "gemini-flash-lite-latest",
            "gemini-3.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-2.5-flash-preview-05-20",
        ]
        self.groq_model = "llama3-8b-8192"

    # ------------------------------------------------------------------ #
    # LOW-LEVEL CALLERS
    # ------------------------------------------------------------------ #

    def _call_gemini_with_key(
        self, api_key: str, system_prompt: str, user_prompt: str, response_json: bool = False
    ) -> Optional[str]:
        """Call Gemini API with an explicit key; tries each model in order."""
        if not api_key:
            return None
        for model in self.gemini_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = {
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 2048,
                },
            }
            if response_json:
                payload["generationConfig"]["responseMimeType"] = "application/json"
            try:
                resp = requests.post(url, json=payload, timeout=20)
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

    def _call_gemini(self, system_prompt: str, user_prompt: str, response_json: bool = True) -> Optional[str]:
        return self._call_gemini_with_key(self.gemini_key, system_prompt, user_prompt, response_json)

    def _call_groq(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        """Call Groq LLaMA for cross-verification synthesis."""
        if not self.groq_key:
            return None
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {self.groq_key}", "Content-Type": "application/json"}
        payload = {
            "model": self.groq_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 1800,
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=20)
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"]
        except Exception:
            pass
        return None

    def _generate_content(self, system_prompt: str, user_prompt: str, response_json: bool = True) -> str:
        result = self._call_gemini(system_prompt, user_prompt, response_json=response_json)
        if result:
            return result
        raise RuntimeError("Gemini API endpoint failed. Please verify your GEMINI_API_KEY.")

    @staticmethod
    def _extract_json(text: str) -> Any:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"(\{.*\}|\[.*\])", cleaned, re.DOTALL)
            if match:
                return json.loads(match.group(1))
            raise

    # ------------------------------------------------------------------ #
    # SCHOLARSHIP CHAT — SINGLE PASS
    # ------------------------------------------------------------------ #

    def scholarship_chat_single(
        self,
        scholarship_context: str,
        message: str,
        history: List[Dict],
        is_bangla: bool = False,
        lang: str = "en",
    ) -> str:
        """Single-pass grounded scholarship chat."""
        lang_note = (
            "Respond entirely in natural, fluent Bengali (বাংলা)."
            if is_bangla
            else "Respond in clear, professional English."
        )
        system_prompt = f"""You are the Oiraboot Scholarship Advisor for Bayview International University.
Your role: analyze the student's profile and suggest the BEST matching scholarships from the VERIFIED CATALOG below.

STRICT RULES:
1. ONLY use scholarship data provided in CATALOG DATA. Never invent names, amounts, or providers.
2. Suggest 5-6 scholarships that best match the student's CGPA, department, gender, and financial situation.
3. For each suggestion include: exact name, provider, BDT amount, min CGPA, eligible departments, and deadline.
4. If no scholarships match well, honestly say so and explain what CGPA/criteria adjustments would help.
5. {lang_note}
6. Be warm, encouraging, and analytical — not robotic.
7. Format suggestions clearly with numbers or bullet points.
8. If student asks a general question (not about their profile), answer from the catalog data only.

CATALOG DATA:
<<<
{scholarship_context}
>>>"""

        # Build conversation history
        history_text = ""
        for h in history[-8:]:  # last 8 turns for context
            role = "Student" if h["role"] == "user" else "Advisor"
            history_text += f"{role}: {h['content']}\n"

        user_prompt = f"""{history_text}Student: {message}

Advisor:"""

        result = self._call_gemini_with_key(self.gemini_key, system_prompt, user_prompt, response_json=False)
        if result:
            return result.strip()
        return "I'm having trouble connecting right now. Please try again in a moment."

    # ------------------------------------------------------------------ #
    # SCHOLARSHIP CHAT — EXTRA THINK (DUAL-PASS + GROQ SYNTHESIS)
    # ------------------------------------------------------------------ #

    def scholarship_chat_extensive(
        self,
        scholarship_context: str,
        message: str,
        history: List[Dict],
        is_bangla: bool = False,
    ) -> Tuple[str, str]:
        """
        Dual-pass AI cross-verification:
        1. Primary Gemini (key 1) → Pass A
        2. Secondary Gemini (key 2) → Pass B
        3. Groq LLaMA → synthesize A+B into final grounded answer
        Returns (final_answer, verification_note)
        """
        lang_note = (
            "Respond entirely in natural, fluent Bengali (বাংলা)."
            if is_bangla
            else "Respond in clear, professional English."
        )

        advisor_system = f"""You are a Senior Scholarship Analyst for Bayview International University.
Analyze the student's situation and suggest 5-6 best-fit scholarships strictly from the catalog below.
For each: exact name, provider, BDT amount, min CGPA, eligible departments, and deadline.
Be thorough and analytical. {lang_note}

CATALOG DATA:
<<<
{scholarship_context}
>>>"""

        history_text = ""
        for h in history[-6:]:
            role = "Student" if h["role"] == "user" else "Advisor"
            history_text += f"{role}: {h['content']}\n"

        user_prompt = f"""{history_text}Student: {message}

Provide your scholarship recommendations:"""

        # Thread workers for parallel calls
        results = {"pass_a": None, "pass_b": None}

        def call_primary():
            results["pass_a"] = self._call_gemini_with_key(
                self.gemini_key, advisor_system, user_prompt, response_json=False
            )

        def call_secondary():
            results["pass_b"] = self._call_gemini_with_key(
                self.secondary_gemini_key, advisor_system, user_prompt, response_json=False
            )

        t1 = threading.Thread(target=call_primary)
        t2 = threading.Thread(target=call_secondary)
        t1.start(); t2.start()
        t1.join(timeout=25); t2.join(timeout=25)

        pass_a = results["pass_a"] or ""
        pass_b = results["pass_b"] or ""

        # If both failed, fall back to single pass
        if not pass_a and not pass_b:
            return self.scholarship_chat_single(scholarship_context, message, history, is_bangla), ""

        # If only one succeeded
        if not pass_b:
            return pass_a.strip(), ""
        if not pass_a:
            return pass_b.strip(), ""

        # Groq synthesis
        synthesis_system = """You are a neutral academic advisor synthesizing two independent scholarship analyses.
Your task: compare the two analyses and produce ONE unified, accurate final recommendation.
Rules:
- Only include scholarships mentioned in BOTH analyses (high-confidence picks).
- If analyses agree on a scholarship → include it with confidence.
- If only one analysis mentions a scholarship → include it but flag for verification.
- Remove any duplicates; keep the 5-6 best recommendations.
- Preserve exact names, providers, BDT amounts, CGPA requirements, and deadlines.
- Do NOT mention 'Analysis A', 'Analysis B', 'two passes', model names, or APIs — just give the final answer.
- Output language must match the original student query language."""

        synthesis_user = f"""ANALYSIS A:
{pass_a[:1500]}

ANALYSIS B:
{pass_b[:1500]}

STUDENT QUERY: {message}

Synthesize into the best unified scholarship recommendation:"""

        final = self._call_groq(synthesis_system, synthesis_user)
        if not final:
            # Groq failed — use primary
            final = pass_a.strip()
            return final, ""

        verification_note = "✦ Cross-verified with dual AI analysis"
        return final.strip(), verification_note

    # ------------------------------------------------------------------ #
    # DOCUMENT INTELLIGENCE (Track 1 existing methods)
    # ------------------------------------------------------------------ #

    def answer_question(self, context: str, question: str, is_bangla: bool = False) -> Dict[str, Any]:
        lang_instruction = (
            "Provide your final answer in natural Bengali (বাংলা) if found=true. "
            "However, if found=false, the answer text MUST explicitly include 'Not found in the document' "
            "(e.g., 'নথিতে তথ্যটি পাওয়া যায়নি (Not found in the document)')."
            if is_bangla
            else "Provide your final answer in English. If found=false, answer MUST BE EXACTLY 'Not found in the document'."
        )

        system_prompt = f"""You are a strict Document Intelligence Assistant for Oiraboot.
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
                "excerpt": excerpt,
            }
        except Exception as e:
            return {
                "found": False,
                "answer": f"Error querying document intelligence: {str(e)}",
                "source_doc": None,
                "page_number": None,
                "excerpt": None,
            }

    def generate_quiz(
        self,
        context: str,
        num_questions: int = 5,
        difficulty: str = "Medium",
        is_bangla: bool = False,
    ) -> List[Dict[str, Any]]:
        num_questions = max(3, min(num_questions, 15))
        lang_note = (
            "Write the question, 4 options, and explanation in clear Bengali (বাংলা)."
            if is_bangla
            else "Write the question, 4 options, and explanation in English."
        )

        system_prompt = f"""You are an expert Academic Quiz Generator for Oiraboot.
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
                    "explanation_quote": q.get("explanation_quote", "Refer to the source document."),
                })

            return validated_questions
        except Exception:
            return []

    def generate_scholarship_reasons(
        self,
        scholarships: List[Dict[str, Any]],
        student_profile: Dict[str, Any],
        is_bangla: bool = False,
    ) -> Dict[int, str]:
        if not scholarships:
            return {}

        cgpa = student_profile.get("cgpa", 3.5)
        dept = student_profile.get("department", "CSE")
        need = student_profile.get("need_based", False)
        gender = student_profile.get("gender", "All")

        target_subset = scholarships[:12]
        items_payload = [
            {
                "id": s["id"],
                "name": s["name"],
                "min_cgpa": s["min_cgpa"],
                "departments": s["departments"],
                "amount_bdt": s["amount_bdt"],
            }
            for s in target_subset
        ]

        lang_instruction = (
            "Write each reason in clear Bengali (বাংলা). Zero emojis."
            if is_bangla
            else "Write each reason in clear English. Zero emojis."
        )

        system_prompt = f"""You are an expert Academic Scholarship Advisor for Oiraboot.
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
