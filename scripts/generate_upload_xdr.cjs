const sdk = require("@stellar/stellar-sdk");
const fs = require("fs");

const RPC_URL = "https://soroban-testnet.stellar.org";
const NET = sdk.Networks.TESTNET;
const PUBKEY = "GATJMD6BGNK4FQYNFWB354N7RP4XHA2R74GNSYM472ALNLJFX7NXBS3X";

async function main() {
  const wasm = fs.readFileSync("contract/target/wasm32-unknown-unknown/release/crowdfund.wasm");
  const account = await (new sdk.rpc.Server(RPC_URL)).getAccount(PUBKEY);

  const tx = new sdk.TransactionBuilder(account, { fee: sdk.BASE_FEE, networkPassphrase: NET })
    .addOperation(sdk.Operation.uploadContractWasm({ wasm }))
    .setTimeout(300)
    .build();

  const sim = await (new sdk.rpc.Server(RPC_URL)).simulateTransaction(tx);
  if (!sim || sim.error) { console.error("Sim failed:", JSON.stringify(sim)); process.exit(1); }

  const prepared = sdk.rpc.assembleTransaction(tx, NET, sim);
  console.log("=== UPLOAD WASM XDR (sign in Freighter) ===\n");
  console.log(prepared.toXDR());
}

main().catch(console.error);
