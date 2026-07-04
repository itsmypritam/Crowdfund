// Test donate on the new contract to find exact error
const sdk = require("@stellar/stellar-sdk");

const RPC_URL = "https://soroban-testnet.stellar.org";
const NET = sdk.Networks.TESTNET;
const CONTRACT_ID = "CAZZTPKG54TM5CGPPZQSQWAEYRGKGWM2PDR232TUMZITK3JYKSGCUT5S";
// Donor secret - use a funded testnet account
const DONOR_SECRET = process.env.STELLAR_SECRET || "SCHHJJGBCLCFQUDUIUZ7SIS2BIH4EEOENDWFKRH6W6U656AYHMQUEFVC";

async function test() {
  const kp = sdk.Keypair.fromSecret(DONOR_SECRET);
  const pubkey = kp.publicKey();
  const server = new sdk.rpc.Server(RPC_URL);
  const contract = new sdk.Contract(CONTRACT_ID);

  console.log("Donor:", pubkey);
  const account = await server.getAccount(pubkey);
  console.log("Seq (RPC):", account.sequenceNumber());
  console.log("Seq from Horizon: ...checking...");
  // Check Horizon seq too
  const hresp = await new Promise((resolve, reject) => {
    const https = require("https");
    https.get("https://horizon-testnet.stellar.org/accounts/" + pubkey, (res) => {
      let d = "";
      res.on("data", (c) => d += c);
      res.on("end", () => resolve(JSON.parse(d)));
    }).on("error", reject);
  });
  console.log("Seq (Horizon):", hresp.sequence);

  const amount = sdk.nativeToScVal(BigInt(1_000_000_0), { type: "i128" }); // 1 XLM = 10,000,000 stroops (we'll do 0.1 XLM)

  const scParams = [
    sdk.nativeToScVal(pubkey, { type: "address" }),
    sdk.nativeToScVal(BigInt(1_000_000), { type: "i128" }), // 0.1 XLM
  ];

  const txn = new sdk.TransactionBuilder(account, {
    fee: sdk.BASE_FEE,
    networkPassphrase: NET,
  })
    .addOperation(contract.call("donate", ...scParams))
    .setTimeout(30);

  // Step 1: Simulate with record mode to get auth
  console.log("\nSimulating (record mode)...");
  // Step 1b: Build ONCE, reuse for sim + assembly
  const builtTx = txn.build();
  console.log("TX seq:", builtTx.sequence);

  const simResp = await server.simulateTransaction(builtTx, undefined, "record");
  if (!simResp || simResp.error) { console.error("Sim failed:", simResp?.error); process.exit(1); }
  if (!sdk.rpc.Api.isSimulationSuccess(simResp)) { console.error("Contract sim failed:", simResp); process.exit(1); }

  console.log("Sim success! Auth entries:", simResp.result?.auth?.length || 0);
  if (simResp.result?.auth?.length > 0) {
    try {
      console.log("Auth entry type:", simResp.result.auth[0]._attributes.credentials().switch().name);
    } catch {}
  }

  // Step 2: Assemble the transaction
  console.log("\nAssembling...");
  const preparedTxn = sdk.rpc.assembleTransaction(builtTx, simResp);
  const xdr = preparedTxn.build().toXDR();

  // Step 3: Sign with keypair (simulating what Freighter does)
  console.log("\nSigning...");
  const tx = new sdk.Transaction(xdr, NET);
  console.log("Signed TX seq:", tx.sequence);
  tx.sign(kp);

  // Step 4: Submit
  console.log("\nSending...");
  const sendResponse = await server.sendTransaction(tx);
  console.log("Send status:", JSON.stringify(sendResponse, null, 2));

  if (sendResponse.status === "PENDING" || sendResponse.status === "DUPLICATE") {
    // Poll for result
    let getResp = await server.getTransaction(sendResponse.hash);
    for (let i = 0; i < 30 && getResp.status === "NOT_FOUND"; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      getResp = await server.getTransaction(sendResponse.hash);
    }
    console.log("Tx result:", getResp.status, getResp.result?.error || "");
    if (getResp.status === "SUCCESS") {
      console.log("\n✅ DONATION SUCCESSFUL! Tx:", sendResponse.hash);
    } else {
      console.log("\n❌ Transaction failed:", getResp.status, JSON.stringify(getResp.result));
    }
  } else {
    console.log("\n❌ Submission failed:", sendResponse.status, sendResponse.error || "");
    console.log("Tx hash:", sendResponse.hash);
    console.log("Stellar Expert: https://stellar.expert/explorer/testnet/tx/" + sendResponse.hash);
  }
}

test().catch(console.error);
