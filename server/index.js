import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import * as store from './store.js';
import { subscribe, snapshot } from './store.js';
import { startSimulator } from './simulator.js';

const PORT = process.env.PORT || 4100;
const app = express();
app.use(express.json());

// --- REST API ----------------------------------------------------------
// Mutations also broadcast over WebSocket, so every connected tab stays
// in sync in real time.

app.get('/api/state', (_req, res) => res.json(snapshot()));
app.get('/api/health', (_req, res) => res.json({ ok: true, clients: wss?.clients.size ?? 0 }));

// campaigns
app.post('/api/campaigns', (req, res) => res.status(201).json(store.createCampaign(req.body)));
app.patch('/api/campaigns/:id', (req, res) => ok(res, store.updateCampaign(req.params.id, req.body)));
app.post('/api/campaigns/:id/launch', (req, res) => ok(res, store.launchCampaign(req.params.id)));
app.post('/api/campaigns/:id/pause', (req, res) => ok(res, store.pauseCampaign(req.params.id)));
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

// audiences
app.post('/api/audiences', (req, res) => res.status(201).json(store.createAudience(req.body)));

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

wss.on('connection', (ws) => {
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
