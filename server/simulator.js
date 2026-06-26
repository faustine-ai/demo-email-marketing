// The dispatch engine. No real email leaves the building — instead we model
// what a sending campaign *looks like* over time and stream it to clients:
// packets onto the dispatch stream, metric deltas, and activity events.
import { _state, broadcast, pushActivity, persistCampaign, persistMailbox, getSettings } from './store.js';

const TICK_MS = 350;

// Rough funnel rates for the simulation.
const DELIVER = 0.97;
const OPEN = 0.46;
const CLICK = 0.11;
const UNSUB = 0.004;

let started = false;

export function startSimulator() {
  if (started) return;
  started = true;
  setInterval(tick, TICK_MS);
}

function tick() {
  const state = _state();
  const settings = getSettings() || {};
  const enforce = settings.enforceLimits !== false;
  const packets = [];

  // Global volume ceiling — total sent across every mailbox today.
  const globalSent = () => state.mailboxes.reduce((s, mb) => s + (mb.sentToday || 0), 0);
  let globalHalted = false;

  for (const c of state.campaigns) {
    if (c.status !== 'sending') continue;

    const m = c.metrics;
    const remaining = m.recipients - m.sent;
    if (remaining <= 0) {
      finish(c);
      continue;
    }

    // Per-campaign daily volume cap — pause the campaign once it's reached.
    if (enforce && settings.perCampaignDailyLimit > 0 && m.sent >= settings.perCampaignDailyLimit) {
      c.status = 'paused';
      persistCampaign(c);
      broadcast('campaign:update', c);
      pushActivity(`${c.name} hit its per-campaign limit (${settings.perCampaignDailyLimit.toLocaleString()}) — paused`, 'warn');
      continue;
    }

    // Global volume ceiling — stop sending for this tick once breached.
    if (enforce && settings.globalDailyLimit > 0 && globalSent() >= settings.globalDailyLimit) {
      if (!globalHalted) {
        globalHalted = true;
        if (!tick._globalNotified) {
          tick._globalNotified = true;
          pushActivity(`Global daily limit reached (${settings.globalDailyLimit.toLocaleString()}) — dispatch holding`, 'warn');
        }
      }
      continue;
    } else if (!globalHalted) {
      tick._globalNotified = false;
    }

    // Send a jittered batch sized by the campaign's send rate, capped by the
    // configured maximum send rate and any remaining limit headroom.
    const rate = enforce && settings.maxSendRate > 0 ? Math.min(c.sendRate, settings.maxSendRate) : c.sendRate;
    let batch = Math.max(1, Math.min(remaining, Math.round(rate * (0.6 + Math.random() * 0.9))));
    if (enforce && settings.perCampaignDailyLimit > 0) {
      batch = Math.min(batch, settings.perCampaignDailyLimit - m.sent);
    }
    if (enforce && settings.globalDailyLimit > 0) {
      batch = Math.min(batch, settings.globalDailyLimit - globalSent());
    }
    if (batch <= 0) continue;
    let delivered = 0;
    let bounced = 0;
    let opened = 0;
    let clicked = 0;
    let unsub = 0;

    for (let i = 0; i < batch; i++) {
      if (Math.random() < DELIVER) {
        delivered++;
        if (Math.random() < OPEN) {
          opened++;
          if (Math.random() < CLICK) clicked++;
          if (Math.random() < UNSUB) unsub++;
        }
      } else {
        bounced++;
      }
    }

    m.sent += batch;
    m.delivered += delivered;
    m.bounced += bounced;
    m.opened += opened;
    m.clicked += clicked;
    m.unsubscribed += unsub;

    // Count this batch against the mailbox's daily volume.
    const mbx = state.mailboxes.find((x) => x.id === c.mailboxId);
    if (mbx) {
      mbx.sentToday += batch;
      persistMailbox(mbx);
    }

    // A few representative packets feed the live stream (not one per email).
    const sample = Math.min(batch, 6);
    for (let i = 0; i < sample; i++) {
      const r = Math.random();
      const kind = r < 0.03 ? 'bounce' : r < 0.5 ? 'open' : r < 0.62 ? 'click' : 'delivered';
      packets.push({ campaignId: c.id, kind, t: Date.now() + i });
    }

    persistCampaign(c);
    broadcast('campaign:update', c);

    // Narrate milestones once.
    const pct = m.sent / m.recipients;
    c._milestones = c._milestones || {};
    for (const mark of [0.25, 0.5, 0.75]) {
      if (pct >= mark && !c._milestones[mark]) {
        c._milestones[mark] = true;
        pushActivity(`${c.name} crossed ${Math.round(mark * 100)}% sent`, 'info');
      }
    }
  }

  if (packets.length) broadcast('dispatch', { packets });

  ambient(state);
}

function finish(c) {
  c.status = 'sent';
  c.finishedAt = Date.now();
  persistCampaign(c);
  broadcast('campaign:update', c);
  pushActivity(`${c.name} complete — ${c.metrics.delivered.toLocaleString()} delivered`, 'success');
}

// Slow, ambient life so the console breathes even with nothing launching:
// warmups progress, reputations drift, daily counters tick.
let ambientTick = 0;
function ambient(state) {
  ambientTick++;
  if (ambientTick % 20 !== 0) return; // every ~7s

  for (const mbx of state.mailboxes) {
    if (mbx.status === 'warming') {
      // Nudge reputation upward as it warms.
      if (mbx.reputation < 92 && Math.random() < 0.4) {
        mbx.reputation = Math.min(92, mbx.reputation + 1);
        persistMailbox(mbx);
        broadcast('mailbox:update', mbx);
      }
    } else if (mbx.status === 'active') {
      const drift = Math.random() < 0.5 ? 1 : -1;
      const next = Math.max(60, Math.min(99, mbx.reputation + drift));
      if (next !== mbx.reputation) {
        mbx.reputation = next;
        persistMailbox(mbx);
        broadcast('mailbox:update', mbx);
      }
    }
  }
}
