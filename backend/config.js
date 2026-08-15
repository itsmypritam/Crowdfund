const path = require("path");

function loadConfig(env = process.env) {
  return {
    nodeEnv: env.NODE_ENV || "development",
    port: parseInt(env.PORT || "3001", 10),
    horizonUrl: env.HORIZON_URL || "https://horizon-testnet.stellar.org",
    rpcUrl: env.RPC_URL || "https://soroban-testnet.stellar.org",
    adminKey: env.ADMIN_KEY || "",
    allowedOrigins: (env.CORS_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    dbFilePath: env.DATA_FILE || path.join(__dirname, "data", "db.sqlite"),
    legacyDbPath: env.LEGACY_JSON_FILE || path.join(__dirname, "data", "db.json"),
    verifyDonations: env.NODE_ENV !== "test",
    contractId: env.CONTRACT_ID || "",
    logLevel: env.LOG_LEVEL || "info",
    enableRateLimit: env.DISABLE_RATE_LIMIT !== "1",
    redisUrl: env.REDIS_URL || "",
  };
}

module.exports = { loadConfig };
