// SQLite persistence for the RELAY console. The store keeps a live in-memory
// copy of the world (so the simulator can mutate fast, by reference), and every
// change is written through to SQLite here. On boot we load the world back from
// disk — so campaigns, sequences, metrics and activity survive restarts.
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'relay.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS mailboxes (
    id TEXT PRIMARY KEY, address TEXT, fromName TEXT, domain TEXT, provider TEXT,
    status TEXT, dailyLimit INTEGER, sentToday INTEGER, reputation INTEGER,
    warmupDay INTEGER, spf INTEGER, dkim INTEGER, dmarc INTEGER, createdAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS audiences (
    id TEXT PRIMARY KEY, name TEXT, description TEXT, size INTEGER, growth REAL,
    accent TEXT, filters TEXT
  );
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY, name TEXT, subject TEXT, preheader TEXT, category TEXT,
    accent TEXT, blocks TEXT, updatedAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY, name TEXT, status TEXT, mailboxId TEXT, audienceId TEXT,
    subject TEXT, sendRate INTEGER, scheduledAt INTEGER, createdAt INTEGER,
    launchedAt INTEGER, metrics TEXT
  );
  CREATE TABLE IF NOT EXISTS sequence_steps (
    id TEXT PRIMARY KEY, campaignId TEXT, position INTEGER,
    subject TEXT, body TEXT, delayDays INTEGER
  );
  CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY, message TEXT, severity TEXT, ts INTEGER
  );
`);

const bool = (v) => (v ? 1 : 0);

// ---- row <-> object mappers ------------------------------------------
const rowToMailbox = (r) => ({
  id: r.id, address: r.address, fromName: r.fromName, domain: r.domain, provider: r.provider,
  status: r.status, dailyLimit: r.dailyLimit, sentToday: r.sentToday, reputation: r.reputation,
  warmupDay: r.warmupDay, spf: !!r.spf, dkim: !!r.dkim, dmarc: !!r.dmarc, createdAt: r.createdAt,
});
const rowToAudience = (r) => ({
  id: r.id, name: r.name, description: r.description, size: r.size, growth: r.growth,
  accent: r.accent, filters: JSON.parse(r.filters || '[]'),
});
const rowToTemplate = (r) => ({
  id: r.id, name: r.name, subject: r.subject, preheader: r.preheader, category: r.category,
  accent: r.accent, blocks: JSON.parse(r.blocks || '[]'), updatedAt: r.updatedAt,
});
const rowToCampaign = (r, sequence) => ({
  id: r.id, name: r.name, status: r.status, mailboxId: r.mailboxId, audienceId: r.audienceId,
  subject: r.subject, sendRate: r.sendRate, scheduledAt: r.scheduledAt, createdAt: r.createdAt,
  launchedAt: r.launchedAt, metrics: JSON.parse(r.metrics || '{}'), sequence,
});
const rowToActivity = (r) => ({ id: r.id, message: r.message, severity: r.severity, ts: r.ts });

// ---- prepared statements ---------------------------------------------
const upMailbox = db.prepare(`
  INSERT INTO mailboxes (id,address,fromName,domain,provider,status,dailyLimit,sentToday,reputation,warmupDay,spf,dkim,dmarc,createdAt)
  VALUES (@id,@address,@fromName,@domain,@provider,@status,@dailyLimit,@sentToday,@reputation,@warmupDay,@spf,@dkim,@dmarc,@createdAt)
  ON CONFLICT(id) DO UPDATE SET address=@address,fromName=@fromName,domain=@domain,provider=@provider,status=@status,
    dailyLimit=@dailyLimit,sentToday=@sentToday,reputation=@reputation,warmupDay=@warmupDay,spf=@spf,dkim=@dkim,dmarc=@dmarc,createdAt=@createdAt
`);
const upAudience = db.prepare(`
  INSERT INTO audiences (id,name,description,size,growth,accent,filters)
  VALUES (@id,@name,@description,@size,@growth,@accent,@filters)
  ON CONFLICT(id) DO UPDATE SET name=@name,description=@description,size=@size,growth=@growth,accent=@accent,filters=@filters
`);
const upTemplate = db.prepare(`
  INSERT INTO templates (id,name,subject,preheader,category,accent,blocks,updatedAt)
  VALUES (@id,@name,@subject,@preheader,@category,@accent,@blocks,@updatedAt)
  ON CONFLICT(id) DO UPDATE SET name=@name,subject=@subject,preheader=@preheader,category=@category,accent=@accent,blocks=@blocks,updatedAt=@updatedAt
`);
const upCampaign = db.prepare(`
  INSERT INTO campaigns (id,name,status,mailboxId,audienceId,subject,sendRate,scheduledAt,createdAt,launchedAt,metrics)
  VALUES (@id,@name,@status,@mailboxId,@audienceId,@subject,@sendRate,@scheduledAt,@createdAt,@launchedAt,@metrics)
  ON CONFLICT(id) DO UPDATE SET name=@name,status=@status,mailboxId=@mailboxId,audienceId=@audienceId,subject=@subject,
    sendRate=@sendRate,scheduledAt=@scheduledAt,createdAt=@createdAt,launchedAt=@launchedAt,metrics=@metrics
`);
const delCampaignRow = db.prepare('DELETE FROM campaigns WHERE id = ?');
const delTemplateRow = db.prepare('DELETE FROM templates WHERE id = ?');
const delStepsForCampaign = db.prepare('DELETE FROM sequence_steps WHERE campaignId = ?');
const insStep = db.prepare(`
  INSERT INTO sequence_steps (id,campaignId,position,subject,body,delayDays)
  VALUES (@id,@campaignId,@position,@subject,@body,@delayDays)
`);
const insActivity = db.prepare('INSERT OR REPLACE INTO activity (id,message,severity,ts) VALUES (@id,@message,@severity,@ts)');
const trimActivityStmt = db.prepare('DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY ts DESC LIMIT ?)');

// ---- public write API -------------------------------------------------
export const saveMailbox = (m) => upMailbox.run({ ...m, spf: bool(m.spf), dkim: bool(m.dkim), dmarc: bool(m.dmarc) });
export const saveAudience = (a) => upAudience.run({ ...a, filters: JSON.stringify(a.filters ?? []) });
export const saveTemplate = (t) => upTemplate.run({ ...t, blocks: JSON.stringify(t.blocks ?? []) });

export const saveCampaign = (c) =>
  upCampaign.run({
    id: c.id, name: c.name, status: c.status, mailboxId: c.mailboxId, audienceId: c.audienceId,
    subject: c.subject, sendRate: c.sendRate, scheduledAt: c.scheduledAt ?? null,
    createdAt: c.createdAt, launchedAt: c.launchedAt ?? null, metrics: JSON.stringify(c.metrics ?? {}),
  });

export const replaceSequence = db.transaction((campaignId, steps) => {
  delStepsForCampaign.run(campaignId);
  steps.forEach((s, i) =>
    insStep.run({ id: s.id, campaignId, position: i, subject: s.subject, body: s.body ?? '', delayDays: s.delayDays ?? 0 })
  );
});

export const deleteCampaign = db.transaction((id) => {
  delStepsForCampaign.run(id);
  delCampaignRow.run(id);
});

export const deleteTemplate = (id) => delTemplateRow.run(id);
export const saveActivity = (e) => insActivity.run(e);
export const trimActivity = (limit) => trimActivityStmt.run(limit);

// ---- load / seed ------------------------------------------------------
export function isEmpty() {
  return db.prepare('SELECT COUNT(*) AS n FROM campaigns').get().n === 0;
}

// Seed the database from buildSeed() output, once, inside a transaction.
export const seed = db.transaction((world) => {
  for (const m of world.mailboxes) saveMailbox(m);
  for (const a of world.audiences) saveAudience(a);
  for (const t of world.templates) saveTemplate(t);
  for (const c of world.campaigns) {
    saveCampaign(c);
    replaceSequence(c.id, c.sequence ?? []);
  }
  for (const e of world.activity) saveActivity(e);
});

export function loadState() {
  const mailboxes = db.prepare('SELECT * FROM mailboxes ORDER BY rowid').all().map(rowToMailbox);
  const audiences = db.prepare('SELECT * FROM audiences ORDER BY rowid').all().map(rowToAudience);
  const templates = db.prepare('SELECT * FROM templates ORDER BY rowid').all().map(rowToTemplate);

  const stepsByCampaign = {};
  for (const r of db.prepare('SELECT * FROM sequence_steps ORDER BY campaignId, position').all()) {
    (stepsByCampaign[r.campaignId] ||= []).push({ id: r.id, subject: r.subject, body: r.body, delayDays: r.delayDays });
  }
  const campaigns = db
    .prepare('SELECT * FROM campaigns ORDER BY createdAt DESC')
    .all()
    .map((r) => rowToCampaign(r, stepsByCampaign[r.id] || []));

  const activity = db.prepare('SELECT * FROM activity ORDER BY ts DESC LIMIT 200').all().map(rowToActivity);
  return { mailboxes, audiences, templates, campaigns, activity };
}

export default db;
