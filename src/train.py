"""Train IF + supervised (XGBoost else RF) + MLP autoencoder. Saves models/ + metrics."""
import os, json, joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score
from features import to_matrix

try:
    from xgboost import XGBClassifier
    HAS_XGB = True
except Exception:
    HAS_XGB = False

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data", "transactions.csv")
OUT = os.path.join(BASE, "models")
os.makedirs(OUT, exist_ok=True)

def main():
    df = pd.read_csv(DATA)
    X, cols = to_matrix(df)
    y = df["is_fraud"].values
    scaler = StandardScaler().fit(X)
    Xs = scaler.transform(X)
    Xtr, Xte, ytr, yte = train_test_split(Xs, y, test_size=0.2, random_state=42, stratify=y)

    iso = IsolationForest(n_estimators=150, contamination=0.06, random_state=42).fit(Xtr)

    if HAS_XGB:
        sup = XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.08,
                            subsample=0.9, eval_metric="logloss", random_state=42)
    else:
        sup = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
    sup.fit(Xtr, ytr)

    ae = MLPRegressor(hidden_layer_sizes=(16, 8, 16), max_iter=300, random_state=42)
    Xn = Xtr[ytr == 0]
    ae.fit(Xn, Xn)  # autoencoder: reconstruct input

    # eval
    p = sup.predict_proba(Xte)[:, 1]
    pred = (p > 0.5).astype(int)
    err_te = np.mean((ae.predict(Xte) - Xte) ** 2, axis=1)
    thr = float(np.percentile(np.mean((ae.predict(Xn) - Xn) ** 2, axis=1), 95))
    metrics = {
        "supervised": "xgboost" if HAS_XGB else "randomforest",
        "precision": round(float(precision_score(yte, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(yte, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(yte, pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(yte, p)), 4),
        "ae_95pct_threshold": thr,
        "n_train": int(len(Xtr)), "n_test": int(len(Xte)),
        "feature_cols": cols,
    }
    joblib.dump(scaler, f"{OUT}/scaler.pkl"); joblib.dump(iso, f"{OUT}/iso.pkl")
    joblib.dump(sup, f"{OUT}/supervised.pkl"); joblib.dump(ae, f"{OUT}/ae.pkl")
    json.dump(metrics, open(f"{OUT}/metrics.json", "w"), indent=2)
    print(json.dumps(metrics, indent=2))

if __name__ == "__main__":
    main()
