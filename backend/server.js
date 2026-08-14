const express = require("express");
const cors = require("cors");
const { WebSocketServer, WebSocket } = require("ws");
const http = require("http");
const path = require("path");
const fs = require("fs");
require("dotenv/config");

const PORT = process.env.PORT || 3001;
const HORIZON_URL = process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";

// ── JSON persistence ─────────────────────────────────────────────
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data", "db.json");
// Persistence is disabled during tests so the shared state stays in-memory
const PERSIST_ENABLED = process.env.NODE_ENV !== "test" && !process.env.DISABLE_PERSISTENCE;

function defaultState() {
  return {
    analyticsEvents: [],
    feedback: [],
    campaigns: {},
    donations: {},
    contractId: process.env.CONTRACT_ID || "",
  };
}

let state = defaultState();
if (PERSIST_ENABLED) {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const loaded = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      state = { ...defaultState(), ...loaded };
      state.analyticsEvents = Array.isArray(state.analyticsEvents) ? state.analyticsEvents : [];
      state.feedback = Array.isArray(state.feedback) ? state.feedback : [];
      state.campaigns = state.campaigns && typeof state.campaigns === "object" ? state.campaigns : {};
      state.donations = state.donations && typeof state.donations === "object" ? state.donations : {};
    }
  } catch (err) {
    console.error("Failed to load persisted state, starting fresh:", err.message);
    state = defaultState();
  }
}

let saveTimer = null;
function persist() {
  if (!PERSIST_ENABLED) return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      state.analyticsEvents = analyticsEvents;
      state.feedback = feedback;
      state.campaigns = Object.fromEntries(campaigns);
      state.donations = Object.fromEntries(donations);
      state.contractId = contractId;
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(state));
    } catch (err) {
      console.error("Failed to persist state:", err.message);
    }
  }, 200);
}

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));

app.use(express.json());

// ── Analytics store ──────────────────────────────────────────────
const analyticsEvents = state.analyticsEvents;
function recordEvent(type, data = {}) {
  const event = { type, timestamp: Date.now(), ...data };
  // dedupe backfilled events by their on-chain transaction hash
  if (event.txHash && analyticsEvents.some((e) => e.txHash === event.txHash)) return;
  analyticsEvents.push(event);
  // keep last 10k events in memory
  if (analyticsEvents.length > 10000) analyticsEvents.shift();
  persist();
}
// ── Logging middleware ───────────────────────────────────────────
app.use((req, _res, next) => {
  recordEvent("request", { method: req.method, path: req.path });
  next();
});
// ── In-memory stores (backed by JSON persistence) ────────────────
const campaigns = new Map(Object.entries(state.campaigns));
const donations = new Map(Object.entries(state.donations));
const feedback = state.feedback;
let contractId = state.contractId || process.env.CONTRACT_ID || "";
const wsClients = new Set();

// ── Analytics endpoints ─────────────────────────────────────────
app.get("/api/analytics", (_req, res) => {
  const totalRequests = analyticsEvents.filter(e => e.type === "request").length;
  const walletConnects = analyticsEvents.filter(e => e.type === "wallet_connect").length;
  const donations = analyticsEvents.filter(e => e.type === "donation").length;
  const feedbackCount = analyticsEvents.filter(e => e.type === "feedback").length;
  const uniqueVisitors = new Set(
    analyticsEvents.filter(e => e.address || e.donor).map(e => e.address || e.donor)
  ).size;

  // daily breakdown (last 7 days)
  const now = Date.now();
  const dayMs = 86400000;
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const start = now - i * dayMs;
    const end = start + dayMs;
    const dayEvents = analyticsEvents.filter(e => e.timestamp >= start && e.timestamp < end);
    daily.push({
      date: new Date(start).toISOString().slice(0, 10),
      requests: dayEvents.filter(e => e.type === "request").length,
      connects: dayEvents.filter(e => e.type === "wallet_connect").length,
      donations: dayEvents.filter(e => e.type === "donation").length,
    });
  }

  res.json({
    summary: {
      totalRequests,
      walletConnects,
      donations,
      feedbackCount,
      uniqueVisitors,
    },
    daily,
    recentEvents: analyticsEvents.slice(-100).reverse(),
  });
});

app.post("/api/analytics/event", (req, res) => {
  const { type, ...data } = req.body;
  if (!type) return res.status(400).json({ error: "type required" });
  recordEvent(type, data);
  res.json({ ok: true });
});

app.get("/api/analytics/dashboard", (_req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});
// ── End Analytics endpoints ─────────────────────────────────────

app.get("/", (_req, res) => res.json({ service: "CrowdEscrow", status: "running", contractId }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/contract-id", (_req, res) => res.json({ contractId }));
app.post("/api/contract-id", (req, res) => {
  contractId = req.body.contractId || "";
  persist();
  res.json({ contractId });
});

app.post("/api/campaigns", (req, res) => {
  const { id, owner, goal, deadline, title, description } = req.body;
  if (!id || !owner || !goal || !deadline || !title) {
    return res.status(400).json({ error: "id, owner, goal, deadline, title required" });
  }
  if (campaigns.has(id)) {
    return res.status(409).json({ error: "campaign already exists" });
  }
  const campaign = {
    id, owner,
    goal: parseFloat(goal),
    totalRaised: 0,
    deadline: new Date(deadline).getTime(),
    title, description,
    createdAt: Date.now(),
  };
  campaigns.set(id, campaign);
  donations.set(id, []);
  recordEvent("campaign_created", { campaignId: id, owner });
  persist();
  broadcast({ type: "campaign:updated", campaignId: id });
  res.status(201).json(campaign);
});

app.get("/api/campaigns/:id", (req, res) => {
  const c = campaigns.get(req.params.id);
  if (!c) return res.status(404).json({ error: "campaign not found" });
  res.json(c);
});

app.get("/api/campaigns/:id/donations", (req, res) => {
  const d = donations.get(req.params.id) || [];
  res.json(d);
});

app.get("/api/campaigns/:id/donor-count", (req, res) => {
  const d = donations.get(req.params.id) || [];
  const unique = new Set(d.map((x) => x.donor));
  res.json({ count: unique.size });
});

app.post("/api/donations", (req, res) => {
  const { campaignId, donor, amount, hash } = req.body;
  if (!campaignId || !donor || !amount || !hash) {
    return res.status(400).json({ error: "campaignId, donor, amount, hash required" });
  }
  const c = campaigns.get(campaignId);
  if (!c) return res.status(404).json({ error: "campaign not found" });
  if (c.totalRaised >= c.goal) return res.status(400).json({ error: "goal already reached" });
  if (Date.now() > c.deadline) return res.status(400).json({ error: "campaign has ended" });

  const amt = parseFloat(amount);
  const remaining = c.goal - c.totalRaised;
  const donateAmount = amt > remaining ? remaining : amt;
  c.totalRaised += donateAmount;

  const donation = { donor, amount: donateAmount, hash, timestamp: Date.now() };
  donations.get(campaignId).push(donation);
  recordEvent("donation", { campaignId, donor, amount: donateAmount });
  persist();
  broadcast({ type: "donation:new", ...donation, campaignId });
  broadcast({ type: "campaign:updated", campaignId });
  res.status(201).json(donation);
});

app.post("/api/withdrawals", (req, res) => {
  const { campaignId, owner } = req.body;
  if (!campaignId || !owner) {
    return res.status(400).json({ error: "campaignId, owner required" });
  }
  const c = campaigns.get(campaignId);
  if (!c) return res.status(404).json({ error: "campaign not found" });
  if (c.owner !== owner) return res.status(403).json({ error: "only owner can withdraw" });
  if (Date.now() < c.deadline && c.totalRaised < c.goal) {
    return res.status(400).json({ error: "campaign not yet ended or goal not reached" });
  }
  if (c.totalRaised <= 0) return res.status(400).json({ error: "no funds to withdraw" });

  const withdrawn = c.totalRaised;
  c.totalRaised = 0;
  recordEvent("withdrawal", { campaignId, owner, amount: withdrawn });
  persist();
  broadcast({ type: "campaign:updated", campaignId });
  res.json({ withdrawn });
});

// ── Feedback endpoint ───────────────────────────────────────────
app.post("/api/feedback", (req, res) => {
  const { wallet, rating, message } = req.body;
  if (!wallet) return res.status(400).json({ error: "wallet address required" });
  feedback.push({ wallet, rating: rating || null, message: message || "", timestamp: Date.now() });
  recordEvent("feedback", { wallet, rating });
  persist();
  res.status(201).json({ ok: true });
});

app.get("/api/feedback", (_req, res) => {
  res.json(feedback);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  wsClients.add(ws);
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "subscribe:campaign" && msg.campaignId) {
        ws.send(JSON.stringify({ type: "campaign:subscribed", campaignId: msg.campaignId }));
      }
    } catch {}
  });
  ws.on("close", () => { wsClients.delete(ws); });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = { app, server, broadcast, contractId };
