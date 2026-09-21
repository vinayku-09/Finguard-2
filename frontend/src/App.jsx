import React, { useEffect, useMemo, useRef, useState } from 'react'
import Landing from './Landing.jsx'
import { scoreTxn, scoreBatch, getStats, getRecent, randomTxn, API } from './api.js'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Treemap,
} from 'recharts'

const COLORS = { LOW: '#1C5C3C', MEDIUM: '#D9A419', HIGH: '#C0392B' }
const TREECOLOR = r => (r >= 0.7 ? '#C0392B' : r >= 0.4 ? '#D9A419' : '#1C5C3C')
function TreeCell({ x, y, width, height, name, size, avgRisk, high }) {
  if (width < 10 || height < 10) return null
  const bg = TREECOLOR(avgRisk)
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={bg} stroke="#FAF6EF" strokeWidth={3} rx={8} />
      {width > 90 && height > 52 && (
        <text x={x + 12} y={y + 26} fill="#fff" fontSize={14} fontWeight={700}>{name}</text>
      )}
      {width > 90 && height > 72 && (
        <text x={x + 12} y={y + 46} fill="rgba(255,255,255,.85)" fontSize={12}>{size} txns · risk {avgRisk} · {high} high</text>
      )}
    </g>
  )
}
const init = { user_id: 'U102', amount: 120000, merchant_category: 'electronics', location: 'London', device: 'unknown', transaction_hour: 3, transaction_type: 'Online', prev_amount: 2000, txn_per_hour: 1, account_age_days: 730 }

export default function App() {
  const [form, setForm] = useState(init)
  const [res, setRes] = useState(null)
  const [feed, setFeed] = useState([])
  const [stats, setStats] = useState(null)
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [view, setView] = useState('landing')
  const timer = useRef(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function refreshStats() {
    try { setStats(await getStats()); setErr('') } catch { setErr('API unreachable — start backend: uvicorn api.main:app --reload') }
  }
  useEffect(() => {
    refreshStats()
    getRecent().then(r => setFeed(r.results.map(x => ({ ...x, time: x.time || '' })))).catch(() => {})
    const i = setInterval(refreshStats, 5000)
    return () => clearInterval(i)
  }, [])

  async function submit(e) {
    e.preventDefault(); setErr('')
    try {
      const r = await scoreTxn({ ...form, amount: +form.amount, transaction_hour: +form.transaction_hour, prev_amount: +form.prev_amount, txn_per_hour: +form.txn_per_hour, account_age_days: +form.account_age_days })
      setRes(r)
      setFeed(f => [{ ...r, amount: form.amount, merchant_category: form.merchant_category, location: form.location, time: new Date().toLocaleTimeString() }, ...f].slice(0, 100))
      refreshStats()
    } catch { setErr('API unreachable — start backend first.') }
  }

  // Live demo: score 8 random txns/sec in batches
  async function tick() {
    try {
      const batch = Array.from({ length: 8 }, (_, i) => randomTxn(i))
      const { results } = await scoreBatch(batch)
      const stamped = results.map(r => ({ ...r, time: new Date().toLocaleTimeString() }))
      setFeed(f => [...stamped.reverse(), ...f].slice(0, 100))
    } catch { setRunning(false); setErr('Demo stopped — API unreachable.') }
  }
  useEffect(() => {
    if (running) { tick(); timer.current = setInterval(() => { tick(); refreshStats() }, 2000) }
    return () => clearInterval(timer.current)
  }, [running])

  const timeline = useMemo(() => {
    const buckets = {}
    feed.forEach(r => { buckets[r.time] = buckets[r.time] || { t: r.time, n: 0, hi: 0 }; buckets[r.time].n++; if (r.risk_level === 'HIGH') buckets[r.time].hi++ })
    return Object.values(buckets).slice(-20)
  }, [feed])
  const pie = useMemo(() => {
    const c = { LOW: 0, MEDIUM: 0, HIGH: 0 }
    feed.forEach(r => c[r.risk_level]++)
    return Object.entries(c).map(([name, value]) => ({ name, value }))
  }, [feed])
  const byMerch = useMemo(() => {
    const m = {}
    feed.forEach(r => { const k = r.merchant_category || '?'; m[k] = m[k] || { name: k, risk: 0, n: 0 }; m[k].risk += r.anomaly_score; m[k].n++ })
    return Object.values(m).map(x => ({ name: x.name, avgRisk: +(x.risk / x.n).toFixed(3) }))
  }, [feed])
  const treeData = useMemo(() => {
    const m = {}
    feed.forEach(r => {
      const k = r.merchant_category || '?'
      m[k] = m[k] || { name: k, size: 0, risk: 0, high: 0 }
      m[k].size += 1; m[k].risk += r.anomaly_score
      if (r.risk_level === 'HIGH') m[k].high += 1
    })
    return Object.values(m).map(x => ({ ...x, avgRisk: x.size ? +(x.risk / x.size).toFixed(3) : 0 }))
  }, [feed])
  const shown = filter === 'ALL' ? feed : feed.filter(r => r.risk_level === filter)
  const hi = feed.filter(r => r.risk_level === 'HIGH').length

  if (view === 'landing') return <Landing onLaunch={() => setView('dash')} />
  return (
    <div className="wrap">
      <header className="top">
        <div className="dash-brand"><button className="back" onClick={() => setView('landing')}>← Site</button>
          <div><h1><span className="mark">◈</span> Risk Monitor</h1>
            <p>Isolation Forest · XGBoost · Autoencoder → Risk Engine · <code>{API}</code></p></div></div>
        <div className="demo">
          <span className={`status ${running ? 'live' : ''}`}><span className="live-dot" />{running ? 'LIVE' : 'IDLE'}</span>
          <button className={running ? 'stop' : 'go'} onClick={() => setRunning(r => !r)}>
            {running ? 'Stop demo' : 'Live demo'}</button>
          <small>{running ? '~8 txns / 2s' : '~12% fraud in stream'}</small>
        </div>
      </header>

      <div className="cards">
        <div className="card"><h3>Scored (session)</h3><div className="big">{feed.length}</div><small>total incl. backend log: {stats?.total_scored ?? '—'}</small></div>
        <div className="card alert"><h3>High risk</h3><div className="big">{hi}</div><small>backend total: {stats?.high ?? '—'}</small></div>
        <div className="card"><h3>Model F1 / ROC-AUC</h3><div className="big">{stats?.model?.f1 ?? '—'} / {stats?.model?.roc_auc ?? '—'}</div><small>{stats?.model?.supervised ?? ''} · n={stats?.model?.n_train ?? '—'}</small></div>
        <div className="card"><h3>Last decision</h3><div className="big">{res ? `${res.risk_level} · ${res.decision}` : '—'}</div><small>{res ? `score ${res.anomaly_score}` : 'score a txn or run demo'}</small></div>
      </div>

      <div className="grid3">
        <div className="panel span2"><h2>Throughput and high-risk hits</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeline}>
              <CartesianGrid stroke="#E5DCCB" /><XAxis dataKey="t" stroke="#6B6257" fontSize={11} /><YAxis stroke="#6B6257" />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5DCCB', borderRadius: 10 }} />
              <Area dataKey="n" name="txns" fill="#1C5C3C" fillOpacity={0.25} stroke="#1C5C3C" strokeWidth={2} />
              <Area dataKey="hi" name="high-risk" fill="#C0392B" fillOpacity={0.3} stroke="#C0392B" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer></div>
        <div className="panel"><h2>Risk mix</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={80} label>
              {pie.map(p => <Cell key={p.name} fill={COLORS[p.name]} />)}</Pie><Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5DCCB', borderRadius: 10 }} /></PieChart>
          </ResponsiveContainer></div>
      </div>

      <div className="grid2">
        <div className="panel"><h2>Average risk by merchant</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byMerch}><CartesianGrid stroke="#E5DCCB" /><XAxis dataKey="name" stroke="#6B6257" fontSize={11} /><YAxis stroke="#6B6257" domain={[0, 1]} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5DCCB', borderRadius: 10 }} /><Bar dataKey="avgRisk" fill="#1C5C3C" radius={[6, 6, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
        <div className="panel"><h2>Score a transaction</h2>
          <form onSubmit={submit} className="form">
            <div className="row">
              <label>amount<input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} /></label>
              <label>prev_amount<input type="number" value={form.prev_amount} onChange={e => set('prev_amount', e.target.value)} /></label>
            </div>
            <div className="row">
              <label>location<input value={form.location} onChange={e => set('location', e.target.value)} /></label>
              <label>device<input value={form.device} onChange={e => set('device', e.target.value)} /></label>
            </div>
            <div className="row">
              <label>hour<input type="number" value={form.transaction_hour} onChange={e => set('transaction_hour', e.target.value)} /></label>
              <label>txn/hour<input type="number" value={form.txn_per_hour} onChange={e => set('txn_per_hour', e.target.value)} /></label>
            </div>
            <div className="row">
              <label>merchant<select value={form.merchant_category} onChange={e => set('merchant_category', e.target.value)}>
                {['grocery', 'restaurant', 'electronics', 'travel', 'fuel', 'shopping', 'pharmacy'].map(m => <option key={m} value={m}>{m}</option>)}
              </select></label>
              <label>type<select value={form.transaction_type} onChange={e => set('transaction_type', e.target.value)}>
                {['Online', 'POS', 'ATM'].map(m => <option key={m} value={m}>{m}</option>)}
              </select></label>
            </div>
            <button type="submit">Score transaction</button>
          </form>
          {res && <div className="result"><span className={`badge ${res.risk_level}`}>{res.risk_level} · {res.decision}</span>
            <div className="bar"><div style={{ width: `${res.anomaly_score * 100}%`, background: TREECOLOR(res.anomaly_score) }} /></div>
            <pre>{JSON.stringify(res.signals, null, 2)}</pre></div>}
        </div>
      </div>

      <div className="panel"><h2>Risk exposure by merchant</h2>
        <ResponsiveContainer width="100%" height={220}>
          <Treemap data={treeData} dataKey="size" nameKey="name" content={<TreeCell />}>
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5DCCB', borderRadius: 10 }} />
          </Treemap>
        </ResponsiveContainer>
        <p className="muted legend"><span className="sw g" />low <span className="sw a" />medium <span className="sw r" />high average risk · box size = transaction count</p>
      </div>

      <div className="panel"><h2>Live alerts
        <span className="filters">{['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(f =>
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>)}</span></h2>
        {err && <p className="err">{err}</p>}
        <table><thead><tr><th>Time</th><th>ID</th><th>Amount</th><th>Merchant</th><th>Location</th><th>Score</th><th>Risk</th><th>Decision</th></tr></thead>
          <tbody>{shown.slice(0, 25).map(a => (
            <tr key={a.transaction_id}><td>{a.time}</td><td>{a.transaction_id}</td><td>₹{Number(a.amount).toLocaleString()}</td>
              <td>{a.merchant_category}</td><td>{a.location}</td><td>{a.anomaly_score}</td>
              <td><span className={`badge ${a.risk_level}`}>{a.risk_level}</span></td><td>{a.decision}</td></tr>
          ))}</tbody></table>
        {shown.length === 0 && <p className="muted">No data yet — start the live demo or score the ₹1,20,000 / 3AM / London / unknown-device example.</p>}
      </div>
    </div>
  )
}
