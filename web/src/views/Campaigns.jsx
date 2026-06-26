import { useState, useEffect } from 'react';
import DispatchStream from '../components/DispatchStream.jsx';
import { StatusBadge, Meter } from '../components/ui.jsx';
import {
  IconPlus, IconPlay, IconPause, IconStop, IconClock, IconTrash, IconArrowLeft, IconChevronUp, IconChevronDown,
} from '../components/Icons.jsx';
import { num, compact, pct, ratio, relTime, clockTime, STATUS } from '../lib/format.js';

export default function Campaigns({ store, api, selectedId, onSelect, onNew, toast }) {
  if (selectedId) {
    const c = store.campaigns.find((x) => x.id === selectedId);
    if (!c) return <Empty onNew={onNew} onBack={() => onSelect(null)} missing />;
    return <CampaignDetail store={store} api={api} c={c} onBack={() => onSelect(null)} toast={toast} />;
  }
  return <CampaignList store={store} api={api} onSelect={onSelect} onNew={onNew} toast={toast} />;
}

// Shared play / pause / stop controls, used in both the list and the detail.
// `compact` renders icon-only buttons for the table; otherwise labelled buttons.
function CampaignControls({ c, api, toast, compact: iconOnly, onAfterDelete }) {
  const [busy, setBusy] = useState(false);

  async function act(fn, label, after) {
    setBusy(true);
    try {
      await fn();
      if (label) toast(label);
      after?.();
    } finally {
      setBusy(false);
    }
  }

  const canPlay = c.status === 'draft' || c.status === 'scheduled' || c.status === 'paused';
  const canPause = c.status === 'sending';
  const canStop = c.status === 'sending' || c.status === 'paused' || c.status === 'scheduled';
  const playLabel = c.status === 'paused' ? 'Resume' : c.status === 'scheduled' ? 'Launch now' : 'Launch';

  if (iconOnly) {
    return (
      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
        {canPlay && (
          <button className="icon-btn play" disabled={busy} title={playLabel} onClick={() => act(() => api.launchCampaign(c.id), c.status === 'paused' ? 'Dispatch resumed' : 'Dispatch started')}>
            <IconPlay />
          </button>
        )}
        {canPause && (
          <button className="icon-btn" disabled={busy} title="Pause" onClick={() => act(() => api.pauseCampaign(c.id), 'Dispatch paused')}>
            <IconPause />
          </button>
        )}
        {canStop && (
          <button className="icon-btn stop" disabled={busy} title="Stop" onClick={() => act(() => api.stopCampaign(c.id), 'Dispatch stopped')}>
            <IconStop />
          </button>
        )}
        {!canPlay && !canPause && !canStop && <span className="mono-tag">—</span>}
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 8 }}>
      {canPlay && (
        <button className="btn primary" disabled={busy} onClick={() => act(() => api.launchCampaign(c.id), c.status === 'paused' ? 'Dispatch resumed' : 'Dispatch started')}>
          <IconPlay /> {playLabel}
        </button>
      )}
      {canPause && (
        <button className="btn" disabled={busy} onClick={() => act(() => api.pauseCampaign(c.id), 'Dispatch paused')}>
          <IconPause /> Pause
        </button>
      )}
      {canStop && (
        <button className="btn" disabled={busy} onClick={() => act(() => api.stopCampaign(c.id), 'Dispatch stopped')}>
          <IconStop /> Stop
        </button>
      )}
      {c.status === 'draft' && (
        <button className="btn" disabled={busy} onClick={() => act(() => api.scheduleCampaign(c.id, Date.now() + 3600_000), 'Scheduled in 1 hour')}>
          <IconClock /> Schedule
        </button>
      )}
      {c.status !== 'sending' && (
        <button className="icon-btn" disabled={busy} title="Delete" onClick={() => act(() => api.deleteCampaign(c.id), 'Campaign deleted', onAfterDelete)}>
          <IconTrash />
        </button>
      )}
    </div>
  );
}

function CampaignList({ store, api, onSelect, onNew, toast }) {
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
              <th style={{ width: 150 }}>Progress</th>
              <th className="num">Opens</th>
              <th style={{ width: 130 }} className="num">Controls</th>
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
                  <td className="num">
                    <CampaignControls c={c} api={api} toast={toast} compact />
                  </td>
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

  const patch = (body) => api.updateCampaign(c.id, body);

  // A compact, readable KPI strip — the headline numbers without the full funnel.
  const kpis = [
    { label: 'Sent', value: compact(m.sent), sub: `${pct(m.sent, m.recipients, 0)} of ${compact(m.recipients)}`, color: 'var(--paper)' },
    { label: 'Delivered', value: m.sent ? pct(m.delivered, m.sent, 1) : '—', sub: `${compact(m.delivered)} inboxed`, color: 'var(--mint)' },
    { label: 'Open rate', value: m.delivered ? pct(m.opened, m.delivered, 1) : '—', sub: `${compact(m.opened)} opens`, color: 'var(--violet)' },
    { label: 'Click rate', value: m.delivered ? pct(m.clicked, m.delivered, 1) : '—', sub: `${compact(m.clicked)} clicks`, color: 'var(--coral)' },
  ];

  return (
    <div className="grid" style={{ gap: 18 }}>
      <button className="back-link" onClick={onBack}>
        <IconArrowLeft style={{ width: 15, height: 15 }} /> All campaigns
      </button>

      {/* ---- Header ---- */}
      <div className="detail-head">
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 12 }}>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 24 }}>{c.name}</h1>
            <StatusBadge status={c.status} />
          </div>
          <div className="mono-tag" style={{ marginTop: 6 }}>
            {c.subject} · created {relTime(c.createdAt)}
            {c.launchedAt ? ` · launched ${relTime(c.launchedAt)}` : ''}
            {c.scheduledAt ? ` · scheduled ${clockTime(c.scheduledAt)}` : ''}
          </div>
        </div>
        <CampaignControls c={c} api={api} toast={toast} onAfterDelete={onBack} />
      </div>

      {/* ---- KPI strip + progress ---- */}
      <div className="panel panel-pad">
        <div className="kpi-strip">
          {kpis.map((k) => (
            <div className="kpi" key={k.label}>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Meter value={ratio(m.sent, m.recipients)} color={STATUS[c.status]?.color} />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span className="mono-tag">{num(m.sent)} sent · {num(m.bounced)} bounced · {num(m.unsubscribed)} unsubscribed</span>
            <span className="mono-tag">{num(m.recipients)} recipients</span>
          </div>
        </div>
      </div>

      <DispatchStream packets={dispatch} campaigns={store.campaigns} campaignId={c.id} height={120} />

      {/* ---- Setup ---- */}
      <div className="panel panel-pad">
        <div className="section-head" style={{ marginBottom: 16 }}>
          <span className="eyebrow">Configuration</span>
          <h2>Setup</h2>
        </div>
        <div className="setup-grid">
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
            <span className="hint">Mailbox reputation {mailbox?.reputation ?? '—'} · {c.sequence?.length ?? 0} email{(c.sequence?.length ?? 0) === 1 ? '' : 's'} in sequence</span>
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

        {!isFirst && (
          <div className="field" style={{ marginTop: 12, maxWidth: 260 }}>
            <label>Delay after previous</label>
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
          </div>
        )}
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
