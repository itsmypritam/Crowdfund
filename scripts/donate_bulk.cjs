const fs = require("fs");
const sdk = require("@stellar/stellar-sdk");

const RPC_URL = "https://soroban-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";
const NET = sdk.Networks.TESTNET;
const CONTRACT_ID = "CCP3FESW4PWZ6ZEQZI2B4GDBXY2KM3UESU4J4RZB53AUV4BUIFML72L5";
const CSV_PATH = "public/user-data.csv";
const OUT_PATH = "scripts/donate_results.json";

const DRY = process.env.DRY_RUN === "1";

const rows = fs.readFileSync(CSV_PATH, "utf8")
  .split(/\r?\n/)
  .slice(1)
  .filter((l) => l.trim().length > 0)
  .map((l) => {
    const [num, name, email, wallet, tx, action, rating] = l.split(",");
    return { num: Number(num), name, email, wallet, tx, action, rating: Number(rating) };
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fund(pubkey) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(`${FRIENDBOT}?addr=${pubkey}`);
      if (res.ok) return true;
      await sleep(1500);
    } catch {}
    await sleep(1500);
  }
  return false;
}

async function donate(kp, amountXlm) {
  const server = new sdk.rpc.Server(RPC_URL);
  const contract = new sdk.Contract(CONTRACT_ID);

  let account;
  for (let i = 0; i < 15; i++) {
    try {
      account = await server.getAccount(kp.publicKey());
      break;
    } catch {
      await sleep(1000);
    }
  }
  if (!account) throw new Error("account not visible after funding");

  const amount = sdk.nativeToScVal(BigInt(Math.round(amountXlm * 1e7)), { type: "i128" });
  const scParams = [
    sdk.nativeToScVal(kp.publicKey(), { type: "address" }),
    amount,
  ];

  const txn = new sdk.TransactionBuilder(account, { fee: sdk.BASE_FEE, networkPassphrase: NET })
    .addOperation(contract.call("donate", ...scParams))
    .setTimeout(30)
    .build();

  const simResp = await server.simulateTransaction(txn, undefined, "record");
  if (!simResp || simResp.error) throw new Error("sim: " + JSON.stringify(simResp?.error));
  if (!sdk.rpc.Api.isSimulationSuccess(simResp)) throw new Error("contract sim failed: " + JSON.stringify(simResp));

  const preparedTxn = sdk.rpc.assembleTransaction(txn, simResp).build();
  preparedTxn.sign(kp);

  const sendResp = await server.sendTransaction(preparedTxn);
  if (sendResp.status !== "PENDING" && sendResp.status !== "DUPLICATE") {
    throw new Error("submit failed: " + sendResp.status + " " + JSON.stringify(sendResp.error || {}));
  }

  let getResp = await server.getTransaction(sendResp.hash);
  for (let i = 0; i < 30 && getResp.status === "NOT_FOUND"; i++) {
    await sleep(1000);
    getResp = await server.getTransaction(sendResp.hash);
  }

  if (getResp.status !== "SUCCESS") {
    throw new Error("tx failed: " + getResp.status + " " + JSON.stringify(getResp.result?.error || getResp.error || ""));
  }
  return sendResp.hash;
}

async function main() {
  if (DRY) {
    console.log("DRY RUN: would generate", rows.length, "wallets and donate to", CONTRACT_ID);
    for (const r of rows.slice(0, 3)) {
      const kp = sdk.Keypair.random();
      console.log(`  ${r.num} ${r.name} -> ${kp.publicKey()} donate ${r.rating} XLM`);
    }
    process.exit(0);
  }

  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const kp = sdk.Keypair.random();
    process.stdout.write(`[${i + 1}/${rows.length}] ${r.name}: funding... `);
    const ok = await fund(kp.publicKey());
    if (!ok) { console.log("FUND FAILED"); results.push({ ...r, status: "fund_failed", newWallet: kp.publicKey(), txHash: "" }); continue; }
    process.stdout.write("donating " + r.rating + " XLM... ");
    try {
      const hash = await donate(kp, r.rating);
      console.log("OK", hash);
      results.push({ num: r.num, name: r.name, rating: r.rating, newWallet: kp.publicKey(), txHash: hash, status: "ok" });
    } catch (e) {
      console.log("FAILED:", e.message);
      results.push({ num: r.num, name: r.name, rating: r.rating, newWallet: kp.publicKey(), txHash: "", status: "failed", error: e.message });
    }
    fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
    await sleep(400);
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  console.log(`\nDONE. ${okCount}/${results.length} succeeded. Results in ${OUT_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
