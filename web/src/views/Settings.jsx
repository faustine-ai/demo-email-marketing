import { useState, useEffect } from 'react';
import { IconSettings } from '../components/Icons.jsx';
import { num } from '../lib/format.js';

// Sending limits. These are enforced live by the dispatch simulator: send rate
// is capped, and dispatch holds once the per-campaign or global ceilings hit.
const FIELDS = [
  {
    key: 'maxSendRate',
    label: 'Max send rate',
    unit: 'messages / batch',
    min: 4,
    max: 200,
    step: 1,
    hint: 'Hard cap on how fast any single campaign clears its queue. Lower is gentler on mailbox reputation.',
  },
  {
    key: 'perCampaignDailyLimit',
    label: 'Per-campaign daily limit',
    unit: 'emails / campaign / day',
    min: 0,
    max: 100000,
    step: 500,
    hint: 'A campaign pauses itself once it has sent this many emails in a day. Set 0 to disable.',
  },
  {
    key: 'globalDailyLimit',
    label: 'Global daily limit',
    unit: 'emails / day',
    min: 0,
    max: 500000,
    step: 1000,
    hint: 'Total volume allowed across every mailbox per day. Dispatch holds when this is reached. Set 0 to disable.',
  },
];

export default function Settings({ store, api, toast }) {
  const { settings, campaigns, mailboxes } = store;
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);

  // Re-sync if settings arrive/change over the socket while the form is open.
  useEffect(() => setDraft(settings), [settings]);

  if (!settings || !draft) {
    return (
      <div className="panel panel-pad">
        <div className="empty">
          <div className="big">Loading settings…</div>
        </div>
      </div>
    );
  }

  const dirty =
    draft.enforceLimits !== settings.enforceLimits ||
    FIELDS.some((f) => Number(draft[f.key]) !== Number(settings[f.key]));

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    setBusy(true);
    try {
      await api.updateSettings({
        maxSendRate: Number(draft.maxSendRate),
        perCampaignDailyLimit: Number(draft.perCampaignDailyLimit),
        globalDailyLimit: Number(draft.globalDailyLimit),
        enforceLimits: !!draft.enforceLimits,
      });
      toast('Sending limits saved');
    } finally {
      setBusy(false);
    }
  }

  const sentToday = mailboxes.reduce((s, m) => s + (m.sentToday || 0), 0);
  const sending = campaigns.filter((c) => c.status === 'sending').length;
  const globalPct = settings.globalDailyLimit ? Math.min(100, Math.round((sentToday / settings.globalDailyLimit) * 100)) : 0;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="section-head">
          <span className="eyebrow">Dispatch policy</span>
          <h2>Settings</h2>
        </div>
        <button className="btn primary" disabled={!dirty || busy} onClick={save}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div className="detail-grid">
        <div className="panel panel-pad">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <IconSettings style={{ width: 18, height: 18, color: 'var(--coral)' }} />
            <h2>Sending limits</h2>
          </div>

          <label className="toggle-row">
            <div>
              <div className="toggle-title">Enforce limits</div>
              <div className="hint">When off, campaigns send at their own rate with no ceiling.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!draft.enforceLimits}
              className={`switch${draft.enforceLimits ? ' on' : ''}`}
              onClick={() => set('enforceLimits', !draft.enforceLimits)}
            >
              <span className="knob" />
            </button>
          </label>

          <div className="divider" style={{ margin: '18px 0' }} />

          <div className="grid" style={{ gap: 22, opacity: draft.enforceLimits ? 1 : 0.5, pointerEvents: draft.enforceLimits ? 'auto' : 'none' }}>
            {FIELDS.map((f) => (
              <div className="field" key={f.key}>
                <label>
                  {f.label} — {num(Number(draft[f.key]))} {f.unit}
                </label>
                <div className="row" style={{ gap: 12 }}>
                  <input
                    className="range"
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={Number(draft[f.key])}
                    onChange={(e) => set(f.key, Number(e.target.value))}
                  />
                  <input
                    className="input"
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={Number(draft[f.key])}
                    style={{ width: 110 }}
                    onChange={(e) => set(f.key, Number(e.target.value))}
                  />
                </div>
                <span className="hint">{f.hint}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel panel-pad">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <span className="eyebrow">Right now</span>
            <h2>Today's volume</h2>
          </div>
          <div className="grid" style={{ gap: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600 }}>{num(sentToday)}</div>
              <div className="mono-tag">emails sent today across {mailboxes.length} mailboxes</div>
            </div>
            <div className="meter">
              <span style={{ width: `${globalPct}%`, background: globalPct >= 90 ? 'var(--amber)' : 'var(--mint)' }} />
            </div>
            <div className="mono-tag">
              {settings.globalDailyLimit ? `${globalPct}% of ${num(settings.globalDailyLimit)} global limit` : 'no global limit set'}
            </div>
            <div className="divider" />
            <div className="kv"><span className="k">Active campaigns</span><span>{sending}</span></div>
            <div className="kv"><span className="k">Enforcement</span><span>{settings.enforceLimits ? 'On' : 'Off'}</span></div>
            <div className="kv"><span className="k">Max rate</span><span>{num(settings.maxSendRate)}/batch</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
