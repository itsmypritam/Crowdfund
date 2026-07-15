const sdk = require("@stellar/stellar-sdk");
const fs = require("fs");
const crypto = require("crypto");

const RPC_URL = "https://soroban-testnet.stellar.org";
const NET = sdk.Networks.TESTNET;
const PUBKEY = "GATJMD6BGNK4FQYNFWB354N7RP4XHA2R74GNSYM472ALNLJFX7NXBS3X";

async function main() {
  const wasm = fs.readFileSync(
    "contract/target/wasm32-unknown-unknown/release/crowd_escrow.wasm"
  );
  const wasmHash = crypto.createHash("sha256").update(wasm).digest();

  const server = new sdk.rpc.Server(RPC_URL);
  const account = await server.getAccount(PUBKEY);

  // Single transaction: upload WASM + create contract
  const tx = new sdk.TransactionBuilder(account, {
    fee: sdk.BASE_FEE,
    networkPassphrase: NET,
  })
    .addOperation(sdk.Operation.uploadContractWasm({ wasm }))
    .addOperation(
      sdk.Operation.createCustomContract({
        wasmHash,
        address: new sdk.Address(PUBKEY),
      })
    )
    .setTimeout(300)
    .build();

  // Simulate to get footprint & fee
  const sim = await server.simulateTransaction(tx);
  if (!sim || sim.error) {
    console.error("Simulation failed:", sim?.error || sim);
    process.exit(1);
  }

  // Assemble with proper footprint
  const prepared = sdk.rpc.assembleTransaction(tx, sim);
  const xdr = prepared.build().toXDR();

  console.log("=== DEPLOY TRANSACTION XDR ===");
  console.log("Copy this entire string below:\n");
  console.log(xdr);
  console.log("\n=== INSTRUCTIONS ===");
  console.log("1. Copy the XDR string above");
  console.log("2. Open Freighter → 'Sign Transaction' (or go to Settings → Sign Transaction)");
  console.log("3. Paste the XDR and sign");
  console.log("4. Share the signed XDR with me to submit to network");
  console.log("\nOr use Stellar Lab: https://lab.stellar.org/?network=testnet&xdr=PASTE_HERE");
}

main().catch(console.error);
