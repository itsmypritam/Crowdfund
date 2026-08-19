const fs = require("fs");

const readme = fs.readFileSync("README.md", "utf8");
const results = JSON.parse(fs.readFileSync("scripts/donate_results.json", "utf8"));

let ok = 0;
let fail = 0;

for (const r of results) {
  const hasWallet = readme.includes(r.newWallet);
  const hasTx = readme.includes(r.txHash);
  const hasName = readme.includes(r.name);

  const issues = [];
  if (!hasWallet) issues.push("WALLET NOT IN README: " + r.newWallet);
  if (!hasTx) issues.push("TX NOT IN README: " + r.txHash);
  if (!hasName) issues.push("NAME NOT IN README: " + r.name);

  if (issues.length === 0) {
    ok++;
  } else {
    console.log("[" + r.num + "] " + r.name + ":");
    for (const i of issues) console.log("  " + i);
    fail++;
  }
}

console.log("\nREADME cross-check: OK=" + ok + " FAIL=" + fail);
if (fail > 0) process.exit(1);
