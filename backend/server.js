require("dotenv").config();
const pino = require("pino");
const { loadConfig } = require("./config");
const { openDatabase, importLegacy } = require("./db");
const { createApp } = require("./app");
const { verifyDonation } = require("./horizon");
const { createQueue, createWorker } = require("./notificationQueue");

const config = loadConfig();
const logger = pino({ level: config.logLevel });

const db = openDatabase(config.dbFilePath);
importLegacy(db, config.legacyDbPath);

const notificationQueue = createQueue(config.redisUrl);
const notificationWorker = createWorker({
  redisUrl: config.redisUrl,
  processNotification: (data) => {
    db.prepare(
      `INSERT INTO notifications (wallet, type, title, body, campaign_id, link, read, created_at)
       VALUES (?,?,?,?,?,?,0,?)`
    ).run(
      data.wallet,
      data.type,
      data.title,
      data.body,
      data.campaignId || null,
      data.link,
      Date.now()
    );
  },
  logger,
});
if (notificationQueue) {
  logger.info("Notification queue (BullMQ) enabled");
} else {
  logger.info("Notification queue disabled (no REDIS_URL set); using synchronous inserts");
}

const { app, server, wss, broadcast, currentContractId } = createApp({
  config,
  db,
  logger,
  verifyDonation: config.verifyDonations ? verifyDonation : null,
  enableRateLimit: config.enableRateLimit,
  notificationQueue,
});

if (require.main === module) {
  server.listen(config.port, "0.0.0.0", () => {
    logger.info(`CrowdEscrow backend listening on port ${config.port}`);
  });
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully`);
  for (const client of wss.clients) {
    try {
      client.terminate();
    } catch {}
  }
  if (notificationWorker) await notificationWorker.close();
  if (notificationQueue) await notificationQueue.close();
  server.close(() => {
    try {
      db.close();
    } catch {}
    logger.info("Shutdown complete");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = { app, server, broadcast, contractId: currentContractId() };
