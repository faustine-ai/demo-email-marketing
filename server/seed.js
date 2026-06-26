// Seed data for the RELAY dispatch console.
// Everything lives in memory — this is a demo, no database required.

// IDs must stay unique across process restarts (the in-memory counter resets,
// but the database persists). Combining the boot time with a per-process counter
// guarantees no collision with IDs minted in an earlier run.
let _seq = 0;
const _boot = Date.now().toString(36);
export const nextId = (prefix) => `${prefix}_${_boot}${(_seq++).toString(36)}`;

// One email in a campaign's drip sequence. Subject + body are authored inline
// (no templates). `delayDays` is the wait after the previous step (the first
// step, 0, goes out the moment a campaign launches).
export const seqStep = (subject, body, delayDays = 0) => ({
  id: nextId('seq'),
  subject,
  body,
  delayDays,
});

const now = Date.now();
const minutes = (n) => n * 60_000;
const hours = (n) => n * 3_600_000;
const days = (n) => n * 86_400_000;

export function buildSeed() {
  const mailboxes = [
    {
      id: 'mbx_aurora',
      address: 'hello@aurora.relay.dev',
      fromName: 'Aurora Team',
      domain: 'aurora.relay.dev',
      provider: 'Relay SMTP',
      status: 'active',
      dailyLimit: 4000,
      sentToday: 1240,
      reputation: 94,
      warmupDay: 30,
      spf: true,
      dkim: true,
      dmarc: true,
      createdAt: now - days(60),
    },
    {
      id: 'mbx_signal',
      address: 'news@signal.relay.dev',
      fromName: 'Signal Weekly',
      domain: 'signal.relay.dev',
      provider: 'Relay SMTP',
      status: 'warming',
      dailyLimit: 800,
      sentToday: 210,
      reputation: 71,
      warmupDay: 9,
      spf: true,
      dkim: true,
      dmarc: false,
      createdAt: now - days(9),
    },
    {
      id: 'mbx_orbit',
      address: 'product@orbit.relay.dev',
      fromName: 'Orbit Product',
      domain: 'orbit.relay.dev',
      provider: 'Relay SMTP',
      status: 'active',
      dailyLimit: 2500,
      sentToday: 640,
      reputation: 88,
      warmupDay: 22,
      spf: true,
      dkim: true,
      dmarc: true,
      createdAt: now - days(40),
    },
    {
      id: 'mbx_paused',
      address: 'offers@deals.relay.dev',
      fromName: 'Relay Deals',
      domain: 'deals.relay.dev',
      provider: 'Relay SMTP',
      status: 'paused',
      dailyLimit: 1500,
      sentToday: 0,
      reputation: 58,
      warmupDay: 4,
      spf: true,
      dkim: false,
      dmarc: false,
      createdAt: now - days(4),
    },
  ];

  const audiences = [
    {
      id: 'aud_active',
      name: 'Active in 30 days',
      description: 'Opened or clicked any email in the last month',
      size: 18420,
      growth: 3.2,
      accent: 'mint',
      filters: [
        { field: 'last_active', op: '<', value: '30d' },
        { field: 'status', op: 'is', value: 'subscribed' },
      ],
    },
    {
      id: 'aud_trial',
      name: 'Trial — no card',
      description: 'Started a trial but has not added billing',
      size: 2630,
      growth: 8.7,
      accent: 'coral',
      filters: [
        { field: 'plan', op: 'is', value: 'trial' },
        { field: 'has_card', op: 'is', value: 'false' },
      ],
    },
    {
      id: 'aud_power',
      name: 'Power users',
      description: 'More than 50 sessions this quarter',
      size: 4115,
      growth: 1.4,
      accent: 'violet',
      filters: [{ field: 'sessions_90d', op: '>', value: '50' }],
    },
    {
      id: 'aud_winback',
      name: 'Win-back',
      description: 'Inactive for 90+ days, was once engaged',
      size: 9870,
      growth: -2.1,
      accent: 'mist',
      filters: [{ field: 'last_active', op: '>', value: '90d' }],
    },
  ];

  const templates = [
    {
      id: 'tpl_launch',
      name: 'Product launch',
      subject: 'Meet the thing you asked for',
      preheader: 'Three years of work, in your inbox',
      category: 'Announcement',
      accent: 'coral',
      blocks: ['hero', 'feature-grid', 'cta', 'footer'],
      updatedAt: now - days(2),
    },
    {
      id: 'tpl_digest',
      name: 'Weekly digest',
      subject: 'Your week in five minutes',
      preheader: 'The five things worth knowing',
      category: 'Newsletter',
      accent: 'violet',
      blocks: ['header', 'article-list', 'divider', 'footer'],
      updatedAt: now - hours(20),
    },
    {
      id: 'tpl_onboard',
      name: 'Onboarding — day 1',
      subject: 'Start here →',
      preheader: 'A two-minute setup, then you are done',
      category: 'Lifecycle',
      accent: 'mint',
      blocks: ['greeting', 'checklist', 'cta', 'footer'],
      updatedAt: now - days(5),
    },
    {
      id: 'tpl_winback',
      name: 'We miss you',
      subject: 'Still want these emails?',
      preheader: 'One click keeps them coming',
      category: 'Lifecycle',
      accent: 'mist',
      blocks: ['hero', 'offer', 'cta', 'footer'],
      updatedAt: now - days(11),
    },
  ];

  const campaigns = [
    {
      id: 'cmp_spring',
      name: 'Spring launch — wave 1',
      status: 'sending',
      mailboxId: 'mbx_aurora',
      audienceId: 'aud_active',
      subject: 'Meet the thing you asked for',
      sendRate: 32,
      scheduledAt: null,
      createdAt: now - hours(2),
      launchedAt: now - minutes(8),
      metrics: blankMetrics(18420, { sent: 9200, delivered: 9010, opened: 4120, clicked: 980, bounced: 190, unsubscribed: 41 }),
      sequence: [
        seqStep(
          'Meet the thing you asked for',
          "It's here. Three years of work, and it finally does the one thing you kept asking us for.\n\nTake a look — we think you'll know it the moment you see it.",
          0
        ),
        seqStep(
          'Did you get a chance to look?',
          "Just circling back in case it slipped past — here's the short version of what changed and why it matters for you.",
          3
        ),
        seqStep(
          "Last call — here's what you're missing",
          "We're closing the early window soon. If you've been meaning to try it, now's the moment.",
          7
        ),
      ],
    },
    {
      id: 'cmp_digest',
      name: 'Weekly digest — #48',
      status: 'scheduled',
      mailboxId: 'mbx_orbit',
      audienceId: 'aud_power',
      subject: 'Your week in five minutes',
      sendRate: 24,
      scheduledAt: now + hours(14),
      createdAt: now - hours(20),
      launchedAt: null,
      metrics: blankMetrics(4115),
      sequence: [
        seqStep(
          'Your week in five minutes',
          'The five things worth knowing this week — short, skimmable, and link out only if you want the detail.',
          0
        ),
      ],
    },
    {
      id: 'cmp_trial',
      name: 'Trial nudge — add billing',
      status: 'draft',
      mailboxId: 'mbx_orbit',
      audienceId: 'aud_trial',
      subject: 'Start here →',
      sendRate: 18,
      scheduledAt: null,
      createdAt: now - hours(5),
      launchedAt: null,
      metrics: blankMetrics(2630),
      sequence: [
        seqStep(
          'Start here →',
          "Welcome aboard. A two-minute setup and you're done — here's the one link to start with.",
          0
        ),
        seqStep(
          'Add billing to keep your data',
          "You're getting real value out of the trial. Add a card now so nothing pauses when the trial ends.",
          2
        ),
        seqStep(
          'Your trial ends soon',
          'Heads up — your trial wraps in a couple of days. Add billing to keep everything exactly as it is.',
          5
        ),
      ],
    },
    {
      id: 'cmp_winback',
      name: 'Win-back — Q2',
      status: 'sent',
      mailboxId: 'mbx_aurora',
      audienceId: 'aud_winback',
      subject: 'Still want these emails?',
      sendRate: 28,
      scheduledAt: null,
      createdAt: now - days(6),
      launchedAt: now - days(6),
      metrics: blankMetrics(9870, { sent: 9870, delivered: 9540, opened: 2870, clicked: 410, bounced: 330, unsubscribed: 188 }),
      sequence: [
        seqStep(
          'Still want these emails?',
          "We haven't seen you in a while. One click keeps these coming — otherwise we'll quietly stop.",
          0
        ),
      ],
    },
  ];

  const activity = [
    evt('mbx_signal warming reached day 9 — limit raised to 800/day', 'info', now - minutes(4)),
    evt('cmp_spring crossed 50% delivered', 'success', now - minutes(6)),
    evt('Bounce spike on deals.relay.dev — mailbox paused', 'warn', now - minutes(48)),
    evt('cmp_winback finished — 9,540 delivered', 'success', now - days(6) + hours(3)),
  ];

  const contacts = [
    contact('avery.lloyd@northwind.io', 'Avery Lloyd', 'subscribed', ['aud_active', 'aud_power'], now - days(40)),
    contact('priya.menon@harborline.com', 'Priya Menon', 'subscribed', ['aud_active'], now - days(33)),
    contact('marcus.webb@cobaltlabs.dev', 'Marcus Webb', 'subscribed', ['aud_power'], now - days(28)),
    contact('jana.koch@meridian.co', 'Jana Koch', 'subscribed', ['aud_trial'], now - days(21)),
    contact('tom.whitfield@lumen.app', 'Tom Whitfield', 'unsubscribed', ['aud_winback'], now - days(18)),
    contact('sofia.reyes@brightpath.org', 'Sofia Reyes', 'subscribed', ['aud_active', 'aud_trial'], now - days(14)),
    contact('dmitri.volkov@arcadia.io', 'Dmitri Volkov', 'subscribed', ['aud_power'], now - days(11)),
    contact('lena.haas@fjordworks.com', 'Lena Haas', 'bounced', ['aud_winback'], now - days(9)),
    contact('noah.bennett@kestrel.dev', 'Noah Bennett', 'subscribed', ['aud_trial'], now - days(6)),
    contact('amelia.frost@oakbridge.co', 'Amelia Frost', 'subscribed', ['aud_active'], now - days(3)),
  ];

  return { mailboxes, audiences, templates, campaigns, activity, contacts };
}

let _ctSeq = 0;
export function contact(email, name, status = 'subscribed', listIds = [], createdAt = Date.now()) {
  return { id: `ct_${_boot}c${(_ctSeq++).toString(36)}`, email: email.trim(), name: name.trim(), status, listIds, createdAt };
}

// Default sending limits — surfaced and editable from the Settings view.
export function defaultSettings() {
  return {
    globalDailyLimit: 50000, // max emails sent per day across all mailboxes
    maxSendRate: 80, // hard cap on a campaign's per-batch send rate
    perCampaignDailyLimit: 20000, // max emails a single campaign sends per day
    enforceLimits: true, // master switch for limit enforcement
  };
}

export function blankMetrics(recipients, over = {}) {
  return {
    recipients,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    unsubscribed: 0,
    ...over,
  };
}

let _evtSeq = 0;
export function evt(message, severity = 'info', ts = Date.now()) {
  return { id: `evt_${ts}_${_evtSeq++}`, message, severity, ts };
}
