"""Prediction store: Postgres when DATABASE_URL is set, CSV fallback otherwise.

Same interface either way, so the API never changes:
  log_prediction(payload, result)  append one scored transaction
  recent(limit)                    newest-first list of dicts
  level_counts()                   {"LOW": n, "MEDIUM": n, "HIGH": n, "total": n}
  avg_risk_by_merchant()           {merchant: avg_score}
"""
import os

DATABASE_URL = os.getenv("DATABASE_URL", "")

# ---------- Postgres path (lazy, only if configured) ----------
_engine = None

def _engine_or_none():
    global _engine
    if not DATABASE_URL:
        return None
    if _engine is None:
        from sqlalchemy import create_engine
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    return _engine

DDL_PG = """
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  transaction_id TEXT, user_id TEXT, amount DOUBLE PRECISION,
  merchant_category TEXT, location TEXT, device TEXT,
  transaction_hour INTEGER, anomaly_score DOUBLE PRECISION,
  risk_level TEXT, decision TEXT, created_at TIMESTAMPTZ DEFAULT now()
)
"""
DDL_SQLITE = """
CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT, user_id TEXT, amount REAL,
  merchant_category TEXT, location TEXT, device TEXT,
  transaction_hour INTEGER, anomaly_score REAL,
  risk_level TEXT, decision TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
"""

def _pg_ok():
    try:
        eng = _engine_or_none()
        if eng is None:
            return False
        from sqlalchemy import text
        ddl = DDL_SQLITE if DATABASE_URL.startswith("sqlite") else DDL_PG
        with eng.begin() as cxn:
            cxn.execute(text(ddl))
        return True
    except Exception:
        return False

_PG = _pg_ok()  # evaluated once at import; falls back to CSV on any failure


# ---------- CSV fallback ----------
import csv, threading
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(BASE, "data", "predictions_log.csv")
LOCK = threading.Lock()
COLS = ["transaction_id", "user_id", "amount", "merchant_category", "location",
        "device", "transaction_hour", "anomaly_score", "risk_level", "decision"]

def _csv_log(p, r):
    with LOCK:
        new = not os.path.exists(LOG)
        with open(LOG, "a", newline="") as f:
            w = csv.writer(f)
            if new:
                w.writerow(COLS)
            w.writerow([r["transaction_id"], p.get("user_id"), p.get("amount"),
                        p.get("merchant_category"), p.get("location"), p.get("device"),
                        p.get("transaction_hour"), r["anomaly_score"],
                        r["risk_level"], r["decision"]])

def _csv_recent(limit):
    if not os.path.exists(LOG):
        return []
    import pandas as pd
    return pd.read_csv(LOG).tail(limit).iloc[::-1].to_dict("records")

def _csv_counts():
    if not os.path.exists(LOG):
        return {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "total": 0}
    import pandas as pd
    df = pd.read_csv(LOG)
    return {k: int((df.risk_level == k).sum()) for k in ("LOW", "MEDIUM", "HIGH")} | {"total": len(df)}

def _csv_merchant():
    if not os.path.exists(LOG):
        return {}
    import pandas as pd
    df = pd.read_csv(LOG)
    return df.groupby("merchant_category")["anomaly_score"].mean().round(3).to_dict()


# ---------- public interface ----------
def log_prediction(p, r):
    if _PG:
        try:
            from sqlalchemy import text
            with _engine_or_none().begin() as cxn:
                cxn.execute(text(
                    "INSERT INTO predictions (transaction_id, user_id, amount, merchant_category,"
                    " location, device, transaction_hour, anomaly_score, risk_level, decision)"
                    " VALUES (:tid, :uid, :amt, :mer, :loc, :dev, :hr, :score, :lvl, :dec)"),
                    {"tid": r["transaction_id"], "uid": p.get("user_id"), "amt": p.get("amount"),
                     "mer": p.get("merchant_category"), "loc": p.get("location"),
                     "dev": p.get("device"), "hr": p.get("transaction_hour"),
                     "score": r["anomaly_score"], "lvl": r["risk_level"], "dec": r["decision"]})
            return
        except Exception:
            pass
    _csv_log(p, r)

def recent(limit=50):
    if _PG:
        try:
            from sqlalchemy import text
            with _engine_or_none().connect() as cxn:
                rows = cxn.execute(text(
                    "SELECT transaction_id, user_id, amount, merchant_category, location,"
                    " device, transaction_hour, anomaly_score, risk_level, decision"
                    " FROM predictions ORDER BY id DESC LIMIT :lim"), {"lim": limit}).mappings().all()
            return [dict(r) | {"amount": float(r["amount"]), "anomaly_score": float(r["anomaly_score"])} for r in rows]
        except Exception:
            pass
    return _csv_recent(limit)

def level_counts():
    if _PG:
        try:
            from sqlalchemy import text
            with _engine_or_none().connect() as cxn:
                rows = cxn.execute(text("SELECT risk_level, COUNT(*) FROM predictions GROUP BY 1")).all()
            d = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
            d.update({k: int(v) for k, v in rows})
            d["total"] = sum(d.values())
            return d
        except Exception:
            pass
    return _csv_counts()

def avg_risk_by_merchant():
    if _PG:
        try:
            from sqlalchemy import text
            with _engine_or_none().connect() as cxn:
                rows = cxn.execute(text(
                    "SELECT merchant_category, AVG(anomaly_score) FROM predictions GROUP BY 1")).all()
            return {k: round(float(v), 3) for k, v in rows}
        except Exception:
            pass
    return _csv_merchant()

def backend() -> str:
    return "postgres" if _PG else "csv"
