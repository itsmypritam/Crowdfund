const fs = require("fs");
const csv = fs.readFileSync("public/user-data.csv", "utf8")
  .split(/\r?\n/).slice(1).filter((l) => l.trim())
  .map((l) => {
    const [num, name, email, wallet, tx, action, rating] = l.split(",");
    return { num: Number(num), name, email, wallet, tx, action, rating: Number(rating) };
  });
const res = JSON.parse(fs.readFileSync("scripts/donate_results.json", "utf8"));

const lines = csv.map((r, i) => {
  const w = res[i];
  const addr = w.newWallet;
  const short = addr.slice(0, 4) + "..." + addr.slice(-4);
  const txh = w.txHash;
  const txShort = txh.slice(0, 4) + "..." + txh.slice(-3);
  return `| ${r.num} | ${r.name} | ${r.email} | [${short}](https://stellar.expert/explorer/testnet/account/${addr}) | [\`${txShort}\`](https://stellar.expert/explorer/testnet/tx/${txh}) | Donate |`;
});

const table = `### User Wallet Interactions (10+ Users)

| # | Name | Email | Wallet Address | Transaction | Action |
|---|------|-------|----------------|-------------|--------|
${lines.join("\n")}

> Wallet addresses and transaction hashes are truncated for readability - click any value to view it in full on Stellar Expert (testnet).`;

fs.writeFileSync("scripts/readme_table2.md", table, "utf8");
console.log("Table written to scripts/readme_table2.md");
