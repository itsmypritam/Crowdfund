const express = require("express");
const cors = require("cors");
const { WebSocketServer, WebSocket } = require("ws");
const http = require("http");
require("dotenv/config");

const PORT = process.env.PORT || 3001;
const HORIZON_URL = process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";
const POLL_INTERVAL = (parseInt(process.env.POLL_INTERVAL) || 5) * 1000;

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());

let contractId = process.env.CONTRACT_ID || "";
let lastPagingToken = "";
const wsClients = new Set();

app.get("/", (_req, res) => res.json({ service: "Stellar Tip Jar", status: "running", contractId }));
app.get("/health", (_req, res) => res.json({ status: "ok", contractId }));

app.get("/api/contract-id", (_req, res) => res.json({ contractId }));

app.post("/api/contract-id", (req, res) => {
  contractId = req.body.contractId || "";
  res.json({ contractId });
});

app.post("/api/donation", (req, res) => {
  const { donor, amount, hash } = req.body;
  if (!donor || !amount || !hash) return res.status(400).json({ error: "donor, amount, and hash required" });
  broadcast({ type: "donation:new", donor, amount, hash, timestamp: Date.now() });
  res.json({ ok: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  wsClients.add(ws);
  console.log(`WS client connected (${wsClients.size} total)`);

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "subscribe:campaign" && msg.contractId) {
        contractId = msg.contractId;
        ws.send(JSON.stringify({ type: "campaign:subscribed", contractId }));
      }
    } catch {}
  });

  ws.on("close", () => {
    wsClients.delete(ws);
    console.log("WS client disconnected");
  });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

setInterval(async () => {
  if (!contractId) return;
  try {
    const cursor = lastPagingToken || "";
    const url = `${HORIZON_URL}/transactions?limit=20&order=asc&cursor=${cursor}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const records = data._embedded?.records || [];
    for (const tx of records) {
      lastPagingToken = tx.paging_token;
      if (tx.successful) broadcast({ type: "campaign:updated", timestamp: Date.now(), tx_hash: tx.hash });
    }
  } catch (e) {
    console.error("Poll error:", e.message);
  }
}, POLL_INTERVAL);

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = { app, server, broadcast, contractId };
