import pytest
from app import create_app
from core.db import get_db
from tracks.track2.chat import chat_admission, get_admission_checklist
from tracks.track2.kb import kb

@pytest.fixture
def test_client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        with app.app_context():
            yield client

def test_track2_admission_chat(test_client):
    app = test_client.application
    with app.app_context():
        db = get_db()
        sid = "test-admission-session"

        # 1. Ask about admission steps
        res1 = chat_admission(sid, "What are the admission steps?", db)
        assert res1["type"] == "answer"
        assert len(res1["evidence"]) > 0

        # 2. Multi-turn follow-up: "What is the tuition fee for CSE?" followed by "And for BBA?"
        res2 = chat_admission(sid, "What is the tuition fee for CSE?", db)
        assert "4,48,000" in res2["reply"] or "448000" in res2["reply"]
        assert res2["type"] == "answer"

        res3 = chat_admission(sid, "And for BBA?", db)
        assert "3,92,000" in res3["reply"] or "392000" in res3["reply"]
        assert res3["type"] == "answer"

        # 3. Unanswerable question returns server-composed referral
        res4 = chat_admission(sid, "Do you have a swimming pool on Mars?", db)
        assert res4["type"] == "unknown"
        assert "1851-120791" in res4["reply"] or "admission@portcity.edu.bd" in res4["reply"]

        # 4. Clarifying question for vague query
        res5 = chat_admission(sid, "tell me about fees", db)
        assert res5["type"] == "clarify"

def test_track2_checklist(test_client):
    en_items = get_admission_checklist("en")
    bn_items = get_admission_checklist("bn")
    assert len(en_items) >= 5
    assert len(bn_items) >= 5
    assert "Online" in en_items[0]["label"]
    assert "ফর্ম" in bn_items[0]["label"]
