import os
import io
import json
import unittest
from app import app, rag

class TrackOneTestSuite(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_01_index_page(self):
        """Test home page loads with 200 OK and renders template."""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        html = res.data.decode("utf-8")
        self.assertIn("Oiraboot", html)
        self.assertIn("Oiraboot Scholarship Advisor", html)
        self.assertIn("OONORI", html)

    def test_02_documents_api(self):
        """Test documents summary API."""
        res = self.client.get("/api/documents")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertGreaterEqual(data["count"], 1)
        self.assertGreaterEqual(data["total_pages"], 1)

    def test_03_in_context_chat(self):
        """Test chat returns answers with source document, page number, and excerpt."""
        res = self.client.post("/chat", json={
            "question": "What is Track 1 about according to the document?",
            "lang": "en"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertTrue(data["found"])
        self.assertTrue(len(data["answer"]) > 0)
        self.assertIsNotNone(data["source_doc"])
        self.assertEqual(data["page_number"], 1)
        self.assertIsNotNone(data["excerpt"])
        print(f"\n[Test Chat In-Context] Answer: {data['answer'][:80]}... | Page: {data['page_number']}")

    def test_04_out_of_context_refusal(self):
        """Test strict refusal 'Not found in the document' for out-of-document queries."""
        res = self.client.post("/chat", json={
            "question": "What is the distance from Earth to Mars?",
            "lang": "en"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertFalse(data["found"])
        self.assertEqual(data["answer"], "Not found in the document")
        print(f"[Test Chat Refusal] Status: {data['answer']}")

    def test_05_bangla_chat(self):
        """Test Bangla query support."""
        res = self.client.post("/chat", json={
            "question": "ট্র্যাক ১ এ কি কি ফিচার থাকতে হবে?",
            "lang": "bn"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertTrue(data["is_bangla"])
        print(f"[Test Chat Bangla] Answer: {data['answer'][:80]}...")

    def test_06_generate_quiz(self):
        """Test quiz generation with 5 questions, 4 options each, and citations."""
        res = self.client.post("/generate_quiz", json={
            "num_questions": 5,
            "difficulty": "Medium",
            "lang": "en"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["questions"]), 5)
        for q in data["questions"]:
            self.assertEqual(len(q["options"]), 4)
            self.assertIn(q["correct_index"], [0, 1, 2, 3])
            self.assertIsNotNone(q["page_number"])
            self.assertIsNotNone(q["explanation_quote"])
        print(f"[Test Generate Quiz] Generated {len(data['questions'])} questions with quotes & pages.")

    def test_07_submit_quiz_and_score(self):
        """Test quiz submission and scoring calculation."""
        sample_questions = [
            {
                "id": 1,
                "question": "Sample Question 1",
                "options": ["A", "B", "C", "D"],
                "correct_index": 1,
                "page_number": 1,
                "source_doc": "test.pdf",
                "explanation_quote": "Proof 1"
            },
            {
                "id": 2,
                "question": "Sample Question 2",
                "options": ["A", "B", "C", "D"],
                "correct_index": 2,
                "page_number": 1,
                "source_doc": "test.pdf",
                "explanation_quote": "Proof 2"
            }
        ]
        # User answers Q1 correctly (index 1), Q2 incorrectly (index 0)
        res = self.client.post("/submit_quiz", json={
            "questions": sample_questions,
            "answers": {"1": 1, "2": 0}
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["total"], 2)
        self.assertEqual(data["correct_count"], 1)
        self.assertEqual(data["percentage"], 50.0)
        self.assertTrue(data["results"][0]["is_correct"])
        self.assertFalse(data["results"][1]["is_correct"])
        print(f"[Test Quiz Submit] Score: {data['correct_count']}/{data['total']} ({data['percentage']}%)")

    def test_08_download_quiz_report(self):
        """Test downloading quiz assessment report as text."""
        res = self.client.post("/download_quiz", json={
            "score": "5 / 5",
            "percentage": 100,
            "results": [
                {
                    "question": "What is Track 1?",
                    "options": ["A", "B", "C", "D"],
                    "user_index": 0,
                    "correct_index": 0,
                    "is_correct": True,
                    "page_number": 1,
                    "source_doc": "problem.pdf",
                    "explanation_quote": "Document Intelligence & Semantic Search"
                }
            ]
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn("OIRABOOT — OFFICIAL OONORI SYSTEM", res.data.decode("utf-8"))
        self.assertIn("AI Engine: Assessment Report", res.data.decode("utf-8"))
        print("[Test Download Report] Report successfully downloaded.")


if __name__ == "__main__":
    unittest.main()
