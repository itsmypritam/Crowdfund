import { createRequire } from "module";
const require = createRequire(import.meta.url);
const request = require("supertest");
const { app } = require("./server");
import { describe, it, expect } from "vitest";

describe("GET /", () => {
  it("returns service info with status running", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("CrowdEscrow");
    expect(res.body.status).toBe("running");
    expect(res.body).toHaveProperty("contractId");
  });
});

describe("GET /health", () => {
  it("returns ok status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("POST /api/contract-id", () => {
  it("saves and returns contractId", async () => {
    const res = await request(app)
      .post("/api/contract-id")
      .send({ contractId: "C123" })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(200);
    expect(res.body.contractId).toBe("C123");

    const getRes = await request(app).get("/api/contract-id");
    expect(getRes.body.contractId).toBe("C123");
  });

  it("clears contractId when empty", async () => {
    await request(app)
      .post("/api/contract-id")
      .send({ contractId: "" })
      .set("Content-Type", "application/json");

    const res = await request(app).get("/api/contract-id");
    expect(res.body.contractId).toBe("");
  });
});

describe("POST /api/donations", () => {
  it("returns 400 when fields missing", async () => {
    const res = await request(app)
      .post("/api/donations")
      .send({})
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("campaignId, donor, amount, hash required");
  });

  it("returns 404 when campaign not found", async () => {
    const res = await request(app)
      .post("/api/donations")
      .send({
        campaignId: "nonexistent",
        donor: "GA...",
        amount: "10",
        hash: "abc123",
      })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("campaign not found");
  });

  it("records a donation once the campaign exists", async () => {
    await request(app)
      .post("/api/campaigns")
      .send({
        id: "camp1",
        owner: "GA...",
        goal: "100",
        deadline: new Date(Date.now() + 86400000).toISOString(),
        title: "Test campaign",
      })
      .set("Content-Type", "application/json");

    const res = await request(app)
      .post("/api/donations")
      .send({ campaignId: "camp1", donor: "GB...", amount: "10", hash: "tx123" })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(10);

    const countRes = await request(app).get("/api/campaigns/camp1/donor-count");
    expect(countRes.body.count).toBe(1);
  });
});

describe("POST /api/analytics/event", () => {
  it("returns 400 when type is missing", async () => {
    const res = await request(app)
      .post("/api/analytics/event")
      .send({})
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("type required");
  });

  it("records an event and exposes it via /api/analytics", async () => {
    await request(app)
      .post("/api/analytics/event")
      .send({ type: "donation", donor: "GCAT...", txHash: "hash1" })
      .set("Content-Type", "application/json");

    const res = await request(app).get("/api/analytics");
    expect(res.status).toBe(200);
    expect(res.body.summary.donations).toBeGreaterThanOrEqual(1);
    expect(res.body.recentEvents.some((e) => e.txHash === "hash1")).toBe(true);
  });

  it("dedupes events that share the same on-chain txHash", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/analytics/event")
        .send({ type: "donation", donor: "GCAT...", txHash: "hash-dupe" })
        .set("Content-Type", "application/json");
    }

    const res = await request(app).get("/api/analytics");
    expect(res.body.recentEvents.filter((e) => e.txHash === "hash-dupe").length).toBe(1);
  });
});

describe("POST /api/feedback", () => {
  it("records feedback that is returned by GET /api/feedback", async () => {
    await request(app)
      .post("/api/feedback")
      .send({ wallet: "GA...", rating: 5, message: "works great" })
      .set("Content-Type", "application/json");

    const res = await request(app).get("/api/feedback");
    expect(res.status).toBe(200);
    expect(res.body.some((f) => f.wallet === "GA..." && f.rating === 5 && f.message === "works great")).toBe(true);
  });

  it("returns 400 when wallet is missing", async () => {
    const res = await request(app)
      .post("/api/feedback")
      .send({ rating: 4 })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("wallet address required");
  });
});
