// Formatting helpers shared across views. Keep numbers terse and technical.

export const ACCENTS = {
  coral: 'var(--coral)',
  violet: 'var(--violet)',
  mint: 'var(--mint)',
  mist: 'var(--mist)',
};

export const STATUS = {
  draft: { label: 'Draft', color: 'var(--mist)' },
  scheduled: { label: 'Scheduled', color: 'var(--violet)' },
  sending: { label: 'Sending', color: 'var(--coral)' },
  paused: { label: 'Paused', color: 'var(--amber)' },
  sent: { label: 'Sent', color: 'var(--mint)' },
};

export function num(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US');
}

export function compact(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function pct(part, whole, digits = 1) {
  if (!whole) return '0%';
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

export function ratio(part, whole) {
  if (!whole) return 0;
  return Math.max(0, Math.min(1, part / whole));
}

export function relTime(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const future = diff < 0;
  const s = Math.abs(diff) / 1000;
  const fmt = (v, u) => `${future ? 'in ' : ''}${Math.round(v)}${u}${future ? '' : ' ago'}`;
  if (s < 45) return future ? 'soon' : 'just now';
  if (s < 3600) return fmt(s / 60, 'm');
  if (s < 86400) return fmt(s / 3600, 'h');
  return fmt(s / 86400, 'd');
}

export function clockTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
