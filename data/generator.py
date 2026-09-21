"""Synthetic transaction generator with realistic fraud patterns."""
import csv, os, random
from datetime import datetime, timedelta

random.seed(42)
LOCATIONS = ["Mumbai", "Delhi", "Bengaluru", "London", "Dubai", "New York", "Chennai"]
MERCHANTS = ["grocery", "restaurant", "electronics", "travel", "fuel", "shopping", "pharmacy"]
DEVICES = ["mobile_A", "mobile_B", "desktop_A"]
OUT = os.path.join(os.path.dirname(__file__), "transactions.csv")

def gen_user(uid):
    return {
        "user_id": uid,
        "home": random.choice(LOCATIONS[:3]),
        "device": random.choice(DEVICES),
        "avg_amount": random.uniform(500, 5000),
        "account_age_days": random.randint(30, 1500),
    }

def make_txn(i, u, fraud=False):
    base = random.gauss(u["avg_amount"], u["avg_amount"] * 0.3)
    amount = max(50, base)
    loc, dev, hour = u["home"], u["device"], random.randint(8, 22)
    prev = max(50, random.gauss(u["avg_amount"], u["avg_amount"] * 0.2))
    freq = random.randint(1, 3)
    if fraud:
        kind = random.choice(["amount", "location", "hour", "device", "freq"])
        if kind == "amount": amount = u["avg_amount"] * random.uniform(10, 40)
        elif kind == "location": loc = random.choice([L for L in LOCATIONS if L != u["home"]])
        elif kind == "hour": hour = random.choice([1, 2, 3, 4])
        elif kind == "device": dev = "unknown"
        elif kind == "freq": freq = random.randint(15, 30)
        # fraud often stacks two signals
        if random.random() < 0.4: hour = random.choice([1, 2, 3])
    return [f"TXN{i:05d}", u["user_id"], round(amount, 2), random.choice(["Online", "POS", "ATM"]),
            random.choice(MERCHANTS), loc, dev, hour, round(prev, 2), freq,
            u["account_age_days"], int(fraud)]

def main(n=6000, fraud_ratio=0.06):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    users = [gen_user(f"U{i:03d}") for i in range(1, 101)]
    with open(OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["transaction_id", "user_id", "amount", "transaction_type", "merchant_category",
                    "location", "device", "transaction_hour", "prev_amount", "txn_per_hour",
                    "account_age_days", "is_fraud"])
        for i in range(1, n + 1):
            u = random.choice(users)
            w.writerow(make_txn(i, u, fraud=random.random() < fraud_ratio))
    print(f"Wrote {n} rows -> {OUT}")

if __name__ == "__main__":
    main()
