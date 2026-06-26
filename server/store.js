// A live in-memory copy of the world + a tiny pub/sub so the WebSocket layer
// can broadcast every significant change. SQLite (see db.js) is the durable
// store: we load the world from it on boot and write through on every change.
import { buildSeed, blankMetrics, evt, nextId } from './seed.js';
import * as db from './db.js';

// First boot on a fresh database: lay down the seed world. Afterwards we always
// hydrate from disk, so edits and dispatch progress survive restarts.
if (db.isEmpty()) db.seed(buildSeed());
const state = db.loadState();

const subscribers = new Set();

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, ts: Date.now() });
  for (const fn of subscribers) fn(msg);
}

export function snapshot() {
  return {
    campaigns: state.campaigns,
    mailboxes: state.mailboxes,
    audiences: state.audiences,
    templates: state.templates,
    activity: state.activity.slice(0, 60),
  };
}

// ---- helpers ----------------------------------------------------------
const find = (list, id) => list.find((x) => x.id === id);

export function pushActivity(message, severity = 'info') {
  const e = evt(message, severity);
  state.activity.unshift(e);
  state.activity = state.activity.slice(0, 200);
  db.saveActivity(e);
  db.trimActivity(200);
  broadcast('activity', e);
  return e;
}

// Write-through helpers — persist a campaign row (metrics/status/scalars) and,
// when its emails changed, its sequence steps. Exported so the simulator can
// persist the metric deltas it produces each tick.
export function persistCampaign(c, withSequence = false) {
  db.saveCampaign(c);
  if (withSequence) db.replaceSequence(c.id, c.sequence ?? []);
}
export function persistMailbox(m) {
  db.saveMailbox(m);
}

// ---- campaigns --------------------------------------------------------
export function listCampaigns() {
  return state.campaigns;
}

export function getCampaign(id) {
  return find(state.campaigns, id);
}

export function createCampaign(input = {}) {
  const audience = find(state.audiences, input.audienceId) || state.audiences[0];
  const c = {
    id: nextId('cmp'),
    name: input.name?.trim() || 'Untitled campaign',
    status: 'draft',
    mailboxId: input.mailboxId || state.mailboxes[0]?.id,
    audienceId: audience?.id,
    subject: input.subject?.trim() || 'No subject yet',
    sendRate: clamp(input.sendRate ?? 24, 4, 80),
    scheduledAt: input.scheduledAt ?? null,
    createdAt: Date.now(),
    launchedAt: null,
    metrics: blankMetrics(audience?.size ?? 0),
  };
  // Every campaign starts as a one-step sequence: the initial send. Its subject
  // and body are authored inline; follow-up steps can be added from the detail view.
  c.sequence = [{ id: nextId('seq'), subject: c.subject, body: input.body?.trim() || '', delayDays: 0 }];
  state.campaigns.unshift(c);
  persistCampaign(c, true);
  broadcast('campaign:update', c);
  pushActivity(`Campaign drafted — ${c.name}`, 'info');
  return c;
}

export function updateCampaign(id, patch = {}) {
  const c = getCampaign(id);
  if (!c) return null;
  const allowed = ['name', 'subject', 'mailboxId', 'audienceId', 'sendRate', 'scheduledAt'];
  for (const k of allowed) {
    if (k in patch && patch[k] != null) c[k] = k === 'sendRate' ? clamp(patch[k], 4, 80) : patch[k];
  }
  // Recompute recipient count when the audience changes and sending hasn't started.
  if ('audienceId' in patch && c.metrics.sent === 0) {
    const aud = find(state.audiences, c.audienceId);
    if (aud) c.metrics.recipients = aud.size;
  }
  // Keep the first sequence step's subject in step with the campaign headline.
  const first = c.sequence?.[0];
  const subjectChanged = first && 'subject' in patch && patch.subject != null;
  if (subjectChanged) first.subject = c.subject;
  persistCampaign(c, subjectChanged);
  broadcast('campaign:update', c);
  return c;
}

// ---- campaign sequences ----------------------------------------------
// The sequence is the source of truth for which emails a campaign sends; each
// step's subject and body are authored inline. The campaign's top-level subject
// mirrors step 1 so the list and funnel views stay coherent.
function syncPrimaryFromSequence(c) {
  const first = c.sequence?.[0];
  if (first) c.subject = first.subject;
}

export function addSequenceStep(id, input = {}) {
  const c = getCampaign(id);
  if (!c) return null;
  if (!Array.isArray(c.sequence)) c.sequence = [];
  const step = {
    id: nextId('seq'),
    subject: input.subject?.trim() || 'Follow-up',
    body: input.body?.trim() || '',
    delayDays: clamp(input.delayDays ?? 3, 0, 90),
  };
  c.sequence.push(step);
  syncPrimaryFromSequence(c);
  persistCampaign(c, true);
  broadcast('campaign:update', c);
  pushActivity(`Sequence step added — ${c.name} (${c.sequence.length} emails)`, 'info');
  return c;
}

export function updateSequenceStep(id, stepId, patch = {}) {
  const c = getCampaign(id);
  if (!c) return null;
  const step = c.sequence?.find((s) => s.id === stepId);
  if (!step) return null;
  if ('subject' in patch && patch.subject != null) step.subject = patch.subject.trim() || step.subject;
  if ('body' in patch && patch.body != null) step.body = patch.body;
  if ('delayDays' in patch && patch.delayDays != null) step.delayDays = clamp(patch.delayDays, 0, 90);
  syncPrimaryFromSequence(c);
  persistCampaign(c, true);
  broadcast('campaign:update', c);
  return c;
}

export function removeSequenceStep(id, stepId) {
  const c = getCampaign(id);
  if (!c) return null;
  if (!Array.isArray(c.sequence) || c.sequence.length <= 1) return c; // always keep one step
  c.sequence = c.sequence.filter((s) => s.id !== stepId);
  syncPrimaryFromSequence(c);
  persistCampaign(c, true);
  broadcast('campaign:update', c);
  pushActivity(`Sequence step removed — ${c.name}`, 'warn');
  return c;
}

export function reorderSequence(id, order = []) {
  const c = getCampaign(id);
  if (!c || !Array.isArray(c.sequence)) return null;
  const byId = new Map(c.sequence.map((s) => [s.id, s]));
  const next = order.map((sid) => byId.get(sid)).filter(Boolean);
  // Defend against a partial/garbled order: only commit when every step is accounted for.
  if (next.length === c.sequence.length) {
    c.sequence = next;
    syncPrimaryFromSequence(c);
    persistCampaign(c, true);
    broadcast('campaign:update', c);
  }
  return c;
}

export function launchCampaign(id) {
  const c = getCampaign(id);
  if (!c) return null;
  if (c.status === 'sent') return c;
  c.status = 'sending';
  c.launchedAt = c.launchedAt || Date.now();
  c.scheduledAt = null;
  persistCampaign(c);
  broadcast('campaign:update', c);
  pushActivity(`Dispatch started — ${c.name}`, 'success');
  return c;
}

export function pauseCampaign(id) {
  const c = getCampaign(id);
  if (!c) return null;
  if (c.status === 'sending') {
    c.status = 'paused';
    persistCampaign(c);
    broadcast('campaign:update', c);
    pushActivity(`Dispatch paused — ${c.name}`, 'warn');
  }
  return c;
}

export function scheduleCampaign(id, scheduledAt) {
  const c = getCampaign(id);
  if (!c) return null;
  c.status = 'scheduled';
  c.scheduledAt = scheduledAt || Date.now() + 3_600_000;
  persistCampaign(c);
  broadcast('campaign:update', c);
  pushActivity(`Campaign scheduled — ${c.name}`, 'info');
  return c;
}

export function deleteCampaign(id) {
  const i = state.campaigns.findIndex((x) => x.id === id);
  if (i < 0) return false;
  const [removed] = state.campaigns.splice(i, 1);
  db.deleteCampaign(id);
  broadcast('campaign:remove', { id });
  pushActivity(`Campaign deleted — ${removed.name}`, 'warn');
  return true;
}

// ---- mailboxes --------------------------------------------------------
export function listMailboxes() {
  return state.mailboxes;
}

export function updateMailbox(id, patch = {}) {
  const m = find(state.mailboxes, id);
  if (!m) return null;
  const allowed = ['fromName', 'dailyLimit', 'status', 'spf', 'dkim', 'dmarc'];
  for (const k of allowed) if (k in patch) m[k] = patch[k];
  db.saveMailbox(m);
  broadcast('mailbox:update', m);
  if ('status' in patch) pushActivity(`Mailbox ${m.address} → ${patch.status}`, patch.status === 'paused' ? 'warn' : 'info');
  return m;
}

export function createMailbox(input = {}) {
  const local = (input.address || 'inbox@new.relay.dev').toLowerCase();
  const m = {
    id: nextId('mbx'),
    address: local,
    fromName: input.fromName?.trim() || 'New Sender',
    domain: local.split('@')[1] || 'new.relay.dev',
    provider: 'Relay SMTP',
    status: 'warming',
    dailyLimit: clamp(input.dailyLimit ?? 200, 50, 10000),
    sentToday: 0,
    reputation: 50,
    warmupDay: 0,
    spf: false,
    dkim: false,
    dmarc: false,
    createdAt: Date.now(),
  };
  state.mailboxes.push(m);
  db.saveMailbox(m);
  broadcast('mailbox:update', m);
  pushActivity(`Mailbox connected — ${m.address} (warming)`, 'info');
  return m;
}

// ---- audiences --------------------------------------------------------
export function listAudiences() {
  return state.audiences;
}

export function createAudience(input = {}) {
  const a = {
    id: nextId('aud'),
    name: input.name?.trim() || 'New segment',
    description: input.description?.trim() || 'No description',
    size: clamp(input.size ?? 0, 0, 1_000_000),
    growth: 0,
    accent: input.accent || 'mist',
    filters: Array.isArray(input.filters) ? input.filters : [],
  };
  state.audiences.push(a);
  db.saveAudience(a);
  broadcast('audience:update', a);
  pushActivity(`Segment created — ${a.name}`, 'info');
  return a;
}

// ---- templates --------------------------------------------------------
export function listTemplates() {
  return state.templates;
}

export function updateTemplate(id, patch = {}) {
  const t = find(state.templates, id);
  if (!t) return null;
  const allowed = ['name', 'subject', 'preheader', 'category', 'accent'];
  for (const k of allowed) if (k in patch) t[k] = patch[k];
  t.updatedAt = Date.now();
  db.saveTemplate(t);
  broadcast('template:update', t);
  return t;
}

// Templates are standalone reusable layouts — campaigns author their emails
// inline, so a template can be removed at any time.
export function deleteTemplate(id) {
  const t = find(state.templates, id);
  if (!t) return { ok: false, code: 404 };
  state.templates = state.templates.filter((x) => x.id !== id);
  db.deleteTemplate(id);
  broadcast('template:remove', { id });
  pushActivity(`Template deleted — ${t.name}`, 'warn');
  return { ok: true };
}

export function createTemplate(input = {}) {
  const t = {
    id: nextId('tpl'),
    name: input.name?.trim() || 'Untitled template',
    subject: input.subject?.trim() || 'No subject',
    preheader: input.preheader?.trim() || '',
    category: input.category || 'Custom',
    accent: input.accent || 'mist',
    blocks: ['hero', 'body', 'cta', 'footer'],
    updatedAt: Date.now(),
  };
  state.templates.push(t);
  db.saveTemplate(t);
  broadcast('template:update', t);
  pushActivity(`Template created — ${t.name}`, 'info');
  return t;
}

// raw access for the simulator
export function _state() {
  return state;
}

function clamp(n, lo, hi) {
  n = Number(n);
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
