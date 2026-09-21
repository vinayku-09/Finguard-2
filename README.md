# FinGuard — Financial Transaction Anomaly Detection

ML-based fintech platform that scores every transaction for suspicious behavior and serves the verdict through a REST API and a live React dashboard.

**Model performance:** precision 1.00, recall 0.87, **F1 0.93, ROC-AUC 0.94** (6,000 transactions, 6% fraud; see `models/metrics.json`).

## Architecture

```
Transaction → Feature engineering → XGBoost (55%) + Isolation Forest (25%) + Autoencoder (20%)
→ Risk engine → APPROVE / REVIEW / BLOCK → FastAPI → React dashboard
→ Postgres (or CSV fallback) prediction log
```

## Stack

Python, scikit-learn, XGBoost, FastAPI, React + Recharts, PostgreSQL (CSV fallback for local dev), Docker, Render.

## Quickstart

```bash
pip install -r requirements.txt
python data/generator.py && python src/train.py
uvicorn api.main:app --host 0.0.0.0 --port 8000   # docs at /docs
cd frontend && npm install && npm run dev          # :5173
```

## API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/predict` | Score one transaction |
| POST | `/predict/batch` | Score N transactions |
| GET | `/stats` | Totals, risk mix, risk by merchant, model metrics |
| GET | `/recent?limit=50` | Prediction log, newest first |
| GET | `/metrics` | Training metrics |

Example: `POST /predict {"user_id":"U102","amount":120000,"merchant_category":"electronics","location":"London","device":"unknown","transaction_hour":3}` → `{"anomaly_score":0.96,"risk_level":"HIGH","decision":"BLOCK"}`.

## Storage

Set `DATABASE_URL` (e.g. `postgresql+psycopg2://user:pass@host:5432/db`) to log predictions to Postgres; otherwise the API uses `data/predictions_log.csv`. Same interface either way (`src/store.py`).

## Production

```bash
docker compose up --build     # postgres + api (:8000) + web (:5173)
python -m pytest tests/ -q    # 7 tests: API contract + store backends
```

Deploy on Render with `render.yaml` (API + Postgres + static frontend). Frontend API target is set at build time via `VITE_API_URL`.

## GitHub Pages (frontend)

1. Deploy the backend somewhere public first (Render + `render.yaml` works) — Pages only serves the frontend, and browsers can't reach `localhost`.
2. Repo Settings → Pages → Source: **GitHub Actions**.
3. Repo Settings → Secrets and variables → Actions → Variables → New: `VITE_API_URL` = your API URL (e.g. `https://finguard-api.onrender.com`).
4. Push — `.github/workflows/pages.yml` builds with that URL and publishes. Site: `https://vinayku-09.github.io/Finguard-2/`.

## Datasets to go beyond synthetic data

- ULB Credit-Card Fraud (start here): `kaggle.com/datasets/mlg-ulb/creditcardfraud`
- IEEE-CIS Fraud Detection: `kaggle.com/competitions/ieee-fraud-detection`
- PaySim Mobile Money: `kaggle.com/datasets/ealaxi/paysim1`

Map columns to amount / time / merchant / location / device in `src/features.py`, retrain with `python src/train.py` — API and dashboard need no changes.

## 3-minute demo

1. Problem (20s): rules miss novel fraud; behavior scoring catches it.
2. Live demo (60s): **Live demo** streams ~8 txns/2s; watch throughput, risk mix, treemap, alerts.
3. Manual probe (40s): 500 grocery noon → LOW/APPROVE (~0.10); 1,20,000 electronics London unknown 3AM → HIGH/BLOCK (~0.96). Repeat via `/docs`.
4. Under the hood (40s): engineered features → 3-model vote → weighted risk engine, F1 0.93.
5. Honest line: flags mean *suspicious for review*, not proven fraud.

## Layout

```
data/generator.py      synthetic transactions with fraud patterns
src/features.py        feature engineering (shared train/inference)
src/train.py           trains IF + XGBoost/RF + MLP autoencoder
src/risk_engine.py     weighted ensemble → score/level/decision
src/store.py           Postgres with CSV fallback
api/main.py            FastAPI: predict, batch, recent, stats
frontend/src/          Landing + Risk Monitor dashboard (React/Recharts)
tests/                 API contract + store tests
```
