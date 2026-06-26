import { useState } from 'react';
import { IconClose, IconBolt } from './Icons.jsx';
import { compact } from '../lib/format.js';

// Drawer for spinning up a new campaign. Creates it as a draft on the server;
// the new campaign streams back into every connected client over the socket.
export default function CampaignDrawer({ store, api, onClose, onCreated }) {
  const { mailboxes, audiences } = store;
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id || '');
  const [audienceId, setAudienceId] = useState(audiences[0]?.id || '');
  const [sendRate, setSendRate] = useState(24);
  const [busy, setBusy] = useState(false);

  const audience = audiences.find((a) => a.id === audienceId);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await api.createCampaign({ name, subject, body, mailboxId, audienceId, sendRate });
      onCreated?.(created);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <IconBolt style={{ width: 20, height: 20, color: 'var(--coral)' }} />
          <h2>New campaign</h2>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        <form className="drawer-body" onSubmit={submit}>
          <div className="field">
            <label>Campaign name</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring launch — wave 2" />
          </div>

          <div className="field">
            <label>Subject line</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Meet the thing you asked for" />
            <span className="hint">{subject.length} characters · keep under 60 for mobile</span>
          </div>

          <div className="field">
            <label>Email body</label>
            <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the first email. You can add follow-up steps once the campaign exists." rows={4} />
            <span className="hint">This becomes the first email in the sequence — edit it or add steps later.</span>
          </div>

          <div className="field">
            <label>Send from</label>
            <select className="select" value={mailboxId} onChange={(e) => setMailboxId(e.target.value)}>
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id} disabled={m.status === 'paused'}>
                  {m.address}
                  {m.status === 'paused' ? ' (paused)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Audience</label>
            <select className="select" value={audienceId} onChange={(e) => setAudienceId(e.target.value)}>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {compact(a.size)} contacts
                </option>
              ))}
            </select>
            {audience && <span className="hint">{audience.description}</span>}
          </div>

          <div className="field">
            <label>Send rate — {sendRate} msg / batch</label>
            <input className="range" type="range" min="4" max="80" value={sendRate} onChange={(e) => setSendRate(Number(e.target.value))} />
            <span className="hint">Higher rates clear the queue faster but lean harder on mailbox reputation.</span>
          </div>

          <div className="divider" />

          <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
              {busy ? 'Creating…' : 'Create draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
