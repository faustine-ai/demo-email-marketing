import { useState } from 'react';
import { IconPlus, IconClose, IconAudience } from '../components/Icons.jsx';
import { Sparkline } from '../components/ui.jsx';
import { num, compact, ACCENTS } from '../lib/format.js';

export default function Audiences({ store, api, toast }) {
  const { audiences, campaigns } = store;
  const [creating, setCreating] = useState(false);

  const usage = (id) => campaigns.filter((c) => c.audienceId === id).length;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="section-head">
          <span className="eyebrow">{compact(audiences.reduce((s, a) => s + a.size, 0))} contacts across {audiences.length} segments</span>
          <h2>Audiences</h2>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <IconPlus /> New segment
        </button>
      </div>

      <div className="grid cols-2">
        {audiences.map((a, i) => {
          const accent = ACCENTS[a.accent] || ACCENTS.mist;
          return (
            <div key={a.id} className="card" style={{ borderTop: `2px solid ${accent}` }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3>{a.name}</h3>
                  <p className="desc">{a.description}</p>
                </div>
                <Sparkline seed={i + 2} color={accent} w={84} h={30} />
              </div>

              <div className="row" style={{ marginTop: 16, justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, color: accent }}>{num(a.size)}</div>
                  <div className="mono-tag">contacts</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ color: a.growth >= 0 ? 'var(--mint)' : 'var(--coral)' }}>
                    {a.growth >= 0 ? '▲' : '▼'} {Math.abs(a.growth)}%
                  </div>
                  <div className="mono-tag">30-day trend</div>
                </div>
              </div>

              <div className="divider" style={{ margin: '14px 0' }} />
              <div className="row wrap" style={{ gap: 6 }}>
                {a.filters.map((f, fi) => (
                  <span key={fi} className="chip">
                    {f.field} {f.op} {f.value}
                  </span>
                ))}
                <span className="chip" style={{ marginLeft: 'auto', color: accent, borderColor: accent }}>
                  used in {usage(a.id)} campaign{usage(a.id) === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {creating && <AudienceDrawer api={api} onClose={() => setCreating(false)} onDone={() => { setCreating(false); toast('Segment created'); }} />}
    </div>
  );
}

function AudienceDrawer({ api, onClose, onDone }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState(1000);
  const [accent, setAccent] = useState('mint');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createAudience({ name, description, size, accent, filters: [{ field: 'status', op: 'is', value: 'subscribed' }] });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const accents = ['mint', 'coral', 'violet', 'mist'];

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <IconAudience style={{ width: 20, height: 20, color: 'var(--coral)' }} />
          <h2>New segment</h2>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <form className="drawer-body" onSubmit={submit}>
          <div className="field">
            <label>Segment name</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Engaged on mobile" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who lands in this segment and why" />
          </div>
          <div className="field">
            <label>Estimated size — {num(size)} contacts</label>
            <input className="range" type="range" min="0" max="50000" step="100" value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Accent</label>
            <div className="seg">
              {accents.map((a) => (
                <button type="button" key={a} className={accent === a ? 'on' : ''} onClick={() => setAccent(a)}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: ACCENTS[a] }} /> {a}
                </button>
              ))}
            </div>
          </div>
          <div className="divider" />
          <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Create segment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
