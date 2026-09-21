"""API contract tests: run with `python -m pytest tests/ -q` from repo root."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient
from api.main import app

c = TestClient(app)
NORMAL = {"user_id": "U001", "amount": 500, "merchant_category": "grocery",
          "location": "Mumbai", "device": "mobile_A", "transaction_hour": 12}
FRAUD = {"user_id": "U102", "amount": 120000, "merchant_category": "electronics",
         "location": "London", "device": "unknown", "transaction_hour": 3,
         "prev_amount": 2000}

def test_health():
    assert c.get("/health").json()["models_loaded"] is True

def test_normal_approves():
    r = c.post("/predict", json=NORMAL).json()
    assert r["risk_level"] == "LOW" and r["decision"] == "APPROVE"

def test_fraud_blocks():
    r = c.post("/predict", json=FRAUD).json()
    assert r["risk_level"] == "HIGH" and r["decision"] == "BLOCK"
    assert r["anomaly_score"] > r["signals"]["supervised_prob"] - 0.3  # ensemble sane

def test_batch_and_stats():
    b = c.post("/predict/batch", json={"transactions": [NORMAL, FRAUD]}).json()
    assert b["count"] == 2
    s = c.get("/stats").json()
    assert s["total_scored"] >= 2 and s["by_level"]["HIGH"] >= 1

def test_minimal_payload():
    r = c.post("/predict", json={"amount": 700}).json()  # defaults must not NaN-crash
    assert r["risk_level"] in ("LOW", "MEDIUM", "HIGH")
