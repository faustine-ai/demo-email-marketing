import { useState, useEffect } from 'react';
import DispatchStream from '../components/DispatchStream.jsx';
import { StatusBadge, Meter } from '../components/ui.jsx';
import { IconPlus, IconPlay, IconPause, IconClock, IconTrash, IconArrowLeft, IconChevronUp, IconChevronDown } from '../components/Icons.jsx';
import { num, compact, pct, ratio, relTime, clockTime, STATUS } from '../lib/format.js';

export default function Campaigns({ store, api, selectedId, onSelect, onNew, toast }) {
  if (selectedId) {
    const c = store.campaigns.find((x) => x.id === selectedId);
    if (!c) return <Empty onNew={onNew} onBack={() => onSelect(null)} missing />;
    return <CampaignDetail store={store} api={api} c={c} onBack={() => onSelect(null)} toast={toast} />;
  }
  return <CampaignList store={store} onSelect={onSelect} onNew={onNew} />;
}

function CampaignList({ store, onSelect, onNew }) {
  const { campaigns } = store;
  const order = { sending: 0, paused: 1, scheduled: 2, draft: 3, sent: 4 };
  const rows = [...campaigns].sort((a, b) => (order[a.status] - order[b.status]) || b.createdAt - a.createdAt);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="section-head">
          <span className="eyebrow">{campaigns.length} total</span>
          <h2>Campaigns</h2>
        </div>
        <button className="btn primary" onClick={onNew}>
          <IconPlus /> New campaign
        </button>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Audience</th>
              <th style={{ width: 170 }}>Progress</th>
              <th className="num">Opens</th>
              <th className="num">Clicks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const aud = store.audiences.find((a) => a.id === c.audienceId);
              return (
                <tr key={c.id} onClick={() => onSelect(c.id)}>
                  <td>
                    <div className="t-name">{c.name}</div>
                    <div className="t-sub">{c.subject}</div>
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{aud?.name || '—'}</div>
                    <div className="t-sub">{compact(c.metrics.recipients)} contacts</div>
                  </td>
                  <td>
                    <Meter value={ratio(c.metrics.sent, c.metrics.recipients)} color={STATUS[c.status]?.color} thin />
                    <div className="mono-tag" style={{ marginTop: 5 }}>{pct(c.metrics.sent, c.metrics.recipients, 0)}</div>
                  </td>
                  <td className="num">{c.metrics.delivered ? pct(c.metrics.opened, c.metrics.delivered, 1) : '—'}</td>
                  <td className="num">{c.metrics.delivered ? pct(c.metrics.clicked, c.metrics.delivered, 1) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignDetail({ store, api, c, onBack, toast }) {
  const { mailboxes, audiences, dispatch } = store;
  const m = c.metrics;
  const mailbox = mailboxes.find((x) => x.id === c.mailboxId);
  const audience = audiences.find((x) => x.id === c.audienceId);
  const [busy, setBusy] = useState(false);

  async function act(fn, label) {
    setBusy(true);
    try {
      await fn();
      toast(label);
    } finally {
      setBusy(false);
    }
  }

  const patch = (body) => api.updateCampaign(c.id, body);

  const funnel = [
    ['Recipients', m.recipients, m.recipients, 'var(--mist)'],
    ['Sent', m.sent, m.recipients, 'var(--paper)'],
    ['Delivered', m.delivered, m.recipients, 'var(--mint)'],
    ['Opened', m.opened, m.delivered, 'var(--violet)'],
    ['Clicked', m.clicked, m.delivered, 'var(--coral)'],
    ['Bounced', m.bounced, m.sent, 'var(--amber)'],
    ['Unsub', m.unsubscribed, m.delivered, 'var(--mist)'],
  ];

  return (
    <div className="grid" style={{ gap: 18 }}>
      <button className="back-link" onClick={onBack}>
        <IconArrowLeft style={{ width: 15, height: 15 }} /> All campaigns
      </button>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="row" style={{ gap: 12 }}>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 26 }}>{c.name}</h1>
            <StatusBadge status={c.status} />
          </div>
          <div className="mono-tag" style={{ marginTop: 6 }}>
            {c.subject} · created {relTime(c.createdAt)}
            {c.launchedAt ? ` · launched ${relTime(c.launchedAt)}` : ''}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {(c.status === 'draft' || c.status === 'scheduled' || c.status === 'paused') && (
            <button className="btn primary" disabled={busy} onClick={() => act(() => api.launchCampaign(c.id), 'Dispatch started')}>
              <IconPlay /> {c.status === 'paused' ? 'Resume' : 'Launch now'}
            </button>
          )}
          {c.status === 'sending' && (
            <button className="btn" disabled={busy} onClick={() => act(() => api.pauseCampaign(c.id), 'Dispatch paused')}>
              <IconPause /> Pause
            </button>
          )}
          {c.status === 'draft' && (
            <button className="btn" disabled={busy} onClick={() => act(() => api.scheduleCampaign(c.id, Date.now() + 3600_000), 'Scheduled in 1 hour')}>
              <IconClock /> Schedule
            </button>
          )}
          {c.status !== 'sending' && (
            <button className="icon-btn" disabled={busy} title="Delete" onClick={() => act(() => { api.deleteCampaign(c.id); onBack(); }, 'Campaign deleted')}>
              <IconTrash />
            </button>
          )}
        </div>
      </div>

      <DispatchStream packets={dispatch} campaigns={store.campaigns} campaignId={c.id} height={120} />

      <div className="detail-grid">
        <div className="panel panel-pad">
          <div className="section-head" style={{ marginBottom: 14 }}>
            <span className="eyebrow">Performance</span>
            <h2>Funnel</h2>
          </div>
          {funnel.map(([label, val, base, color]) => (
            <div className="funnel-row" key={label}>
              <span className="lbl">{label}</span>
              <Meter value={ratio(val, base)} color={color} />
              <span className="val">{num(val)}</span>
              <span className="pc">{base ? pct(val, base, 0) : '—'}</span>
            </div>
          ))}
        </div>

        <div className="panel panel-pad">
          <div className="section-head" style={{ marginBottom: 14 }}>
            <span className="eyebrow">Configuration</span>
            <h2>Setup</h2>
          </div>
          <div className="grid" style={{ gap: 14 }}>
            <div className="field">
              <label>Send from</label>
              <select className="select" value={c.mailboxId} disabled={c.status === 'sending' || c.status === 'sent'} onChange={(e) => patch({ mailboxId: e.target.value })}>
                {mailboxes.map((mb) => (
                  <option key={mb.id} value={mb.id}>{mb.address}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Audience</label>
              <select className="select" value={c.audienceId} disabled={c.metrics.sent > 0} onChange={(e) => patch({ audienceId: e.target.value })}>
                {audiences.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {compact(a.size)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Send rate — {c.sendRate} msg / batch</label>
              <input className="range" type="range" min="4" max="80" value={c.sendRate} onChange={(e) => patch({ sendRate: Number(e.target.value) })} />
            </div>
            <div className="divider" />
            <div className="kv"><span className="k">Mailbox reputation</span><span>{mailbox?.reputation ?? '—'}</span></div>
            <div className="kv"><span className="k">Emails in sequence</span><span>{c.sequence?.length ?? 0}</span></div>
            {c.scheduledAt && <div className="kv"><span className="k">Scheduled</span><span>{clockTime(c.scheduledAt)}</span></div>}
          </div>
        </div>
      </div>

      <SequencePanel c={c} api={api} toast={toast} />
    </div>
  );
}

// The email sequence — an ordered drip of emails. Step 1 always goes out on
// launch; later steps wait `delayDays` after the one before. Each step's
// subject and body are authored inline; step 1's subject mirrors the campaign
// headline (kept in sync server-side).
function SequencePanel({ c, api, toast }) {
  const steps = c.sequence ?? [];
  const [busy, setBusy] = useState(false);

  // Cumulative day offset for each step (step 1 = day 0; ignores step 1's delay).
  let acc = 0;
  const dayOffsets = steps.map((s, i) => (i === 0 ? 0 : (acc += s.delayDays)));
  const totalDays = dayOffsets[dayOffsets.length - 1] || 0;

  async function run(fn, label) {
    setBusy(true);
    try {
      await fn();
      if (label) toast(label);
    } finally {
      setBusy(false);
    }
  }

  const addStep = () =>
    run(() => api.addSequenceStep(c.id, { subject: 'Follow-up', body: '', delayDays: 3 }), 'Sequence step added');

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const order = steps.map((s) => s.id);
    [order[i], order[j]] = [order[j], order[i]];
    run(() => api.reorderSequence(c.id, order));
  }

  return (
    <div className="panel panel-pad">
      <div className="section-head" style={{ marginBottom: 16 }}>
        <span className="eyebrow">Drip</span>
        <h2>Email sequence</h2>
        <div className="spacer" />
        <span className="mono-tag">
          {steps.length} {steps.length === 1 ? 'email' : 'emails'}
          {totalDays > 0 ? ` · ${totalDays}-day span` : ''}
        </span>
      </div>

      <div className="seq">
        {steps.map((step, i) => (
          <SequenceStep
            key={step.id}
            c={c}
            step={step}
            index={i}
            dayOffset={dayOffsets[i]}
            isFirst={i === 0}
            isLast={i === steps.length - 1}
            soloStep={steps.length === 1}
            api={api}
            toast={toast}
            busy={busy}
            onMove={move}
          />
        ))}
      </div>

      <button className="btn sm" style={{ marginTop: 16 }} disabled={busy} onClick={addStep}>
        <IconPlus /> Add step
      </button>
    </div>
  );
}

function SequenceStep({ c, step, index, dayOffset, isFirst, isLast, soloStep, api, toast, busy, onMove }) {
  const [subject, setSubject] = useState(step.subject);
  const [body, setBody] = useState(step.body ?? '');
  // Re-sync if the values change elsewhere (another tab, reorder, headline edit).
  useEffect(() => setSubject(step.subject), [step.subject]);
  useEffect(() => setBody(step.body ?? ''), [step.body]);

  const commitSubject = () => {
    const v = subject.trim();
    if (v && v !== step.subject) api.updateSequenceStep(c.id, step.id, { subject: v });
    else setSubject(step.subject);
  };
  const commitBody = () => {
    if (body !== (step.body ?? '')) api.updateSequenceStep(c.id, step.id, { body });
  };

  const setDelay = (delayDays) => api.updateSequenceStep(c.id, step.id, { delayDays });
  const remove = async () => {
    await api.removeSequenceStep(c.id, step.id);
    toast('Sequence step removed');
  };

  return (
    <div className="seq-step">
      <div className="seq-rail">
        <div className="seq-num">{index + 1}</div>
        {!isLast && <span className="seq-line" />}
      </div>
      <div className="seq-card">
        <div className="seq-card-head">
          <div className="seq-when">
            <span className="seq-day">{isFirst ? 'On launch' : `Day ${dayOffset}`}</span>
            {!isFirst && <span className="mono-tag">+{step.delayDays}d after previous</span>}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="icon-btn" disabled={busy || isFirst} title="Move earlier" onClick={() => onMove(index, -1)}>
              <IconChevronUp />
            </button>
            <button className="icon-btn" disabled={busy || isLast} title="Move later" onClick={() => onMove(index, 1)}>
              <IconChevronDown />
            </button>
            <button className="icon-btn" disabled={busy || soloStep} title={soloStep ? 'A campaign keeps at least one email' : 'Remove step'} onClick={remove}>
              <IconTrash />
            </button>
          </div>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>Subject line</label>
          <input
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={commitSubject}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="Subject line"
          />
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>Email body</label>
          <textarea
            className="textarea"
            value={body}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
            onBlur={commitBody}
            placeholder="Write the email…"
          />
        </div>

        <div className="field" style={{ marginTop: 12, maxWidth: 260 }}>
          <label>{isFirst ? 'Timing' : 'Delay after previous'}</label>
          {isFirst ? (
            <div className="select" style={{ color: 'var(--mist)', display: 'flex', alignItems: 'center' }}>
              Sends immediately
            </div>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                type="number"
                min="0"
                max="90"
                value={step.delayDays}
                style={{ width: 90 }}
                onChange={(e) => setDelay(Number(e.target.value))}
              />
              <span className="mono-tag">days after previous email</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ onBack }) {
  return (
    <div className="grid" style={{ gap: 18 }}>
      <button className="back-link" onClick={onBack}>
        <IconArrowLeft style={{ width: 15, height: 15 }} /> All campaigns
      </button>
      <div className="panel panel-pad">
        <div className="empty">
          <div className="big">Campaign not found</div>
          <div>It may have been deleted from another session.</div>
        </div>
      </div>
    </div>
  );
}
