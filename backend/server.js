const pino = require("pino");
const { loadConfig } = require("./config");
const { openDatabase, importLegacy } = require("./db");
const { createApp } = require("./app");
const { verifyDonation } = require("./horizon");

const config = loadConfig();
const logger = pino({ level: config.logLevel });

const db = openDatabase(config.dbFilePath);
importLegacy(db, config.legacyDbPath);

const { app, server, wss, broadcast, currentContractId } = createApp({
  config,
  db,
  logger,
  verifyDonation: config.verifyDonations ? verifyDonation : null,
  enableRateLimit: config.enableRateLimit,
});

if (require.main === module) {
  server.listen(config.port, "0.0.0.0", () => {
    logger.info(`CrowdEscrow backend listening on port ${config.port}`);
  });
}

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully`);
  for (const client of wss.clients) {
    try {
      client.terminate();
    } catch {}
  }
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
