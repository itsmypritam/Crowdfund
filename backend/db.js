const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

function openDatabase(filePath) {
  if (filePath !== ":memory:") {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      goal REAL NOT NULL,
      total_raised REAL NOT NULL DEFAULT 0,
      total_released REAL NOT NULL DEFAULT 0,
      deadline INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      token TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL,
      donor TEXT NOT NULL,
      amount REAL NOT NULL,
      hash TEXT NOT NULL UNIQUE,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_donations_campaign ON donations (campaign_id);

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      tx_hash TEXT,
      wallet TEXT,
      address TEXT,
      donor TEXT,
      amount REAL,
      campaign_id TEXT,
      url TEXT,
      method TEXT,
      path TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_txhash
      ON analytics_events (tx_hash) WHERE tx_hash IS NOT NULL AND tx_hash <> '';
    CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events (type);

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet TEXT NOT NULL,
      rating INTEGER,
      message TEXT DEFAULT '',
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS referrals (
      code TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      uses INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_wallet ON referrals (wallet);

    CREATE TABLE IF NOT EXISTS referrals_used (
      wallet TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      used_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      campaign_id TEXT,
      link TEXT DEFAULT '',
      read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_wallet ON notifications (wallet);
  `);
  db.pragma("user_version = 1");
}

function importLegacy(db, legacyPath) {
  if (legacyPath === ":memory:" || !fs.existsSync(legacyPath)) return;
  const already = db.prepare("SELECT value FROM meta WHERE key = 'legacy_imported'").get();
  if (already) return;
  try {
    const data = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
    const now = Date.now();

    const insertEvent = db.prepare(
      `INSERT OR IGNORE INTO analytics_events
       (type, timestamp, tx_hash, wallet, address, donor, amount, campaign_id, url, method, path)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    );
    for (const e of Array.isArray(data.analyticsEvents) ? data.analyticsEvents : []) {
      insertEvent.run(
        e.type,
        e.timestamp || now,
        e.txHash || null,
        e.wallet || null,
        e.address || null,
        e.donor || null,
        e.amount != null ? Number(e.amount) : null,
        e.campaignId || null,
        e.url || null,
        e.method || null,
        e.path || null
      );
    }

    const insertFeedback = db.prepare(
      "INSERT OR IGNORE INTO feedback (wallet, rating, message, timestamp) VALUES (?,?,?,?)"
    );
    for (const f of Array.isArray(data.feedback) ? data.feedback : []) {
      insertFeedback.run(f.wallet, f.rating || null, f.message || "", f.timestamp || now);
    }

    const insertCampaign = db.prepare(
      `INSERT OR IGNORE INTO campaigns
       (id, owner, goal, total_raised, total_released, deadline, title, description, status, token, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    );
    for (const [id, c] of Object.entries(data.campaigns || {})) {
      insertCampaign.run(
        id,
        c.owner,
        c.goal,
        c.totalRaised || 0,
        0,
        c.deadline,
        c.title || "",
        c.description || "",
        "active",
        c.token || "",
        c.createdAt || now
      );
    }

    const insertDonation = db.prepare(
      "INSERT OR IGNORE INTO donations (campaign_id, donor, amount, hash, timestamp) VALUES (?,?,?,?,?)"
    );
    for (const [id, list] of Object.entries(data.donations || {})) {
      for (const d of list || []) {
        insertDonation.run(id, d.donor, d.amount, d.hash || "", d.timestamp || now);
      }
    }

    if (data.contractId) {
      db.prepare("INSERT OR REPLACE INTO contracts (id, updated_at) VALUES (?, ?)").run(
        data.contractId,
        now
      );
    }
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('legacy_imported', ?)").run(
      new Date().toISOString()
    );
  } catch (err) {
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('legacy_import_error', ?)").run(
      err.message
    );
  }
}

module.exports = { openDatabase, importLegacy, migrate };
