const fs = require("fs");
const sdk = require("@stellar/stellar-sdk");

const RPC_URL = "https://soroban-testnet.stellar.org";
const CSV_PATH = "public/user-data.csv";
const RES_PATH = "scripts/donate_results.json";

async function main() {
  const csv = fs.readFileSync(CSV_PATH, "utf8")
    .split(/\r?\n/).slice(1).filter((l) => l.trim())
    .map((l) => {
      const [num, name, email, wallet, tx, action, rating] = l.split(",");
      return { num: Number(num), name, email, wallet, tx, action, rating: Number(rating) };
    });

  const results = JSON.parse(fs.readFileSync(RES_PATH, "utf8"));

  console.log("CSV rows:", csv.length);
  console.log("Results:", results.length);
  console.log("");

  const server = new sdk.rpc.Server(RPC_URL);
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const c = csv[i];
    const issues = [];

    // 1. Check num matches
    if (r.num !== c.num) issues.push("num mismatch: " + r.num + " vs " + c.num);

    // 2. Check name matches
    if (r.name !== c.name) issues.push("name mismatch: " + r.name + " vs " + c.name);

    // 3. Check newWallet is a valid Stellar address
    if (!r.newWallet || !r.newWallet.match(/^G[A-Z2-7]{55}$/)) {
      issues.push("invalid wallet address: " + r.newWallet);
    }

    // 4. Check txHash format
    if (!r.txHash || !r.txHash.match(/^[a-f0-9]{64}$/)) {
      issues.push("invalid tx hash format: " + r.txHash);
    }

    // 5. Check status
    if (r.status !== "ok") issues.push("status not ok: " + r.status);

    // 6. Check rating matches
    if (r.rating !== c.rating) issues.push("rating mismatch: " + r.rating + " vs " + c.rating);

    // 7. Verify tx exists on testnet
    if (r.txHash && r.status === "ok") {
      try {
        const txResp = await server.getTransaction(r.txHash);
        if (txResp.status === "NOT_FOUND") {
          issues.push("TX NOT FOUND on testnet: " + r.txHash);
        } else if (txResp.status !== "SUCCESS") {
          issues.push("TX status not SUCCESS: " + txResp.status + " for " + r.txHash);
        }
      } catch (e) {
        issues.push("TX lookup error: " + e.message);
      }
    }

    const prefix = `[${i + 1}/${results.length}] ${r.name}`;
    if (issues.length === 0) {
      console.log(prefix + ": OK wallet=" + r.newWallet.slice(0, 8) + "... tx=" + r.txHash.slice(0, 12) + "...");
      ok++;
    } else {
      console.log(prefix + ": FAIL");
      for (const iss of issues) console.log("  - " + iss);
      fail++;
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log("OK:", ok);
  console.log("FAIL:", fail);
  console.log("TOTAL:", ok + fail);

  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
