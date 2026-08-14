import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRequire } from "module";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const require = createRequire(import.meta.url);
const request = require("supertest");
const { createApp } = require("./app");
const { openDatabase } = require("./db");
const pino = require("pino");

const silent = pino({ level: "silent" });

const OWNER = "GCG5DOV4HMZT73OWJMZCUTHTWP3PQYC2S3GNOARUGPTPVH2IAR6REWQN";
const BACKER = "GCATKV5L4B7FVETXSPEC53H7TYZKBDAG7FLEYORZ7BBGW3ABJWSDH5DB";
const HASH = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const HASH2 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function makeApp(overrides = {}) {
  const config = {
    nodeEnv: "test",
    port: 0,
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    adminKey: "",
    allowedOrigins: [],
    dbFilePath: ":memory:",
    legacyDbPath: "",
    verifyDonations: false,
    contractId: "",
    logLevel: "silent",
    enableRateLimit: true,
    ...overrides,
  };
  const db = openDatabase(":memory:");
  const { app } = createApp({
    config,
    db,
    logger: silent,
    verifyDonation: overrides.verifyDonation ?? null,
    enableRateLimit: config.enableRateLimit,
    rateLimitOptions: overrides.rateLimitOptions || {},
  });
  return { app, db };
}

const validCampaign = (id = "camp1") => ({
  id,
  owner: OWNER,
  goal: 1000,
  deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  title: "Test Campaign",
  description: "A test campaign",
});

async function createCampaign(app, id = "camp1") {
  const res = await request(app).post("/api/campaigns").send(validCampaign(id));
  expect(res.status).toBe(201);
  return res.body;
}

describe("service info", () => {
  it("GET / returns service info with contract id", async () => {
    const { app } = makeApp({ contractId: "CONTRACT123" });
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("CrowdEscrow");
    expect(res.body.contractId).toBe("CONTRACT123");
  });

  it("GET /health returns ok without hitting Horizon in tests", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("contract id", () => {
  it("GET /api/contract-id returns configured contract id", async () => {
    const { app } = makeApp({ contractId: "CCP3FESW4PWZ6ZEQZI2B4GDBXY2KM3UESU4J4RZB53AUV4BUIFML72L5" });
    const res = await request(app).get("/api/contract-id");
    expect(res.status).toBe(200);
    expect(res.body.contractId).toBe("CCP3FESW4PWZ6ZEQZI2B4GDBXY2KM3UESU4J4RZB53AUV4BUIFML72L5");
  });

  it("POST requires admin key when configured", async () => {
    const { app } = makeApp({ adminKey: "secret" });
    const denied = await request(app)
      .post("/api/contract-id")
      .send({ contractId: "NEWCONTRACT1" });
    expect(denied.status).toBe(401);
    const allowed = await request(app)
      .post("/api/contract-id")
      .set("x-admin-key", "secret")
      .send({ contractId: "NEWCONTRACT1" });
    expect(allowed.status).toBe(200);
    expect(allowed.body.contractId).toBe("NEWCONTRACT1");
  });

  it("POST without admin key configured accepts updates", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/api/contract-id")
      .send({ contractId: "NEWCONTRACT2" });
    expect(res.status).toBe(200);
    expect(res.body.contractId).toBe("NEWCONTRACT2");
  });
});

describe("campaigns", () => {
  it("lists campaigns newest first", async () => {
    const { app } = makeApp();
    await createCampaign(app, "camp1");
    await createCampaign(app, "camp2");
    const res = await request(app).get("/api/campaigns");
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.id)).toEqual(["camp2", "camp1"]);
  });

  it("rejects invalid campaign payloads", async () => {
    const { app } = makeApp();
    const res = await request(app).post("/api/campaigns").send({ id: "x" });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate campaign ids", async () => {
    const { app } = makeApp();
    await createCampaign(app, "camp1");
    const res = await request(app).post("/api/campaigns").send(validCampaign("camp1"));
    expect(res.status).toBe(409);
  });

  it("returns 404 for unknown campaign", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/api/campaigns/nope");
    expect(res.status).toBe(404);
  });
});

describe("donations", () => {
  it("rejects invalid payloads", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/api/donations")
      .send({ campaignId: "camp1", donor: "x", amount: -5, hash: "nope" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown campaign", async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post("/api/donations")
      .send({ campaignId: "nope", donor: BACKER, amount: 10, hash: HASH });
    expect(res.status).toBe(404);
  });

  it("records a donation and updates total raised", async () => {
    const { app } = makeApp();
    await createCampaign(app);
    const res = await request(app)
      .post("/api/donations")
      .send({ campaignId: "camp1", donor: BACKER, amount: 50, hash: HASH });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(50);
    const campaign = await request(app).get("/api/campaigns/camp1");
    expect(campaign.body.totalRaised).toBe(50);
    const donors = await request(app).get("/api/campaigns/camp1/donor-count");
    expect(donors.body.count).toBe(1);
  });

  it("rejects duplicate hashes to avoid double counting", async () => {
    const { app } = makeApp();
    await createCampaign(app);
    await request(app).post("/api/donations").send({ campaignId: "camp1", donor: BACKER, amount: 50, hash: HASH });
    const dup = await request(app)
      .post("/api/donations")
      .send({ campaignId: "camp1", donor: BACKER, amount: 50, hash: HASH });
    expect(dup.status).toBe(409);
    const campaign = await request(app).get("/api/campaigns/camp1");
    expect(campaign.body.totalRaised).toBe(50);
  });

  it("rejects donations when goal already reached", async () => {
    const { app } = makeApp();
    await createCampaign(app);
    await request(app).post("/api/donations").send({ campaignId: "camp1", donor: BACKER, amount: 1000, hash: HASH });
    const res = await request(app)
      .post("/api/donations")
      .send({ campaignId: "camp1", donor: BACKER, amount: 10, hash: HASH2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("goal already reached");
  });

  it("caps donation at remaining goal amount", async () => {
    const { app } = makeApp();
    await createCampaign(app);
    const res = await request(app)
      .post("/api/donations")
      .send({ campaignId: "camp1", donor: BACKER, amount: 5000, hash: HASH });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(1000);
  });

  it("rejects unverified donations when verifier is enabled", async () => {
    const { app } = makeApp({
      verifyDonation: async () => ({ ok: false, reason: "transaction not found" }),
    });
    await createCampaign(app);
    const res = await request(app)
      .post("/api/donations")
      .send({ campaignId: "camp1", donor: BACKER, amount: 10, hash: HASH });
    expect(res.status).toBe(422);
  });

  it("accepts verified donations when verifier is enabled", async () => {
    const { app } = makeApp({ verifyDonation: async () => ({ ok: true }) });
    await createCampaign(app);
    const res = await request(app)
      .post("/api/donations")
      .send({ campaignId: "camp1", donor: BACKER, amount: 10, hash: HASH });
    expect(res.status).toBe(201);
  });
});

describe("withdrawals", () => {
  it("forbids non-owner withdrawals", async () => {
    const { app } = makeApp();
    await createCampaign(app);
    const res = await request(app)
      .post("/api/withdrawals")
      .send({ campaignId: "camp1", owner: BACKER });
    expect(res.status).toBe(403);
  });

  it("allows owner withdrawal after deadline", async () => {
    const { app, db } = makeApp();
    const c = {
      ...validCampaign(),
      deadline: new Date(Date.now() - 86400000).toISOString(),
    };
    await request(app).post("/api/campaigns").send(c);
    db.prepare(
      "INSERT INTO donations (campaign_id, donor, amount, hash, timestamp) VALUES (?,?,?,?,?)"
    ).run("camp1", BACKER, 100, HASH, Date.now());
    db.prepare("UPDATE campaigns SET total_raised = 100 WHERE id = 'camp1'").run();
    const res = await request(app)
      .post("/api/withdrawals")
      .send({ campaignId: "camp1", owner: OWNER });
    expect(res.status).toBe(200);
    expect(res.body.withdrawn).toBe(100);
    const campaign = await request(app).get("/api/campaigns/camp1");
    expect(campaign.body.totalRaised).toBe(0);
  });

  it("blocks withdrawal while goal not reached before deadline", async () => {
    const { app } = makeApp();
    await createCampaign(app);
    const res = await request(app)
      .post("/api/withdrawals")
      .send({ campaignId: "camp1", owner: OWNER });
    expect(res.status).toBe(400);
  });
});

describe("feedback", () => {
  it("requires a wallet", async () => {
    const { app } = makeApp();
    const res = await request(app).post("/api/feedback").send({ rating: 5 });
    expect(res.status).toBe(400);
  });

  it("records and lists feedback", async () => {
    const { app } = makeApp();
    const created = await request(app)
      .post("/api/feedback")
      .send({ wallet: BACKER, rating: 5, message: "Great" });
    expect(created.status).toBe(201);
    const res = await request(app).get("/api/feedback");
    expect(res.status).toBe(200);
    expect(res.body[0].message).toBe("Great");
  });
});

describe("analytics", () => {
  it("requires event type", async () => {
    const { app } = makeApp();
    const res = await request(app).post("/api/analytics/event").send({ foo: 1 });
    expect(res.status).toBe(400);
  });

  it("records and dedupes events by tx hash", async () => {
    const { app } = makeApp();
    const ev = { type: "donation", txHash: HASH, donor: BACKER, amount: 10 };
    await request(app).post("/api/analytics/event").send(ev);
    await request(app).post("/api/analytics/event").send(ev);
    const res = await request(app).get("/api/analytics");
    expect(res.status).toBe(200);
    const donationEvents = res.body.recentEvents.filter((e) => e.type === "donation");
    expect(donationEvents.length).toBe(1);
    expect(res.body.summary.uniqueVisitors).toBeGreaterThanOrEqual(1);
  });
});

describe("rate limiting", () => {
  it("returns 429 after hitting the limit", async () => {
    const { app } = makeApp({ rateLimitOptions: { limit: 3 } });
    const limiterHost = "10.20.30.40";
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/api/contract-id").set("X-Forwarded-For", limiterHost);
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).get("/api/contract-id").set("X-Forwarded-For", limiterHost);
    expect(blocked.status).toBe(429);
  });

  it("can be disabled", async () => {
    const { app } = makeApp({ enableRateLimit: false, rateLimitOptions: { limit: 1 } });
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/api/contract-id").set("X-Forwarded-For", "10.0.0.1");
      expect(res.status).toBe(200);
    }
  });
});

describe("cors", () => {
  it("reflects allowed origins only", async () => {
    const { app } = makeApp({ allowedOrigins: ["https://example.com"] });
    const allowed = await request(app)
      .get("/api/contract-id")
      .set("Origin", "https://example.com");
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://example.com");
    const denied = await request(app).get("/api/contract-id").set("Origin", "https://evil.com");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("persistence", () => {
  let dir;
  let file;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "crowdescrow-"));
    file = join(dir, "test.sqlite");
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("survives db close and reopen", async () => {
    const makeWithFile = () => {
      const db = openDatabase(file);
      const { app } = createApp({
        config: {
          nodeEnv: "test",
          adminKey: "",
          allowedOrigins: [],
          horizonUrl: "https://horizon-testnet.stellar.org",
          verifyDonations: false,
          enableRateLimit: true,
        },
        db,
        logger: silent,
        verifyDonation: null,
      });
      return { app, db };
    };

    const first = makeWithFile();
    await createCampaign(first.app, "persist1");
    first.db.close();

    const second = makeWithFile();
    const res = await request(second.app).get("/api/campaigns/persist1");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Test Campaign");
    second.db.close();
  });
});

describe("leaderboard", () => {
  it("returns an empty leaderboard when there are no donations", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/api/leaderboard");
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]);
    expect(res.body.totalDonors).toBe(0);
  });

  it("aggregates donations per donor sorted by total", async () => {
    const { app } = makeApp();
    await createCampaign(app, "lb1");
    await request(app).post("/api/donations").send({ campaignId: "lb1", donor: BACKER, amount: 30, hash: HASH });
    await request(app).post("/api/donations").send({ campaignId: "lb1", donor: OWNER, amount: 100, hash: HASH2 });
    await request(app).post("/api/donations").send({ campaignId: "lb1", donor: BACKER, amount: 20, hash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde0" });
    const res = await request(app).get("/api/leaderboard");
    expect(res.status).toBe(200);
    expect(res.body.totalDonors).toBe(2);
    expect(res.body.entries[0].donor).toBe(OWNER);
    expect(res.body.entries[0].total).toBe(100);
    expect(res.body.entries[0].donations).toBe(1);
    expect(res.body.entries[1].donor).toBe(BACKER);
    expect(res.body.entries[1].total).toBe(50);
    expect(res.body.entries[1].donations).toBe(2);
  });
});

describe("referrals", () => {
  it("creates a referral code for a wallet", async () => {
    const { app } = makeApp();
    const res = await request(app).post("/api/referrals").send({ wallet: BACKER });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(res.body.code).toMatch(/^[A-Z2-9]{8}$/);
  });

  it("returns the same code on repeat request", async () => {
    const { app } = makeApp();
    await request(app).post("/api/referrals").send({ wallet: BACKER });
    const res = await request(app).post("/api/referrals").send({ wallet: BACKER });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
    expect(res.body.code).toMatch(/^[A-Z2-9]{8}$/);
  });

  it("rejects invalid wallets", async () => {
    const { app } = makeApp();
    const res = await request(app).post("/api/referrals").send({ wallet: "x" });
    expect(res.status).toBe(400);
  });

  it("resolves and counts clicks on a referral", async () => {
    const { app } = makeApp();
    await request(app).post("/api/referrals").send({ wallet: BACKER });
    const created = await request(app).get("/api/referrals/XXXXXXXX");
    expect(created.status).toBe(404);
    const create = await request(app).post("/api/referrals").send({ wallet: BACKER });
    const resolve = await request(app).get(`/api/referrals/${create.body.code}`);
    expect(resolve.status).toBe(200);
    expect(resolve.body.wallet).toBe(BACKER);
    expect(resolve.body.clicks).toBe(1);
    const again = await request(app).get(`/api/referrals/${create.body.code}`);
    expect(again.body.clicks).toBe(2);
  });

  it("redeems a referral for a different wallet only once", async () => {
    const { app } = makeApp();
    const create = await request(app).post("/api/referrals").send({ wallet: BACKER });
    const code = create.body.code;
    const redeem = await request(app).post("/api/referrals/redeem").send({ code, wallet: OWNER });
    expect(redeem.status).toBe(200);
    expect(redeem.body.uses).toBe(1);
    const dup = await request(app).post("/api/referrals/redeem").send({ code, wallet: OWNER });
    expect(dup.status).toBe(409);
    const self = await request(app).post("/api/referrals/redeem").send({ code, wallet: BACKER });
    expect(self.status).toBe(400);
  });

  it("rejects redeeming an unknown code", async () => {
    const { app } = makeApp();
    const res = await request(app).post("/api/referrals/redeem").send({ code: "ZZZZZZZZ", wallet: OWNER });
    expect(res.status).toBe(404);
  });
});

describe("notifications", () => {
  it("rejects invalid notification payloads", async () => {
    const { app } = makeApp();
    const res = await request(app).post("/api/notifications").send({ wallet: BACKER });
    expect(res.status).toBe(400);
  });

  it("creates and lists notifications for a wallet", async () => {
    const { app } = makeApp();
    await request(app).post("/api/notifications").send({
      wallet: BACKER,
      type: "refund",
      title: "Refund available",
      body: "Claim your refund now",
      campaignId: "camp1",
      link: "/campaigns/camp1",
    });
    const res = await request(app).get(`/api/notifications?wallet=${BACKER}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe("Refund available");
    expect(res.body[0].campaignId).toBe("camp1");
    expect(res.body[0].read).toBe(false);
  });

  it("requires a wallet to list notifications", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(400);
  });

  it("marks notifications read", async () => {
    const { app } = makeApp();
    await request(app).post("/api/notifications").send({
      wallet: BACKER,
      type: "welcome",
      title: "Welcome",
    });
    const res = await request(app).post("/api/notifications/read").send({ wallet: BACKER });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const list = await request(app).get(`/api/notifications?wallet=${BACKER}`);
    expect(list.body[0].read).toBe(true);
  });
});

describe("unknown routes", () => {
  it("returns JSON 404", async () => {
    const { app } = makeApp();
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not found");
  });
});
