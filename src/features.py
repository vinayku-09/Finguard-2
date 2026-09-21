"""Feature engineering — shared by training and inference."""
import numpy as np
import pandas as pd

MERCHANTS = ["grocery", "restaurant", "electronics", "travel", "fuel", "shopping", "pharmacy"]
TXN_TYPES = ["Online", "POS", "ATM"]
FEATURE_COLS = ["amount", "prev_amount", "txn_per_hour", "account_age_days",
                "amount_ratio", "amountDeviation", "night_flag", "freq_anomaly",
                "new_device_flag"] + [f"m_{m}" for m in MERCHANTS] + [f"t_{t}" for t in TXN_TYPES]

def engineer(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    d["amount"] = d["amount"].astype(float)
    d["prev_amount"] = d["prev_amount"].astype(float).clip(lower=1)
    d["amount_ratio"] = d["amount"] / d["prev_amount"]
    d["amountDeviation"] = np.log1p(d["amount_ratio"])
    d["night_flag"] = ((d["transaction_hour"] <= 5) | (d["transaction_hour"] >= 23)).astype(int)
    d["freq_anomaly"] = (d["txn_per_hour"] > 5).astype(int)
    known = {"mobile_A", "mobile_B", "desktop_A"}
    d["new_device_flag"] = (~d["device"].isin(known)).astype(int)
    for m in MERCHANTS:
        d[f"m_{m}"] = (d["merchant_category"] == m).astype(int)
    for t in TXN_TYPES:
        d[f"t_{t}"] = (d["transaction_type"] == t).astype(int)
    return d

def to_matrix(df: pd.DataFrame):
    d = engineer(df)
    return d[FEATURE_COLS].values.astype(float), FEATURE_COLS

def single_to_vector(payload: dict):
    prev = payload.get("prev_amount") or payload["amount"]
    df = pd.DataFrame([{
        "amount": payload["amount"], "prev_amount": prev,
        "txn_per_hour": payload.get("txn_per_hour") or 1,
        "account_age_days": payload.get("account_age_days") or 365,
        "transaction_hour": payload.get("transaction_hour", 12),
        "device": payload.get("device") or "mobile_A",
        "merchant_category": payload.get("merchant_category") or "grocery",
        "transaction_type": payload.get("transaction_type") or "Online",
    }])
    X, _ = to_matrix(df)
    return X[0]
