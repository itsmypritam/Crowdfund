import { createRequire } from "module";
const require = createRequire(import.meta.url);
const request = require("supertest");
const { app } = require("./server");
import { describe, it, expect } from "vitest";

describe("GET /", () => {
  it("returns service info with status running", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("Stellar Tip Jar");
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
});
