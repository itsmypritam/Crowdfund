// Submits the verified user wallet interactions from public/user-data.csv
// to the CrowdEscrow Google Form for the monthly submission.
//
// Usage:
//   node backend/scripts/submit-form-entries.mjs
//   RATING=4 node backend/scripts/submit-form-entries.mjs   # override default feedback rating
//   DRY_RUN=1 node backend/scripts/submit-form-entries.mjs  # print payloads without POSTing
//
// The script posts each row (tx hash, action, wallet, name, email) to the
// Google Forms response endpoint. Google Forms requires no auth for this form.
// The overall feedback rating (1-5) is not part of user-data.csv, so it uses
// a default of 5 unless overridden with the RATING env var.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeF8ZVnXTUskEtGH6PU2EjrusRMJ5xldepygU027JtL0iH4ww/formResponse";

const ENTRIES = {
  txHash: "entry.2134898145",
  action: "entry.899795167",
  wallet: "entry.1340638094",
  name: "entry.1806006424",
  email: "entry.1544211736",
  rating: "entry.105295219",
};

const CSV_PATH = resolve(process.cwd(), "public", "user-data.csv");
const DEFAULT_RATING = Number(process.env.RATING) || 5;
const DRY_RUN = process.env.DRY_RUN === "1";

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = {};
    header.forEach((h, i) => {
      row[h] = values[i];
    });
    return row;
  });
}

async function submit(row, index) {
  const rating = Number(row.Rating) || DEFAULT_RATING;
  const body = new URLSearchParams({
    [ENTRIES.txHash]: row.Transaction,
    [ENTRIES.action]: row.Action || "Donate",
    [ENTRIES.wallet]: row["Wallet Address"],
    [ENTRIES.name]: row.Name,
    [ENTRIES.email]: row.Email,
    [ENTRIES.rating]: String(rating),
    fvv: "1",
    pageHistory: "0",
  });

  if (DRY_RUN) {
    console.log(`[${index}] ${row.Name} -> ${body.toString()}`);
    return true;
  }

  const res = await fetch(FORM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (res.status === 200) {
    console.log(`[${index}] ${row.Name}: OK (${res.status})`);
    return true;
  }
  console.error(`[${index}] ${row.Name}: FAILED (${res.status})`);
  return false;
}

const csv = await readFile(CSV_PATH, "utf8");
const rows = parseCsv(csv);

console.log(`Submitting ${rows.length} entries to CrowdEscrow Google Form...`);
let ok = 0;
let failed = 0;
for (let i = 0; i < rows.length; i++) {
  try {
    const success = await submit(rows[i], i + 1);
    if (success) ok++;
    else failed++;
  } catch (err) {
    failed++;
    console.error(`[${i + 1}] ${rows[i].Name}: ERROR ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 800));
}

console.log(`Done. ${ok} recorded, ${failed} failed.`);
