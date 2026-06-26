import { STATUS } from '../lib/format.js';

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  const live = status === 'sending';
  return (
    <span className={`badge${live ? ' live' : ''}`} style={{ color: s.color, borderColor: 'var(--line)' }}>
      <span className="led" />
      {s.label}
    </span>
  );
}

export function Meter({ value, color = 'var(--coral)', thin }) {
  return (
    <div className={`meter${thin ? ' thin' : ''}`}>
      <span style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  );
}

// Deterministic sparkline from a seed so tiles look alive without jitter.
export function Sparkline({ seed = 1, color = 'var(--coral)', w = 70, h = 22, points = 16 }) {
  const vals = [];
  let s = seed * 9301 + 49297;
  for (let i = 0; i < points; i++) {
    s = (s * 9301 + 49297) % 233280;
    vals.push(0.25 + (s / 233280) * 0.7);
  }
  const step = w / (points - 1);
  const d = vals
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${(h - v * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="spark">
      <path d={d} stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

export function StatTile({ label, value, delta, accent = 'var(--coral)', seed = 1 }) {
  return (
    <div className="stat">
      <span className="accent-bar" style={{ background: accent }} />
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {delta && <div className="d">{delta}</div>}
      <Sparkline seed={seed} color={accent} />
    </div>
  );
}

export function Ring({ value, color }) {
  return (
    <div className="ring" style={{ '--p': value, '--c': color }}>
      <span>{value}</span>
    </div>
  );
}

export function Empty({ title, sub, children }) {
  return (
    <div className="empty">
      <div className="big">{title}</div>
      {sub && <div>{sub}</div>}
      {children}
    </div>
  );
}
