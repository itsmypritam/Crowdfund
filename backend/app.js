const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const path = require("path");
const { WebSocketServer, WebSocket } = require("ws");
const { pinoHttp } = require("pino-http");
const { z } = require("zod");

const ROW_TO_CAMPAIGN = (r) => ({
  id: r.id,
  owner: r.owner,
  goal: r.goal,
  totalRaised: r.total_raised,
  totalReleased: r.total_released,
  deadline: r.deadline,
  title: r.title,
  description: r.description,
  status: r.status,
  token: r.token,
  createdAt: r.created_at,
});

const ROW_TO_EVENT = (r) => ({
  id: r.id,
  type: r.type,
  timestamp: r.timestamp,
  txHash: r.tx_hash,
  wallet: r.wallet,
  address: r.address,
  donor: r.donor,
  amount: r.amount,
  campaignId: r.campaign_id,
  url: r.url,
  method: r.method,
  path: r.path,
});

const campaignSchema = z.object({
  id: z.string().min(3).max(80).regex(/^[A-Za-z0-9]+$/, "invalid campaign id"),
  owner: z.string().min(8).max(70),
  goal: z.coerce.number().positive("goal must be positive").max(1e15),
  deadline: z.string().refine((s) => !isNaN(Date.parse(s)), "invalid deadline"),
  title: z.string().min(1, "title required").max(200),
  description: z.string().max(2000).optional().default(""),
  token: z.string().max(80).optional().default(""),
});

const donationSchema = z.object({
  campaignId: z.string().min(3).max(80),
  donor: z.string().min(8).max(70),
  amount: z.coerce.number().positive("amount must be positive").max(1e12),
  hash: z.string().regex(/^[0-9a-f]{64}$/i, "invalid transaction hash"),
});

const feedbackSchema = z.object({
  wallet: z.string().min(8).max(70),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  message: z.string().max(500).optional().default(""),
});

const analyticsSchema = z.object({ type: z.string().min(1).max(60) }).passthrough();

const withdrawalSchema = z.object({
  campaignId: z.string().min(3).max(80),
  owner: z.string().min(8).max(70),
});

function createApp({
  config,
  db,
  logger,
  verifyDonation = null,
  enableRateLimit = true,
  rateLimitOptions = {},
}) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const wsClients = new Set();

  app.use(helmet({ contentSecurityPolicy: false }));
  if (logger) app.use(pinoHttp({ logger, autoLogging: false }));

  const corsOrigin = config.allowedOrigins.length > 0 ? config.allowedOrigins : true;
  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Admin-Key"],
    })
  );
  app.use(express.json({ limit: "50kb" }));

  if (enableRateLimit) {
    app.use(
      "/api",
      rateLimit({
        windowMs: 60_000,
        limit: 120,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        ...rateLimitOptions,
      })
    );
  }

  function requireAdmin(req, res, next) {
    if (!config.adminKey) return next();
    const key = req.get("x-admin-key") || "";
    if (key !== config.adminKey) return res.status(401).json({ error: "unauthorized" });
    next();
  }

  function currentContractId() {
    const row = db.prepare("SELECT id FROM contracts ORDER BY updated_at DESC LIMIT 1").get();
    return row ? row.id : config.contractId;
  }

  function recordEvent(type, data = {}) {
    db.prepare(
      `INSERT OR IGNORE INTO analytics_events
       (type, timestamp, tx_hash, wallet, address, donor, amount, campaign_id, url, method, path)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      type,
      Date.now(),
      data.txHash || null,
      data.wallet || null,
      data.address || null,
      data.donor || null,
      data.amount != null ? Number(data.amount) : null,
      data.campaignId || null,
      data.url || null,
      data.method || null,
      data.path || null
    );
  }

  app.use((req, _res, next) => {
    recordEvent("request", { method: req.method, path: req.path });
    next();
  });

  function broadcast(data) {
    const msg = JSON.stringify(data);
    for (const ws of wsClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }

  wss.on("connection", (ws) => {
    wsClients.add(ws);
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === "subscribe:campaign" && msg.campaignId) {
          ws.send(JSON.stringify({ type: "campaign:subscribed", campaignId: msg.campaignId }));
        }
      } catch {}
    });
    ws.on("close", () => {
      wsClients.delete(ws);
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wsClients) {
      if (!ws.isAlive) {
        ws.terminate();
        wsClients.delete(ws);
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  if (heartbeat.unref) heartbeat.unref();

  app.get("/", (_req, res) =>
    res.json({ service: "CrowdEscrow", status: "running", contractId: currentContractId() })
  );

  app.get("/health", async (_req, res) => {
    let dbOk = false;
    try {
      db.prepare("SELECT 1").get();
      dbOk = true;
    } catch {}
    let horizonOk = false;
    if (config.verifyDonations) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const r = await fetch(config.horizonUrl, { signal: controller.signal });
        horizonOk = r.ok;
      } catch {}
      clearTimeout(timer);
    } else {
      horizonOk = true;
    }
    const ok = dbOk && horizonOk;
    res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded", db: dbOk, horizon: horizonOk });
  });

  // ── contract id ─────────────────────────────────────────────────
  app.get("/api/contract-id", (_req, res) => res.json({ contractId: currentContractId() }));

  app.post("/api/contract-id", requireAdmin, (req, res) => {
    const parsed = z
      .object({ contractId: z.string().max(80).optional().default("") })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const contractId = parsed.data.contractId.trim();
    if (contractId) {
      db.prepare("INSERT OR REPLACE INTO contracts (id, updated_at) VALUES (?, ?)").run(
        contractId,
        Date.now()
      );
    } else {
      db.prepare("DELETE FROM contracts").run();
    }
    res.json({ contractId: currentContractId() });
  });

  // ── campaigns ──────────────────────────────────────────────────
  app.get("/api/campaigns", (req, res) => {
    const requested = parseInt(req.query.limit || "50", 10);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 200) : 50;
    const rows = db
      .prepare("SELECT * FROM campaigns ORDER BY created_at DESC LIMIT ?")
      .all(limit);
    res.json(rows.map(ROW_TO_CAMPAIGN));
  });

  app.post("/api/campaigns", (req, res) => {
    const parsed = campaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { id, owner, goal, deadline, title, description, token } = parsed.data;
    const exists = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(id);
    if (exists) return res.status(409).json({ error: "campaign already exists" });
    const createdAt = Date.now();
    db.prepare(
      `INSERT INTO campaigns
       (id, owner, goal, total_raised, total_released, deadline, title, description, status, token, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(id, owner, goal, 0, 0, new Date(deadline).getTime(), title, description, "active", token, createdAt);
    recordEvent("campaign_created", { campaignId: id, owner });
    broadcast({ type: "campaign:updated", campaignId: id });
    res.status(201).json(ROW_TO_CAMPAIGN(db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id)));
  });

  app.get("/api/campaigns/:id", (req, res) => {
    const row = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "campaign not found" });
    res.json(ROW_TO_CAMPAIGN(row));
  });

  app.get("/api/campaigns/:id/donations", (req, res) => {
    const rows = db
      .prepare("SELECT * FROM donations WHERE campaign_id = ? ORDER BY timestamp ASC")
      .all(req.params.id);
    res.json(
      rows.map((r) => ({ donor: r.donor, amount: r.amount, hash: r.hash, timestamp: r.timestamp }))
    );
  });

  app.get("/api/campaigns/:id/donor-count", (req, res) => {
    const row = db
      .prepare("SELECT COUNT(DISTINCT donor) c FROM donations WHERE campaign_id = ?")
      .get(req.params.id);
    res.json({ count: row ? row.c : 0 });
  });

  app.post("/api/donations", async (req, res) => {
    const parsed = donationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { campaignId, donor, amount, hash } = parsed.data;
    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
    if (!campaign) return res.status(404).json({ error: "campaign not found" });
    const existing = db
      .prepare("SELECT id FROM donations WHERE hash = ? AND campaign_id = ?")
      .get(hash, campaignId);
    if (existing) return res.status(409).json({ error: "donation already recorded" });
    if (campaign.total_raised >= campaign.goal)
      return res.status(400).json({ error: "goal already reached" });
    if (Date.now() > campaign.deadline) return res.status(400).json({ error: "campaign has ended" });

    if (verifyDonation) {
      const result = await verifyDonation({
        horizonUrl: config.horizonUrl,
        campaignId,
        donor,
        txHash: hash,
      });
      if (!result.ok) return res.status(422).json({ error: `donation not verified: ${result.reason}` });
    }

    const amt = Number(amount);
    const remaining = campaign.goal - campaign.total_raised;
    const donateAmount = amt > remaining ? remaining : amt;
    const timestamp = Date.now();
    db.prepare("UPDATE campaigns SET total_raised = ? WHERE id = ?").run(
      campaign.total_raised + donateAmount,
      campaignId
    );
    db.prepare(
      "INSERT OR IGNORE INTO donations (campaign_id, donor, amount, hash, timestamp) VALUES (?,?,?,?,?)"
    ).run(campaignId, donor, donateAmount, hash, timestamp);
    recordEvent("donation", { campaignId, donor, amount: donateAmount, txHash: hash });
    const donation = { donor, amount: donateAmount, hash, timestamp };
    broadcast({ type: "donation:new", ...donation, campaignId });
    broadcast({ type: "campaign:updated", campaignId });
    res.status(201).json(donation);
  });

  app.post("/api/withdrawals", (req, res) => {
    const parsed = withdrawalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { campaignId, owner } = parsed.data;
    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
    if (!campaign) return res.status(404).json({ error: "campaign not found" });
    if (campaign.owner !== owner) return res.status(403).json({ error: "only owner can withdraw" });
    if (Date.now() < campaign.deadline && campaign.total_raised < campaign.goal) {
      return res.status(400).json({ error: "campaign not yet ended or goal not reached" });
    }
    if (campaign.total_raised <= 0) return res.status(400).json({ error: "no funds to withdraw" });

    const withdrawn = campaign.total_raised;
    db.prepare("UPDATE campaigns SET total_raised = 0 WHERE id = ?").run(campaignId);
    recordEvent("withdrawal", { campaignId, owner, amount: withdrawn });
    broadcast({ type: "campaign:updated", campaignId });
    res.json({ withdrawn });
  });

  // ── feedback ───────────────────────────────────────────────────
  app.post("/api/feedback", (req, res) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { wallet, rating, message } = parsed.data;
    db.prepare("INSERT INTO feedback (wallet, rating, message, timestamp) VALUES (?,?,?,?)").run(
      wallet,
      rating ?? null,
      message,
      Date.now()
    );
    recordEvent("feedback", { wallet, rating: rating ?? null });
    res.status(201).json({ ok: true });
  });

  app.get("/api/feedback", (_req, res) => {
    const rows = db
      .prepare("SELECT wallet, rating, message, timestamp FROM feedback ORDER BY timestamp DESC LIMIT 500")
      .all();
    res.json(
      rows.map((r) => ({ wallet: r.wallet, rating: r.rating, message: r.message, timestamp: r.timestamp }))
    );
  });

  // ── analytics ──────────────────────────────────────────────────
  app.post("/api/analytics/event", (req, res) => {
    const parsed = analyticsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "type required" });
    const { type, ...data } = parsed.data;
    recordEvent(type, data);
    res.json({ ok: true });
  });

  app.get("/api/analytics", (_req, res) => {
    const count = (type) =>
      db.prepare("SELECT COUNT(*) c FROM analytics_events WHERE type = ?").get(type).c;
    const totalRequests = count("request");
    const walletConnects = count("wallet_connect");
    const donations = count("donation");
    const feedbackCount = count("feedback");
    const uniqueVisitors = db
      .prepare(
        `SELECT COUNT(DISTINCT COALESCE(address, donor)) c
         FROM analytics_events
         WHERE address IS NOT NULL OR donor IS NOT NULL`
      )
      .get().c;

    const now = Date.now();
    const dayMs = 86400000;
    const rows = db
      .prepare("SELECT type, timestamp FROM analytics_events WHERE timestamp >= ?")
      .all(now - 7 * dayMs);
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const start = now - i * dayMs;
      const end = start + dayMs;
      const dayEvents = rows.filter((e) => e.timestamp >= start && e.timestamp < end);
      daily.push({
        date: new Date(start).toISOString().slice(0, 10),
        requests: dayEvents.filter((e) => e.type === "request").length,
        connects: dayEvents.filter((e) => e.type === "wallet_connect").length,
        donations: dayEvents.filter((e) => e.type === "donation").length,
      });
    }

    const recentEvents = db
      .prepare("SELECT * FROM analytics_events ORDER BY id DESC LIMIT 100")
      .all()
      .map(ROW_TO_EVENT)
      .reverse();

    res.json({
      summary: { totalRequests, walletConnects, donations, feedbackCount, uniqueVisitors },
      daily,
      recentEvents,
    });
  });

  app.get("/api/analytics/dashboard", (_req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
  });

  app.use((_req, res) => res.status(404).json({ error: "not found" }));
  app.use((err, _req, res, _next) => {
    if (logger) logger.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return { app, server, wss, broadcast, wsClients, currentContractId };
}

module.exports = { createApp };
