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
  contacts: [],
  settings: null,
  activity: [],
  dispatch: [], // rolling buffer of recent dispatch packets for the live stream
  lastEventAt: 0,
};

// ---- auth token (kept in sessionStorage) ------------------------------
const TOKEN_KEY = 'relay_token';
export const getToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (token) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn || (() => {});
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
        contacts: data.contacts ?? [],
        settings: data.settings ?? null,
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
    case 'contact:update':
      set({ ...state, contacts: upsert(state.contacts, data) });
      break;
    case 'contact:remove':
      set({ ...state, contacts: state.contacts.filter((c) => c.id !== data.id) });
      break;
    case 'settings:update':
      set({ ...state, settings: data });
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
  const token = getToken();
  if (!token) return; // not authenticated yet
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`;

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
  ws.onclose = (ev) => {
    set({ ...state, connection: 'closed' });
    clearTimeout(reconnectTimer);
    // 4401 = the server rejected our token; bounce to login instead of looping.
    if (ev.code === 4401) {
      onUnauthorized();
      return;
    }
    if (getToken()) reconnectTimer = setTimeout(connect, 1500);
  };
  ws.onerror = () => ws.close();
}

export function disconnect() {
  clearTimeout(reconnectTimer);
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  set({ ...state, connection: 'connecting' });
}

// ---- actions (REST; the server echoes changes back over the socket) ---
function authHeaders(hasBody) {
  const h = {};
  if (hasBody) h['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function call(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: authHeaders(!!body),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    onUnauthorized();
    throw new Error('unauthorized');
  }
  if (!res.ok && res.status !== 204) throw new Error(`${method} ${path} → ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// ---- auth actions -----------------------------------------------------
export async function login(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const msg = res.status === 401 ? 'Wrong username or password' : `Login failed (${res.status})`;
    throw new Error(msg);
  }
  const data = await res.json();
  setToken(data.token);
  return data.user;
}

export async function fetchMe() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return (await res.json()).user;
  } catch {
    return null;
  }
}

export function logout() {
  setToken(null);
  disconnect();
}

export const api = {
  createCampaign: (b) => call('POST', '/campaigns', b),
  updateCampaign: (id, b) => call('PATCH', `/campaigns/${id}`, b),
  launchCampaign: (id) => call('POST', `/campaigns/${id}/launch`),
  pauseCampaign: (id) => call('POST', `/campaigns/${id}/pause`),
  stopCampaign: (id) => call('POST', `/campaigns/${id}/stop`),
  scheduleCampaign: (id, scheduledAt) => call('POST', `/campaigns/${id}/schedule`, { scheduledAt }),
  deleteCampaign: (id) => call('DELETE', `/campaigns/${id}`),
  addSequenceStep: (id, b) => call('POST', `/campaigns/${id}/sequence`, b),
  updateSequenceStep: (id, stepId, b) => call('PATCH', `/campaigns/${id}/sequence/${stepId}`, b),
  removeSequenceStep: (id, stepId) => call('DELETE', `/campaigns/${id}/sequence/${stepId}`),
  reorderSequence: (id, order) => call('POST', `/campaigns/${id}/sequence/reorder`, { order }),
  createMailbox: (b) => call('POST', '/mailboxes', b),
  updateMailbox: (id, b) => call('PATCH', `/mailboxes/${id}`, b),
  createAudience: (b) => call('POST', '/audiences', b),
  createContact: (b) => call('POST', '/contacts', b),
  updateContact: (id, b) => call('PATCH', `/contacts/${id}`, b),
  deleteContact: (id) => call('DELETE', `/contacts/${id}`),
  updateSettings: (b) => call('PATCH', '/settings', b),
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
