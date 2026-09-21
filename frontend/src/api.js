export const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function scoreTxn(payload) {
  const r = await fetch(`${API}/predict`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error('API ' + r.status);
  return r.json();
}

export async function scoreBatch(transactions) {
  const r = await fetch(`${API}/predict/batch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions }),
  });
  if (!r.ok) throw new Error('API ' + r.status);
  return r.json();
}

export async function getStats() {
  const r = await fetch(`${API}/stats`);
  if (!r.ok) throw new Error('API ' + r.status);
  return r.json();
}

export async function getRecent(limit = 100) {
  const r = await fetch(`${API}/recent?limit=${limit}`);
  if (!r.ok) throw new Error('API ' + r.status);
  return r.json();
}

const LOCS = ['Mumbai', 'Delhi', 'Bengaluru', 'London', 'Dubai', 'New York'];
const MERCH = ['grocery', 'restaurant', 'electronics', 'travel', 'fuel', 'shopping'];
const DEVS = ['mobile_A', 'mobile_B', 'desktop_A'];

/** Random txn: ~12% engineered fraud (big amount / 3AM / unknown device / burst). */
export function randomTxn(i) {
  const fraud = Math.random() < 0.12;
  const avg = 500 + Math.random() * 4000;
  const t = {
    user_id: 'U' + String(1 + Math.floor(Math.random() * 100)).padStart(3, '0'),
    amount: Math.round(Math.max(50, avg + (Math.random() - 0.5) * avg)),
    merchant_category: MERCH[Math.floor(Math.random() * MERCH.length)],
    location: LOCS[Math.floor(Math.random() * 3)],
    device: DEVS[Math.floor(Math.random() * DEVS.length)],
    transaction_hour: 8 + Math.floor(Math.random() * 14),
    transaction_type: 'Online',
    prev_amount: Math.round(avg),
    txn_per_hour: 1 + Math.floor(Math.random() * 3),
    account_age_days: 365,
  };
  if (fraud) {
    const k = Math.floor(Math.random() * 4);
    if (k === 0) t.amount = Math.round(avg * (10 + Math.random() * 25));
    if (k === 1) { t.transaction_hour = 1 + Math.floor(Math.random() * 4); t.location = LOCS[3 + Math.floor(Math.random() * 3)]; }
    if (k === 2) t.device = 'unknown';
    if (k === 3) t.txn_per_hour = 15 + Math.floor(Math.random() * 15);
  }
  return t;
}
