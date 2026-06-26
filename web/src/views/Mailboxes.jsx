import { useState } from 'react';
import { Ring, Meter, StatusBadge } from '../components/ui.jsx';
import { IconPlus, IconClose, IconMailbox, IconPlay, IconPause } from '../components/Icons.jsx';
import { num } from '../lib/format.js';

const repColor = (r) => (r >= 80 ? 'var(--mint)' : r >= 65 ? 'var(--amber)' : 'var(--coral)');

export default function Mailboxes({ store, api, toast }) {
  const { mailboxes } = store;
  const [creating, setCreating] = useState(false);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="section-head">
          <span className="eyebrow">{mailboxes.length} sending identities</span>
          <h2>Mailboxes</h2>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <IconPlus /> Connect mailbox
        </button>
      </div>

      <div className="grid cols-3">
        {mailboxes.map((m) => (
          <MailboxCard key={m.id} m={m} api={api} toast={toast} />
        ))}
      </div>

      {creating && <MailboxDrawer api={api} onClose={() => setCreating(false)} onDone={() => { setCreating(false); toast('Mailbox connected — warming up'); }} />}
    </div>
  );
}

function MailboxCard({ m, api, toast }) {
  const auth = [
    ['SPF', m.spf],
    ['DKIM', m.dkim],
    ['DMARC', m.dmarc],
  ];
  const toggle = async () => {
    const next = m.status === 'paused' ? 'active' : 'paused';
    await api.updateMailbox(m.id, { status: next });
    toast(`Mailbox ${next === 'paused' ? 'paused' : 'activated'}`);
  };

  return (
    <div className="card">
      <div className="card-top">
        <Ring value={m.reputation} color={repColor(m.reputation)} />
        <div style={{ minWidth: 0 }}>
          <h3 style={{ marginBottom: 2 }}>{m.fromName}</h3>
          <div className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.address}</div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 14, gap: 6 }}>
        <StatusBadge status={m.status === 'active' ? 'sent' : m.status === 'paused' ? 'paused' : 'scheduled'} />
        {m.status === 'warming' && <span className="chip">warmup · day {m.warmupDay}</span>}
      </div>

      <div style={{ marginTop: 14 }}>
        <Meter value={m.sentToday / m.dailyLimit} color={repColor(m.reputation)} thin />
        <div className="mono-tag" style={{ marginTop: 6 }}>{num(m.sentToday)} / {num(m.dailyLimit)} sent today</div>
      </div>

      <div className="row" style={{ marginTop: 14, gap: 6 }}>
        {auth.map(([k, on]) => (
          <span key={k} className={`chip ${on ? 'on' : 'off'}`}>{k}{on ? ' ✓' : ' ✗'}</span>
        ))}
      </div>

      <div className="divider" style={{ margin: '14px 0' }} />
      <button className="btn sm ghost" onClick={toggle} style={{ width: '100%' }}>
        {m.status === 'paused' ? <><IconPlay /> Activate</> : <><IconPause /> Pause sending</>}
      </button>
    </div>
  );
}

function MailboxDrawer({ api, onClose, onDone }) {
  const [address, setAddress] = useState('');
  const [fromName, setFromName] = useState('');
  const [dailyLimit, setDailyLimit] = useState(500);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createMailbox({ address, fromName, dailyLimit });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <IconMailbox style={{ width: 20, height: 20, color: 'var(--coral)' }} />
          <h2>Connect a mailbox</h2>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <form className="drawer-body" onSubmit={submit}>
          <div className="field">
            <label>From address</label>
            <input className="input" autoFocus value={address} onChange={(e) => setAddress(e.target.value)} placeholder="hello@mail.yourdomain.com" />
            <span className="hint">New senders start a warmup ramp before reaching full volume.</span>
          </div>
          <div className="field">
            <label>From name</label>
            <input className="input" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your Team" />
          </div>
          <div className="field">
            <label>Daily limit — {num(dailyLimit)} / day</label>
            <input className="range" type="range" min="100" max="5000" step="100" value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} />
          </div>
          <div className="divider" />
          <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy || !address.includes('@')}>{busy ? 'Connecting…' : 'Connect mailbox'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
