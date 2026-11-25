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
        db.execute("DELETE FROM admission_messages WHERE sid = ?", (sid,))
        db.commit()

        # 1. Ask about admission steps
        res1 = chat_admission(sid, "What are the admission steps?", db)
        assert res1["type"] == "answer"
        assert len(res1["evidence"]) > 0

        # 2. Multi-turn follow-up: "What is the tuition fee for CSE?" followed by "And for BBA?"
        res2 = chat_admission(sid, "What is the tuition fee for CSE?", db)
        assert res2["type"] == "answer"
        assert "4,500" in res2["reply"] or "4500" in res2["reply"]

        res3 = chat_admission(sid, "And for BBA?", db)
        assert res3["type"] == "answer"
        assert "3,500" in res3["reply"] or "3500" in res3["reply"]

        # 3. Unanswerable question returns server-composed referral
        res4 = chat_admission(sid, "Do you have a soccer field on Mars?", db)
        assert res4["type"] == "unknown"
        assert "01700-000000" in res4["reply"] or "admission@biu.example" in res4["reply"]

        # 4. Clarifying question for vague query
        res5 = chat_admission(sid, "tell me about fees", db)
        assert res5["type"] == "clarify"

def test_track2_checklist(test_client):
    en_items = get_admission_checklist("en")
    bn_items = get_admission_checklist("bn")
    assert len(en_items) == 6
    assert len(bn_items) == 6
    assert "online application form" in en_items[0]["label"].lower()
    assert "অনলাইন" in bn_items[0]["label"]

def test_track2_reasoning_bilingual_and_refusal(test_client):
    app = test_client.application
    with app.app_context():
        db = get_db()
        sid = "test-admission-reasoning-session"
        db.execute("DELETE FROM admission_messages WHERE sid = ?", (sid,))
        db.commit()

        # 1. BIU programs accurate fees (EEE, English)
        r_eee = chat_admission(sid, "What is the fee for EEE?", db)
        assert r_eee["type"] == "answer"
        assert "4,500" in r_eee["reply"]

        r_eng = chat_admission(sid, "What is the cheapest program?", db)
        assert r_eng["type"] == "answer"
        assert "English" in r_eng["reply"]
        assert "3,500" in r_eng["reply"]

        # 2. GPA & background reasoning
        r_elig_ok = chat_admission(sid, "With SSC 3.2 and HSC 3.6, am I eligible for CSE?", db)
        assert r_elig_ok["type"] == "answer"
        assert "Eligible" in r_elig_ok["reply"]

        r_elig_fail = chat_admission(sid, "I am from Commerce background, can I apply for CSE?", db)
        assert r_elig_fail["type"] == "answer"
        assert "Science" in r_elig_fail["reply"]

        # 3. Bengali query with Bengali digits & strict grounding
        r_bn = chat_admission(sid, "সিএসই বিভাগের টিউশন ফি কত?", db, ui_lang="bn")
        assert r_bn["type"] == "answer"
        assert "৪,৫০০" in r_bn["reply"] or "4,500" in r_bn["reply"]

        # 4. Smart reasoning on unlisted courses (Bangla, Photography, Pharmacy) + language switch
        r_bangla_course = chat_admission(sid, "Can I study Bangla course here?", db)
        assert r_bangla_course["type"] == "answer"
        assert "Bangla" in r_bangla_course["reply"]
        assert "English" in r_bangla_course["reply"]
        assert "01700-000000" in r_bangla_course["reply"]

        r_photo = chat_admission(sid, "Is there any photography course?", db)
        assert r_photo["type"] == "answer"
        assert "Photography" in r_photo["reply"]
        assert "01700-000000" in r_photo["reply"]

        r_switch_bn = chat_admission(sid, "can you rply me in bangla ??", db)
        assert r_switch_bn["type"] == "answer"
        assert "বাংলা" in r_switch_bn["reply"]

        r_pharma = chat_admission(sid, "What is the fee for Pharmacy?", db)
        assert r_pharma["type"] == "answer"
        assert "Pharmacy" in r_pharma["reply"] or "ফার্মেসি" in r_pharma["reply"]

        # 5. Out-of-document prompt injection or irrelevant queries
        r_refuse = chat_admission(sid, "Who won the cricket world cup?", db)
        assert r_refuse["type"] == "unknown"
