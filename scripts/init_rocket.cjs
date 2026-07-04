const sdk = require("@stellar/stellar-sdk");
const https = require("https");

const RPC_URL = "https://soroban-testnet.stellar.org";
const NET = sdk.Networks.TESTNET;
const CONTRACT_ID = "CAZZTPKG54TM5CGPPZQSQWAEYRGKGWM2PDR232TUMZITK3JYKSGCUT5S";
const SECRET = process.env.STELLAR_SECRET || "SCHHJJGBCLCFQUDUIUZ7SIS2BIH4EEOENDWFKRH6W6U656AYHMQUEFVC";

async function run() {
  const kp = sdk.Keypair.fromSecret(SECRET);
  const server = new sdk.rpc.Server(RPC_URL);
  const contract = new sdk.Contract(CONTRACT_ID);
  const acct = await server.getAccount(kp.publicKey());

  const goal = sdk.nativeToScVal(BigInt(100_000_000_000), { type: "i128" });    // 10,000 XLM
  const deadline = sdk.nativeToScVal(BigInt(Math.floor(Date.now() / 1000) + 86400 * 30), { type: "u64" }); // 30 days
  const title = sdk.nativeToScVal("Help build my rocket 🚀", { type: "string" });
  const desc = sdk.nativeToScVal("Rocket science needs funding!", { type: "string" });

  const tx = new sdk.TransactionBuilder(acct, { fee: sdk.BASE_FEE, networkPassphrase: NET })
    .addOperation(contract.call("initialize", sdk.nativeToScVal(kp.publicKey(), { type: "address" }), goal, deadline, title, desc))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx, undefined, "record");
  if (!sim || sim.error) throw new Error("Sim: " + JSON.stringify(sim?.error));
  if (!sdk.rpc.Api.isSimulationSuccess(sim)) throw new Error("Contract sim failed");

  const prepared = sdk.rpc.assembleTransaction(tx, sim).build();
  prepared.sign(kp);
  const resp = await server.sendTransaction(prepared);
  console.log("Init status:", resp.status, resp.hash);

  if (resp.status !== "PENDING" && resp.status !== "DUPLICATE") throw new Error("Init failed: " + resp.error);

  let getResp = await server.getTransaction(resp.hash);
  for (let i = 0; i < 30 && getResp.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    getResp = await server.getTransaction(resp.hash);
  }

  if (getResp.status === "SUCCESS") {
    console.log("\n✅  CAMPAIGN INITIALIZED on contract", CONTRACT_ID);
    console.log("   Owner:", kp.publicKey());
    console.log("   Goal : 10,000 XLM");
    console.log("   Title: Help build my rocket 🚀");
    console.log("\nNow go to http://localhost:4321, connect your wallet, set contract ID to");
    console.log(CONTRACT_ID);
    console.log("and test Donate!");
  } else {
    console.error("Init failed:", getResp.status, getResp.error);
  }
}

run().catch(console.error);
