import pytest
from app import create_app
from core.db import get_db
from tracks.track3.loader import load_scholarships_into_db
from tracks.track3.matcher import match_scholarships
from tracks.track3.reasons import generate_batch_reasons

@pytest.fixture
def test_client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        with app.app_context():
            yield client

def test_track3_matching_and_gap_radar(test_client):
    app = test_client.application
    with app.app_context():
        db = get_db()
        db.execute("DELETE FROM reasons")
        db.commit()
        scholarships = load_scholarships_into_db(db)
        assert len(scholarships) >= 100

        # Student with CGPA 3.75 in CSE requiring financial need
        matched, almost = match_scholarships(scholarships, cgpa=3.75, department="CSE", needs_support=True)
        assert len(matched) >= 3

        # Check Merit Excellence Award (min 3.8): student has 3.75, so it should be in ALMOST
        merit_almost = [s for s in almost if "Merit Excellence" in s["name"]]
        assert len(merit_almost) == 1
        assert "3.8" in merit_almost[0]["missing"][0]

        # Student without financial need should not match need-based awards
        matched_no_need, _ = match_scholarships(scholarships, cgpa=3.75, department="CSE", needs_support=False)
        assert all(not s.get("need_based", False) for s in matched_no_need)

        # Template reasons generation
        reasons = generate_batch_reasons(matched, cgpa=3.75, department="CSE", needs_support=True, db=db)
        assert len(reasons) == len(matched)
        assert "3.75" in list(reasons.values())[0]["reason"]
