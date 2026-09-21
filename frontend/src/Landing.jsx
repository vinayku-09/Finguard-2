import React, { useEffect, useRef, useState } from 'react'

/* ---------- scroll reveal ---------- */
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.15 })
    if (el) io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={`rv ${seen ? 'on' : ''}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>
}

/* ---------- count-up ---------- */
function Count({ to, dec = 0, suffix = '' }) {
  const ref = useRef(null)
  const [v, setV] = useState(0)
  useEffect(() => {
    const el = ref.current
    let raf
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const step = t => { const p = Math.min((t - t0) / 1400, 1); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step) }
      raf = requestAnimationFrame(step)
    }, { threshold: 0.4 })
    if (el) io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [to])
  return <span ref={ref}>{v.toFixed(dec)}{suffix}</span>
}

/* ---------- cycling live-score widget ---------- */
const SAMPLES = [
  { label: '₹540 · grocery · Mumbai · 1:20 PM', score: 0.09, level: 'LOW', dec: 'APPROVE' },
  { label: '₹1,20,000 · electronics · London · 3:04 AM', score: 0.96, level: 'HIGH', dec: 'BLOCK' },
  { label: '₹2,300 · restaurant · Delhi · 8:45 PM', score: 0.21, level: 'LOW', dec: 'APPROVE' },
  { label: '₹84,500 · travel · Dubai · 2:12 AM', score: 0.78, level: 'HIGH', dec: 'BLOCK' },
  { label: '₹4,100 · fuel · Bengaluru · 6:30 PM', score: 0.52, level: 'MEDIUM', dec: 'REVIEW' },
]
function ScoreWidget() {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(v => (v + 1) % SAMPLES.length), 2600); return () => clearInterval(t) }, [])
  const s = SAMPLES[i]
  return (
    <div className="score-card">
      <div className="score-head"><span className="live-dot" />LIVE SCORING<span className="mono-hash">#{String(i + 1).padStart(3, '0')}</span></div>
      <div className="score-txn" key={i}>{s.label}</div>
      <div className="score-row"><span className="score-num">{s.score.toFixed(2)}</span><span className={`badge ${s.level}`}>{s.level} · {s.dec}</span></div>
      <div className="score-bar"><div key={'b' + i} style={{ width: `${s.score * 100}%` }} /></div>
      <div className="score-dots">{SAMPLES.map((_, d) => <span key={d} className={d === i ? 'on' : ''} />)}</div>
    </div>
  )
}

const TICKER = [
  'TXN 8F2K1A · ₹540 · APPROVED', 'TXN 91BD22 · ₹1,20,000 · BLOCKED', 'TXN 77Q0M9 · ₹2,300 · APPROVED',
  'TXN C41D07 · ₹84,500 · BLOCKED', 'TXN 5E19F2 · ₹4,100 · REVIEW', 'TXN A0B833 · ₹960 · APPROVED',
  'TXN 6D77C1 · ₹2,10,000 · BLOCKED', 'TXN 11F9E4 · ₹1,150 · APPROVED',
]

export default function Landing({ onLaunch }) {
  return (
    <div className="site">
      <nav className="nav">
        <div className="brand"><span className="mark">◈</span> FinGuard</div>
        <div className="links"><a href="#models">Models</a><a href="#metrics">Metrics</a><a href="#data">Data</a></div>
        <button onClick={onLaunch}>Open live dashboard →</button>
      </nav>

      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Financial transaction anomaly detection</p>
          <h1>Catch fraud<br /><em>before</em> it clears.</h1>
          <p className="lede">Every payment gets a risk score in milliseconds — learned from how your customers actually behave, not from rigid rules. Normal grocery run? Approved. ₹1.2 lakh from London at 3 AM? Blocked.</p>
          <div className="cta-row">
            <button className="cta" onClick={onLaunch}>Run the live demo</button>
            <a className="ghost" href="#models">How it works</a>
          </div>
          <div className="hero-stats">
            <div><b><Count to={0.93} dec={2} /></b><span>F1 score</span></div>
            <div><b><Count to={0.94} dec={2} /></b><span>ROC-AUC</span></div>
            <div><b><Count to={6000} /></b><span>txns scored</span></div>
            <div><b>&lt;<Count to={50} />ms</b><span>per score</span></div>
          </div>
        </div>
        <div className="hero-widget"><ScoreWidget /></div>
      </header>

      <div className="ticker"><div className="ticker-track">{[...TICKER, ...TICKER].map((t, i) => <span key={i}>{t}</span>)}</div></div>

      <section id="models" className="section">
        <Reveal><p className="eyebrow">Under the hood</p>
          <h2>Three models vote.<br />One risk score.</h2></Reveal>
        <div className="model-grid">
          <Reveal delay={0}><div className="model"><div className="w">55%</div><h3>XGBoost</h3><p>Supervised classifier trained on labelled fraud. Catches known patterns — amount spikes, night hours, unknown devices.</p><code>fraud probability</code></div></Reveal>
          <Reveal delay={120}><div className="model"><div className="w">25%</div><h3>Isolation Forest</h3><p>Unsupervised. Learns what “normal” looks like and isolates the odd ones out — no label required.</p><code>anomaly signal</code></div></Reveal>
          <Reveal delay={240}><div className="model"><div className="w">20%</div><h3>Autoencoder</h3><p>Deep learning. Reconstructs normal transactions; large reconstruction error means suspicious.</p><code>reconstruction error</code></div></Reveal>
        </div>
        <Reveal><div className="engine">Feature engineering → weighted ensemble → <b>APPROVE / REVIEW / BLOCK</b></div></Reveal>
      </section>

      <section id="metrics" className="section band">
        <Reveal><h2>Measured, not claimed.</h2></Reveal>
        <div className="metric-grid">
          <Reveal delay={0}><div className="metric"><b><Count to={1.0} dec={2} /></b><span>Precision — almost no false alarms</span></div></Reveal>
          <Reveal delay={100}><div className="metric"><b><Count to={0.87} dec={2} /></b><span>Recall — catches most fraud</span></div></Reveal>
          <Reveal delay={200}><div className="metric"><b><Count to={0.93} dec={2} /></b><span>F1 — balanced performance</span></div></Reveal>
          <Reveal delay={300}><div className="metric"><b><Count to={0.94} dec={2} /></b><span>ROC-AUC — ranking quality</span></div></Reveal>
        </div>
      </section>

      <section id="data" className="section">
        <Reveal><p className="eyebrow">Training data</p>
          <h2>Start synthetic.<br />Go real.</h2>
          <p className="lede-sm">The demo ships with a built-in generator (6,000 transactions, realistic fraud patterns). When you’re ready, swap in a real dataset — the pipeline only needs amount, time, merchant, location and device columns.</p></Reveal>
        <div className="data-grid">
          <Reveal delay={0}><div className="data"><h3>ULB Credit-Card Fraud <span>Start here</span></h3><p>284,807 real European card transactions, 492 frauds. The standard benchmark every fraud project is compared against.</p><a href="https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud" target="_blank" rel="noreferrer">kaggle.com/datasets/mlg-ulb/creditcardfraud →</a></div></Reveal>
          <Reveal delay={120}><div className="data"><h3>IEEE-CIS Fraud Detection</h3><p>Real e-commerce transactions with identity, device and behavioural features. Richer, closer to production.</p><a href="https://www.kaggle.com/competitions/ieee-fraud-detection" target="_blank" rel="noreferrer">kaggle.com/competitions/ieee-fraud-detection →</a></div></Reveal>
          <Reveal delay={240}><div className="data"><h3>PaySim Mobile Money</h3><p>6M+ synthetic mobile-money transfers with labelled fraud — best for scale and burst-pattern testing.</p><a href="https://www.kaggle.com/datasets/ealaxi/paysim1" target="_blank" rel="noreferrer">kaggle.com/datasets/ealaxi/paysim1 →</a></div></Reveal>
        </div>
      </section>

      <section className="section final">
        <Reveal><h2>See it catch one live.</h2>
          <p className="lede-sm">Streams synthetic traffic at ~8 transactions every 2 seconds and flags the suspicious ones in real time.</p>
          <button className="cta big" onClick={onLaunch}>Open the dashboard →</button></Reveal>
      </section>

      <footer className="foot"><span><span className="mark">◈</span> FinGuard</span><span>Isolation Forest · XGBoost · Autoencoder — flags are suspicious-for-review, not proven fraud.</span></footer>
    </div>
  )
}
