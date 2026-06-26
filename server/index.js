import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import * as store from './store.js';
import { subscribe, snapshot } from './store.js';
import { startSimulator } from './simulator.js';
import * as db from './db.js';
import { verifyPassword, signToken, verifyToken } from './auth.js';

const PORT = process.env.PORT || 4100;
const app = express();
app.use(express.json());

// --- Auth --------------------------------------------------------------
// Username + password login issues a JWT; every other /api route requires a
// valid `Authorization: Bearer <token>` header. The client keeps the token in
// sessionStorage and also passes it to the WebSocket as a query param.
const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role });

app.get('/api/health', (_req, res) => res.json({ ok: true, clients: wss?.clients.size ?? 0 }));

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.getUserByUsername(String(username || '').trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = signToken({ sub: user.id, username: user.username });
  res.json({ token, user: publicUser(user) });
});

// Guard everything else under /api (health + login are already handled above).
app.use('/api', (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const claims = verifyToken(token);
  const user = claims && db.getUserById(claims.sub);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
});

app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/state', (_req, res) => res.json(snapshot()));

// campaigns
app.post('/api/campaigns', (req, res) => res.status(201).json(store.createCampaign(req.body)));
app.patch('/api/campaigns/:id', (req, res) => ok(res, store.updateCampaign(req.params.id, req.body)));
app.post('/api/campaigns/:id/launch', (req, res) => ok(res, store.launchCampaign(req.params.id)));
app.post('/api/campaigns/:id/pause', (req, res) => ok(res, store.pauseCampaign(req.params.id)));
app.post('/api/campaigns/:id/stop', (req, res) => ok(res, store.stopCampaign(req.params.id)));
app.post('/api/campaigns/:id/schedule', (req, res) => ok(res, store.scheduleCampaign(req.params.id, req.body?.scheduledAt)));
app.delete('/api/campaigns/:id', (req, res) =>
  store.deleteCampaign(req.params.id) ? res.status(204).end() : res.status(404).json({ error: 'not found' })
);

// campaign email sequence (drip steps)
app.post('/api/campaigns/:id/sequence', (req, res) => ok(res, store.addSequenceStep(req.params.id, req.body)));
app.patch('/api/campaigns/:id/sequence/:stepId', (req, res) => ok(res, store.updateSequenceStep(req.params.id, req.params.stepId, req.body)));
app.delete('/api/campaigns/:id/sequence/:stepId', (req, res) => ok(res, store.removeSequenceStep(req.params.id, req.params.stepId)));
app.post('/api/campaigns/:id/sequence/reorder', (req, res) => ok(res, store.reorderSequence(req.params.id, req.body?.order)));

// mailboxes
app.post('/api/mailboxes', (req, res) => res.status(201).json(store.createMailbox(req.body)));
app.patch('/api/mailboxes/:id', (req, res) => ok(res, store.updateMailbox(req.params.id, req.body)));

// audiences (lists)
app.post('/api/audiences', (req, res) => res.status(201).json(store.createAudience(req.body)));

// contacts
app.post('/api/contacts', (req, res) => {
  const r = store.createContact(req.body);
  if (r?.error) return res.status(400).json({ error: r.error });
  return res.status(201).json(r);
});
app.patch('/api/contacts/:id', (req, res) => ok(res, store.updateContact(req.params.id, req.body)));
app.delete('/api/contacts/:id', (req, res) =>
  store.deleteContact(req.params.id) ? res.status(204).end() : res.status(404).json({ error: 'not found' })
);

// settings (sending limits)
app.patch('/api/settings', (req, res) => res.json(store.updateSettings(req.body)));

// templates
app.post('/api/templates', (req, res) => res.status(201).json(store.createTemplate(req.body)));
app.patch('/api/templates/:id', (req, res) => ok(res, store.updateTemplate(req.params.id, req.body)));
app.delete('/api/templates/:id', (req, res) => {
  const r = store.deleteTemplate(req.params.id);
  if (r.ok) return res.status(204).end();
  if (r.code === 404) return res.status(404).json({ error: 'not found' });
  return res.status(409).json({ error: 'in_use', inUse: r.inUse });
});

function ok(res, value) {
  return value ? res.json(value) : res.status(404).json({ error: 'not found' });
}

// --- HTTP + WebSocket --------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  // Authenticate the socket from the `token` query param. Without a valid token
  // the connection is closed immediately (4401 = app-level unauthorized).
  let token = null;
  try {
    token = new URL(req.url, 'http://localhost').searchParams.get('token');
  } catch {
    /* malformed url */
  }
  const claims = verifyToken(token);
  if (!claims || !db.getUserById(claims.sub)) {
    ws.close(4401, 'unauthorized');
    return;
  }

  // Hand the new client the full world, then stream every change.
  ws.send(JSON.stringify({ type: 'snapshot', data: snapshot(), ts: Date.now() }));
  const unsub = subscribe((msg) => {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  });
  ws.on('close', unsub);
  ws.on('error', unsub);
});

// Heartbeat so clients can render an honest connection state.
setInterval(() => {
  store.broadcast('heartbeat', { clients: wss.clients.size });
}, 5000);

server.listen(PORT, () => {
  startSimulator();
  console.log(`\n  RELAY dispatch console`);
  console.log(`  API   →  http://localhost:${PORT}/api`);
  console.log(`  WS    →  ws://localhost:${PORT}/ws\n`);
});
