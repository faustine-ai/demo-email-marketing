// A tiny external store wired to the server's WebSocket feed.
// Components read it through useSyncExternalStore (see hooks.js). Every
// significant change on the server arrives here as a message and is folded
// into a fresh state object so React re-renders the right pieces.

let state = {
  connection: 'connecting', // connecting | open | closed
  clients: 1,
  campaigns: [],
  mailboxes: [],
  audiences: [],
  templates: [],
  activity: [],
  dispatch: [], // rolling buffer of recent dispatch packets for the live stream
  lastEventAt: 0,
};

const listeners = new Set();
let packetSeq = 0;

function set(next) {
  state = next;
  for (const l of listeners) l();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

// ---- message handling -------------------------------------------------
function upsert(list, item, key = 'id') {
  const i = list.findIndex((x) => x[key] === item[key]);
  if (i === -1) return [item, ...list];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

function applyMessage(type, data) {
  switch (type) {
    case 'snapshot':
      set({
        ...state,
        connection: 'open',
        campaigns: data.campaigns,
        mailboxes: data.mailboxes,
        audiences: data.audiences,
        templates: data.templates,
        activity: data.activity,
        lastEventAt: Date.now(),
      });
      break;
    case 'campaign:update':
      set({ ...state, campaigns: upsert(state.campaigns, data), lastEventAt: Date.now() });
      break;
    case 'campaign:remove':
      set({ ...state, campaigns: state.campaigns.filter((c) => c.id !== data.id) });
      break;
    case 'mailbox:update':
      set({ ...state, mailboxes: upsert(state.mailboxes, data) });
      break;
    case 'audience:update':
      set({ ...state, audiences: upsert(state.audiences, data) });
      break;
    case 'template:update':
      set({ ...state, templates: upsert(state.templates, data) });
      break;
    case 'template:remove':
      set({ ...state, templates: state.templates.filter((t) => t.id !== data.id) });
      break;
    case 'activity':
      set({ ...state, activity: [data, ...state.activity].slice(0, 120), lastEventAt: Date.now() });
      break;
    case 'dispatch': {
      const tagged = data.packets.map((p) => ({ ...p, id: `pk_${packetSeq++}` }));
      const merged = [...tagged, ...state.dispatch].slice(0, 90);
      set({ ...state, dispatch: merged, lastEventAt: Date.now() });
      break;
    }
    case 'heartbeat':
      if (data.clients !== state.clients) set({ ...state, clients: data.clients });
      break;
    default:
      break;
  }
}

// ---- connection -------------------------------------------------------
let ws;
let reconnectTimer;

export function connect() {
  if (typeof window === 'undefined') return;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${window.location.host}/ws`;

  ws = new WebSocket(url);

  ws.onopen = () => set({ ...state, connection: 'open' });
  ws.onmessage = (ev) => {
    try {
      const { type, data } = JSON.parse(ev.data);
      applyMessage(type, data);
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onclose = () => {
    set({ ...state, connection: 'closed' });
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 1500);
  };
  ws.onerror = () => ws.close();
}

// ---- actions (REST; the server echoes changes back over the socket) ---
async function call(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 204) throw new Error(`${method} ${path} → ${res.status}`);
  return res.status === 204 ? null : res.json();
}

export const api = {
  createCampaign: (b) => call('POST', '/campaigns', b),
  updateCampaign: (id, b) => call('PATCH', `/campaigns/${id}`, b),
  launchCampaign: (id) => call('POST', `/campaigns/${id}/launch`),
  pauseCampaign: (id) => call('POST', `/campaigns/${id}/pause`),
  scheduleCampaign: (id, scheduledAt) => call('POST', `/campaigns/${id}/schedule`, { scheduledAt }),
  deleteCampaign: (id) => call('DELETE', `/campaigns/${id}`),
  addSequenceStep: (id, b) => call('POST', `/campaigns/${id}/sequence`, b),
  updateSequenceStep: (id, stepId, b) => call('PATCH', `/campaigns/${id}/sequence/${stepId}`, b),
  removeSequenceStep: (id, stepId) => call('DELETE', `/campaigns/${id}/sequence/${stepId}`),
  reorderSequence: (id, order) => call('POST', `/campaigns/${id}/sequence/reorder`, { order }),
  createMailbox: (b) => call('POST', '/mailboxes', b),
  updateMailbox: (id, b) => call('PATCH', `/mailboxes/${id}`, b),
  createAudience: (b) => call('POST', '/audiences', b),
  createTemplate: (b) => call('POST', '/templates', b),
  updateTemplate: (id, b) => call('PATCH', `/templates/${id}`, b),
  deleteTemplate: async (id) => {
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (res.status === 204) return null;
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      const names = body.inUse || [];
      const err = new Error(
        names.length
          ? `In use by ${names.length} campaign${names.length === 1 ? '' : 's'}: ${names.join(', ')}`
          : 'Template is in use'
      );
      err.inUse = names;
      throw err;
    }
    throw new Error(`DELETE /templates/${id} → ${res.status}`);
  },
};
