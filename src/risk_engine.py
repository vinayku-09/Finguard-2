"""Weighted ensemble: supervised (XGB/RF) + IsolationForest + Autoencoder(MLP)."""
import numpy as np

W_SUP, W_IF, W_AE = 0.55, 0.25, 0.20

def _norm(x, lo, hi):
    return float(np.clip((x - lo) / (hi - lo + 1e-9), 0, 1))

def combine(p_sup: float, if_score: float, ae_err_norm: float) -> dict:
    """if_score: IsolationForest decision_function (higher = normal). ae_err_norm: 0..1."""
    if_anom = 1.0 - _norm(if_score, -0.2, 0.2)   # map to 0..1 anomaly
    risk = W_SUP * p_sup + W_IF * if_anom + W_AE * ae_err_norm
    risk = round(float(np.clip(risk, 0, 1)), 4)
    level = "LOW" if risk < 0.4 else ("MEDIUM" if risk < 0.7 else "HIGH")
    decision = "APPROVE" if level == "LOW" else ("REVIEW" if level == "MEDIUM" else "BLOCK")
    return {"anomaly_score": risk, "risk_level": level, "decision": decision}
