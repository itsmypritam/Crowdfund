import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.resolve(__dirname, '../../public/user-data.csv');
const rows = fs
  .readFileSync(csvPath, 'utf8')
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split(','));

const horizon = 'https://horizon-testnet.stellar.org/transactions/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
let mismatch = 0;
let notFound = 0;
let failed = 0;

for (const [idx, name, , wallet, tx] of rows) {
  try {
    const res = await fetch(horizon + tx);
    if (res.status === 404) {
      console.log(`[${idx}] ${name}: TX NOT FOUND on testnet (${tx})`);
      notFound++;
      continue;
    }
    if (!res.ok) {
      console.log(`[${idx}] ${name}: HTTP ${res.status} for ${tx}`);
      failed++;
      continue;
    }
    const data = await res.json();
    if (data.source_account === wallet) {
      console.log(`[${idx}] ${name}: OK (source matches)`);
      ok++;
    } else {
      console.log(`[${idx}] ${name}: MISMATCH -> tx source ${data.source_account}`);
      mismatch++;
    }
  } catch (err) {
    console.log(`[${idx}] ${name}: REQUEST ERROR ${err.message}`);
    failed++;
  }
  await sleep(250);
}

console.log('--------------------------------');
console.log(`Total: ${rows.length} | OK: ${ok} | Mismatch: ${mismatch} | Not found: ${notFound} | Errors: ${failed}`);
