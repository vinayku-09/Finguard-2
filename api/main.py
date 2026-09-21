"""FastAPI inference server: single + batch scoring, prediction store, stats."""
import os, uuid, json
import joblib
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.features import single_to_vector
from src.risk_engine import combine
from src import store

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = os.path.join(BASE, "models")
METRICS = os.path.join(M, "metrics.json")

scaler = joblib.load(f"{M}/scaler.pkl") if os.path.exists(f"{M}/scaler.pkl") else None
iso = joblib.load(f"{M}/iso.pkl") if os.path.exists(f"{M}/iso.pkl") else None
sup = joblib.load(f"{M}/supervised.pkl") if os.path.exists(f"{M}/supervised.pkl") else None
ae = joblib.load(f"{M}/ae.pkl") if os.path.exists(f"{M}/ae.pkl") else None
AE_MAX = 5.0

if scaler is None:
    raise RuntimeError(f"Models not found in {M}. Run: python data/generator.py && python src/train.py")


class Txn(BaseModel):
    user_id: str = "U001"
    amount: float
    merchant_category: str = "grocery"
    location: str = "Mumbai"
    device: str = "mobile_A"
    transaction_hour: int = 12
    transaction_type: str = "Online"
    prev_amount: float | None = None
    txn_per_hour: int = 1
    account_age_days: int = 365


class Batch(BaseModel):
    transactions: list[Txn]


def score_one(p: dict) -> dict:
    vec = single_to_vector(p)
    Xs = scaler.transform([vec])
    p_sup = float(sup.predict_proba(Xs)[0, 1])
    if_s = float(iso.decision_function(Xs)[0])
    ae_err = float(np.mean((ae.predict(Xs) - Xs) ** 2))
    out = combine(p_sup, if_s, min(ae_err / AE_MAX, 1.0))
    return {"transaction_id": f"TXN{uuid.uuid4().hex[:6].upper()}", **out,
            "signals": {"supervised_prob": round(p_sup, 4), "if_score": round(if_s, 4),
                        "ae_error": round(ae_err, 4)}}


app = FastAPI(title="FinGuard Anomaly API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/")
def root():
    return {"service": "FinGuard Anomaly API", "store": store.backend(), "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": True, "store": store.backend()}


@app.get("/metrics")
def metrics():
    if os.path.exists(METRICS):
        return json.load(open(METRICS))
    return {}


@app.post("/predict")
def predict(t: Txn):
    p = t.model_dump()
    r = score_one(p)
    store.log_prediction(p, r)
    return r


@app.post("/predict/batch")
def predict_batch(b: Batch):
    out = []
    for t in b.transactions:
        p = t.model_dump()
        r = score_one(p)
        store.log_prediction(p, r)
        out.append({**r, "amount": p["amount"], "merchant_category": p["merchant_category"],
                    "location": p["location"]})
    return {"count": len(out), "results": out}


@app.get("/recent")
def recent(limit: int = 50):
    rows = store.recent(limit)
    return {"count": len(rows), "results": rows, "store": store.backend()}


@app.get("/stats")
def stats():
    m = json.load(open(METRICS)) if os.path.exists(METRICS) else {}
    counts = store.level_counts()
    return {"total_scored": counts["total"], "high": counts["HIGH"], "medium": counts["MEDIUM"],
            "by_level": {k: counts[k] for k in ("LOW", "MEDIUM", "HIGH")},
            "avg_risk_by_merchant": store.avg_risk_by_merchant(),
            "model": m, "store": store.backend()}
