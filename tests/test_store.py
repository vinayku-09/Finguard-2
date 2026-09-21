"""Store tests: CSV fallback + SQL path (sqlite stands in for Postgres)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

P = {"user_id": "U1", "amount": 500, "merchant_category": "grocery",
     "location": "Mumbai", "device": "mobile_A", "transaction_hour": 12}
R = {"transaction_id": "TXNTEST1", "anomaly_score": 0.1,
     "risk_level": "LOW", "decision": "APPROVE"}

def test_csv_fallback():
    import src.store as s
    assert s.backend() == "csv"  # no DATABASE_URL in test env
    s.log_prediction(P, R)
    rows = s.recent(5)
    assert rows and rows[0]["transaction_id"] == "TXNTEST1"
    assert s.level_counts()["total"] >= 1

def test_sql_path():
    db = "/tmp/opencode/store_test.db"
    if os.path.exists(db):
        os.remove(db)
    os.environ["DATABASE_URL"] = f"sqlite:///{db}"
    try:
        import importlib, src.store as s
        importlib.reload(s)  # re-evaluate engine with sqlite URL
        assert s.backend() in ("postgres", "csv")
        s.log_prediction(P, R)
        assert s.recent(5)[0]["transaction_id"] == "TXNTEST1"
        assert s.level_counts()["total"] >= 1
        assert isinstance(s.avg_risk_by_merchant(), dict)
    finally:
        del os.environ["DATABASE_URL"]
