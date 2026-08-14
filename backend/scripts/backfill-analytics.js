// One-time backfill: ingest the real on-chain wallet interactions
// (public/user-data.csv) into the backend analytics store.
//
//   Usage:
//     BACKEND_URL=https://stellar-tip-jar.onrender.com node backend/scripts/backfill-analytics.js
//
// Every row in the CSV corresponds to a verified Stellar testnet
// transaction (see the README user interaction table). This script
// records each one as a "donation" analytics event keyed by its
// on-chain transaction hash. The backend dedupes by txHash, so
// re-running the script is safe.
//
// Optionally enriches each event with the real transaction timestamp
// from Horizon so the dashboard daily breakdown reflects actual dates.

const fs = require("fs");
const path = require("path");
const csvPath = path.join(__dirname, "..", "..", "public", "user-data.csv");
const backendUrl = process.env.BACKEND_URL || "https://stellar-tip-jar.onrender.com";
const horizonUrl = process.env.HORIZON_URL || "https://horizon-testnet.stellar.org";

function parseCsv(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [num, name, email, wallet, txHash, action] = line.split(",");
      return { num, name: name?.trim(), email: email?.trim(), wallet: wallet?.trim(), txHash: txHash?.trim(), action: action?.trim() };
    })
    .filter((r) => r.txHash && r.wallet);
}

async function fetchTxTime(txHash) {
  try {
    const res = await fetch(`${horizonUrl}/transactions/${txHash}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const tx = await res.json();
    return tx.created_at ? new Date(tx.created_at).getTime() : null;
  } catch {
    return null;
  }
}

async function main() {
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  console.log(`Found ${rows.length} on-chain interactions in user-data.csv`);

  let recorded = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const timestamp = (await fetchTxTime(row.txHash)) || Date.now();
    const body = {
      type: "donation",
      donor: row.wallet,
      txHash: row.txHash,
      name: row.name,
      email: row.email,
      action: row.action,
      source: "backfill",
      timestamp,
    };

    try {
      const res = await fetch(`${backendUrl}/api/analytics/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 200) {
        recorded++;
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      console.error(`Failed for ${row.txHash}:`, err.message);
    }
  }

  console.log(`Done. Recorded: ${recorded}, skipped (duplicate/invalid): ${skipped}, failed: ${failed}`);
  console.log(`Check the dashboard: ${backendUrl}/api/analytics`);
}

main();
