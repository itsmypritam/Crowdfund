const express = require("express");
const cors = require("cors");
const { WebSocketServer, WebSocket } = require("ws");
const http = require("http");
require("dotenv/config");

const PORT = process.env.PORT || 3001;
const HORIZON_URL = process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

const campaigns = new Map();
const donations = new Map();
let contractId = process.env.CONTRACT_ID || "";
const wsClients = new Set();

app.get("/", (_req, res) => res.json({ service: "Stellar Tip Jar", status: "running", contractId }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/contract-id", (_req, res) => res.json({ contractId }));
app.post("/api/contract-id", (req, res) => {
  contractId = req.body.contractId || "";
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
  broadcast({ type: "campaign:updated", campaignId });
  res.json({ withdrawn });
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
