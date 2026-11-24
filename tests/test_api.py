import json
import pytest
from app import create_app
from core.db import get_db

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_healthz(client):
    res = client.get("/healthz")
    assert res.status_code == 200
    data = res.get_json()
    assert data["ok"] is True
    assert "time" in data

def test_homepage_loads(client):
    res = client.get("/")
    assert res.status_code == 200
    assert b"Oiraboot" in res.data
    assert b"Academic Intelligence" in res.data

def test_documents_page_loads(client):
    res = client.get("/documents")
    assert res.status_code == 200
    assert b"Document Studio" in res.data
    assert b"Oiraboot" in res.data

def test_admissions_page_loads(client):
    res = client.get("/admissions")
    assert res.status_code == 200
    assert b"Admissions Desk" in res.data
    assert b"Oiraboot" in res.data

def test_scholarships_page_loads(client):
    res = client.get("/scholarships")
    assert res.status_code == 200
    assert b"Scholarship Atlas" in res.data
    assert b"Oiraboot" in res.data

def test_about_page_loads(client):
    res = client.get("/about")
    assert res.status_code == 200
    assert b"Zero-Hallucination" in res.data

def test_csrf_protection_on_api(client):
    res = client.post("/api/chat", json={"doc_ids": [1], "message": "hello"})
    assert res.status_code == 403
    data = res.get_json()
    assert data["error"]["code"] == "csrf"

def test_language_switch(client):
    res = client.get("/lang/bn", follow_redirects=True)
    assert res.status_code == 200

def test_admission_routes_csrf_and_response(client):
    with client.session_transaction() as sess:
        sess["csrf_token"] = "test-csrf-token"
    
    res = client.post(
        "/api/admission/chat",
        headers={"X-CSRF-Token": "test-csrf-token"},
        json={"message": "What is the tuition fee for CSE?"}
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data["type"] == "answer"
    assert "4,48,000" in data["reply"] or "448000" in data["reply"]

def test_scholarship_routes(client):
    with client.session_transaction() as sess:
        sess["csrf_token"] = "test-csrf-token"

    res = client.post(
        "/api/scholarships/match",
        headers={"X-CSRF-Token": "test-csrf-token"},
        json={"cgpa": 3.80, "department": "CSE", "needs_support": True}
    )
    assert res.status_code == 200
    data = res.get_json()
    assert len(data["matched"]) >= 3
    assert len(data["almost"]) >= 1

def test_scholarship_csv_export(client):
    res = client.get("/api/scholarships/export.csv?cgpa=3.80&department=CSE&needs_support=true")
    assert res.status_code == 200
    assert "text/csv" in res.content_type
    assert b"Scholarship Name" in res.data
