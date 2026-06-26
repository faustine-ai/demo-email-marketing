import { useState, useMemo } from 'react';
import { IconPlus, IconClose, IconAudience, IconUser, IconSearch, IconEdit, IconTrash } from '../components/Icons.jsx';
import { Sparkline } from '../components/ui.jsx';
import { num, compact, ACCENTS } from '../lib/format.js';

const STATUS_LABEL = { subscribed: 'Subscribed', unsubscribed: 'Unsubscribed', bounced: 'Bounced' };
const STATUS_CLASS = { subscribed: 'on', unsubscribed: 'off', bounced: 'off' };

export default function Audiences({ store, api, toast }) {
  const { audiences, contacts, campaigns } = store;
  const [listDrawer, setListDrawer] = useState(false);
  const [contactDrawer, setContactDrawer] = useState(null); // null | true (new) | contact (edit)
  const [query, setQuery] = useState('');
  const [activeList, setActiveList] = useState('all');

  const usage = (id) => campaigns.filter((c) => c.audienceId === id).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (activeList !== 'all' && !c.listIds.includes(activeList)) return false;
      if (!q) return true;
      return c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });
  }, [contacts, query, activeList]);

  const listName = (id) => audiences.find((a) => a.id === id)?.name || id;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="section-head">
          <span className="eyebrow">{num(contacts.length)} contacts · {audiences.length} lists</span>
          <h2>Audiences</h2>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn" onClick={() => setListDrawer(true)}>
            <IconPlus /> New list
          </button>
          <button className="btn primary" onClick={() => setContactDrawer(true)}>
            <IconPlus /> Add contact
          </button>
        </div>
      </div>

      {/* ---- Lists ---- */}
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
                <button
                  className="chip"
                  style={{ marginLeft: 'auto', color: accent, borderColor: accent, cursor: 'pointer', background: 'none' }}
                  onClick={() => setActiveList(a.id)}
                >
                  view contacts · used in {usage(a.id)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Contacts ---- */}
      <div className="panel panel-pad">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div className="section-head">
            <IconUser style={{ width: 18, height: 18, color: 'var(--coral)' }} />
            <h2>Contacts</h2>
            <span className="mono-tag">{num(filtered.length)} shown</span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="search">
              <IconSearch style={{ width: 15, height: 15 }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" />
            </div>
            <select className="select" style={{ width: 'auto' }} value={activeList} onChange={(e) => setActiveList(e.target.value)}>
              <option value="all">All lists</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <div className="big">No contacts here yet</div>
            <div>{query || activeList !== 'all' ? 'Nothing matches the current filter.' : 'Add your first contact to get started.'}</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Status</th>
                <th>Lists</th>
                <th style={{ width: 90 }} className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} onClick={() => setContactDrawer(c)}>
                  <td>
                    <div className="t-name">{c.name}</div>
                    <div className="t-sub">{c.email}</div>
                  </td>
                  <td>
                    <span className={`chip ${STATUS_CLASS[c.status]}`}>{STATUS_LABEL[c.status] || c.status}</span>
                  </td>
                  <td>
                    <div className="row wrap" style={{ gap: 5 }}>
                      {c.listIds.length === 0 && <span className="mono-tag">—</span>}
                      {c.listIds.map((id) => (
                        <span key={id} className="chip">{listName(id)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="icon-btn" title="Edit" onClick={() => setContactDrawer(c)}><IconEdit /></button>
                      <button
                        className="icon-btn"
                        title="Remove"
                        onClick={async () => { await api.deleteContact(c.id); toast('Contact removed'); }}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {listDrawer && (
        <ListDrawer api={api} onClose={() => setListDrawer(false)} onDone={() => { setListDrawer(false); toast('List created'); }} />
      )}
      {contactDrawer && (
        <ContactDrawer
          api={api}
          audiences={audiences}
          contact={contactDrawer === true ? null : contactDrawer}
          onClose={() => setContactDrawer(null)}
          onDone={(msg) => { setContactDrawer(null); toast(msg); }}
        />
      )}
    </div>
  );
}

function ContactDrawer({ api, audiences, contact, onClose, onDone }) {
  const editing = !!contact;
  const [name, setName] = useState(contact?.name || '');
  const [email, setEmail] = useState(contact?.email || '');
  const [status, setStatus] = useState(contact?.status || 'subscribed');
  const [listIds, setListIds] = useState(contact?.listIds || []);
  const [busy, setBusy] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  const toggleList = (id) => setListIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name, email, status, listIds };
      if (editing) {
        await api.updateContact(contact.id, body);
        onDone('Contact updated');
      } else {
        await api.createContact(body);
        onDone('Contact added');
      }
    } catch {
      setBusy(false);
    }
  }

  async function remove() {
    setDelBusy(true);
    try {
      await api.deleteContact(contact.id);
      onDone('Contact removed');
    } catch {
      setDelBusy(false);
    }
  }

  const statuses = ['subscribed', 'unsubscribed', 'bounced'];

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <IconUser style={{ width: 20, height: 20, color: 'var(--coral)' }} />
          <h2>{editing ? 'Edit contact' : 'Add contact'}</h2>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <form className="drawer-body" onSubmit={submit}>
          <div className="field">
            <label>Full name</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Avery Lloyd" />
          </div>
          <div className="field">
            <label>Email address</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="avery@example.com" />
          </div>
          <div className="field">
            <label>Status</label>
            <div className="seg">
              {statuses.map((s) => (
                <button type="button" key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Lists</label>
            <div className="check-grid">
              {audiences.map((a) => (
                <label key={a.id} className={`check-item${listIds.includes(a.id) ? ' on' : ''}`}>
                  <input type="checkbox" checked={listIds.includes(a.id)} onChange={() => toggleList(a.id)} />
                  <span>{a.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="divider" />
          <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
            {editing ? (
              <button type="button" className="btn ghost danger" disabled={delBusy || busy} onClick={remove}>
                <IconTrash /> {delBusy ? 'Removing…' : 'Remove'}
              </button>
            ) : (
              <span />
            )}
            <div className="row" style={{ gap: 10 }}>
              <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn primary" disabled={busy || !email.includes('@')}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Add contact'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function ListDrawer({ api, onClose, onDone }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accent, setAccent] = useState('mint');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createAudience({ name, description, size: 0, accent, filters: [] });
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
          <h2>New list</h2>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>
        <form className="drawer-body" onSubmit={submit}>
          <div className="field">
            <label>List name</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Newsletter subscribers" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who belongs on this list and why" />
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
          <span className="hint">Add contacts to this list from the contact editor once it exists.</span>
          <div className="divider" />
          <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Create list'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
