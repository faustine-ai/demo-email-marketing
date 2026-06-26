import { useState } from 'react';
import { IconPlus, IconClose, IconTemplate, IconTrash } from '../components/Icons.jsx';
import { relTime, ACCENTS } from '../lib/format.js';

// A tiny faux email preview built from the template's block list — gives each
// card a recognizable silhouette without rendering real HTML email.
function BlockPreview({ blocks, accent }) {
  const shapes = {
    hero: <div style={{ height: 26, borderRadius: 4, background: accent, opacity: 0.85 }} />,
    header: <div style={{ height: 12, width: '40%', borderRadius: 3, background: accent }} />,
    greeting: <div style={{ height: 10, width: '55%', borderRadius: 3, background: 'var(--line)' }} />,
    'feature-grid': (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ height: 18, borderRadius: 3, background: 'var(--line)' }} />)}
      </div>
    ),
    'article-list': (
      <div style={{ display: 'grid', gap: 4 }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ height: 8, borderRadius: 2, background: 'var(--line)', width: `${90 - i * 12}%` }} />)}
      </div>
    ),
    checklist: (
      <div style={{ display: 'grid', gap: 4 }}>
        {[0, 1].map((i) => <div key={i} style={{ height: 8, borderRadius: 2, background: 'var(--line)', width: '70%' }} />)}
      </div>
    ),
    offer: <div style={{ height: 20, borderRadius: 4, background: accent, opacity: 0.35 }} />,
    divider: <div style={{ height: 1, background: 'var(--line)' }} />,
    body: <div style={{ height: 22, borderRadius: 3, background: 'var(--line)' }} />,
    cta: <div style={{ height: 14, width: '45%', borderRadius: 7, background: accent, margin: '0 auto' }} />,
    footer: <div style={{ height: 6, width: '60%', borderRadius: 2, background: 'var(--line-soft)', margin: '0 auto' }} />,
  };
  return (
    <div style={{ background: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 8, padding: 12, display: 'grid', gap: 7 }}>
      {blocks.map((b, i) => <div key={i}>{shapes[b] || shapes.body}</div>)}
    </div>
  );
}

export default function Templates({ store, api, toast }) {
  const { templates } = store;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null); // template object being edited

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="section-head">
          <span className="eyebrow">{templates.length} reusable layouts</span>
          <h2>Templates</h2>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <IconPlus /> New template
        </button>
      </div>

      <div className="grid cols-3">
        {templates.map((t) => {
          const accent = ACCENTS[t.accent] || ACCENTS.mist;
          return (
            <div key={t.id} className="card card-clickable" onClick={() => setEditing(t)} title="Edit template">
              <BlockPreview blocks={t.blocks} accent={accent} />
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
                <h3>{t.name}</h3>
                <span className="chip" style={{ color: accent, borderColor: accent }}>{t.category}</span>
              </div>
              <div className="mono-tag" style={{ marginTop: 8 }}>Subject</div>
              <div style={{ fontSize: 13.5 }}>{t.subject}</div>
              <div className="divider" style={{ margin: '12px 0' }} />
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="mono-tag">edited {relTime(t.updatedAt)}</span>
                <span className="mono-tag">{t.blocks.length} blocks</span>
              </div>
            </div>
          );
        })}
      </div>

      {(creating || editing) && (
        <TemplateDrawer
          api={api}
          toast={toast}
          template={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onDone={(msg) => { setCreating(false); setEditing(null); toast(msg); }}
        />
      )}
    </div>
  );
}

function TemplateDrawer({ api, toast, template, onClose, onDone }) {
  const editing = !!template;
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [preheader, setPreheader] = useState(template?.preheader || '');
  const [category, setCategory] = useState(template?.category || 'Newsletter');
  const [accent, setAccent] = useState(template?.accent || 'violet');
  const [busy, setBusy] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  const cats = ['Announcement', 'Newsletter', 'Lifecycle', 'Custom'];
  const accents = ['coral', 'violet', 'mint', 'mist'];

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name, subject, preheader, category, accent };
      if (editing) {
        await api.updateTemplate(template.id, body);
        onDone('Template updated');
      } else {
        await api.createTemplate(body);
        onDone('Template created');
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setDelBusy(true);
    try {
      await api.deleteTemplate(template.id);
      onDone('Template deleted');
    } catch (err) {
      // Most commonly: the template is still referenced by a campaign.
      toast(err.message || 'Could not delete template');
      setDelBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <IconTemplate style={{ width: 20, height: 20, color: 'var(--coral)' }} />
          <h2>{editing ? 'Edit template' : 'New template'}</h2>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <form className="drawer-body" onSubmit={submit}>
          <div className="field">
            <label>Template name</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly product update" />
          </div>
          <div className="field">
            <label>Subject line</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What shipped this month" />
          </div>
          <div className="field">
            <label>Preheader</label>
            <input className="input" value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="The preview text after the subject" />
          </div>
          <div className="field">
            <label>Category</label>
            <div className="seg">
              {cats.map((c) => (
                <button type="button" key={c} className={category === c ? 'on' : ''} onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
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
          <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
            {editing ? (
              <button type="button" className="btn ghost danger" disabled={delBusy || busy} onClick={remove}>
                <IconTrash /> {delBusy ? 'Deleting…' : 'Delete'}
              </button>
            ) : (
              <span />
            )}
            <div className="row" style={{ gap: 10 }}>
              <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Create template'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
