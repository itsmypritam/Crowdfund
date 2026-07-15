const sdk = require("@stellar/stellar-sdk");
const fs = require("fs");
const crypto = require("crypto");
const https = require("https");

const RPC_URL = "https://soroban-testnet.stellar.org";
const NET = sdk.Networks.TESTNET;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

async function deploy() {
  const wasmPath = "contract/target/wasm32v1-none/release/crowd_escrow.wasm";
  const wasm = fs.readFileSync(wasmPath);
  const wasmHash = crypto.createHash("sha256").update(wasm).digest();

  // Create + fund account
  const kp = sdk.Keypair.random();
  console.log("Funding account:", kp.publicKey());
  const fb = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (fb.status !== "ok" && !fb.hash) {
    console.error("Friendbot failed:", fb);
    process.exit(1);
  }
  console.log("Funded! Hash:", fb.hash);

  await new Promise((r) => setTimeout(r, 5000));

  const server = new sdk.rpc.Server(RPC_URL);

  // Step 1: Upload WASM
  console.log("\nStep 1: Uploading WASM...");
  const acct1 = await server.getAccount(kp.publicKey());
  const uploadTx = new sdk.TransactionBuilder(acct1, {
    fee: sdk.BASE_FEE, networkPassphrase: NET,
  })
    .addOperation(sdk.Operation.uploadContractWasm({ wasm }))
    .setTimeout(30)
    .build();

  const uploadSim = await server.simulateTransaction(uploadTx);
  if (!uploadSim || uploadSim.error) throw new Error("Upload sim: " + uploadSim?.error);

  const uploadPrepared = sdk.rpc.assembleTransaction(uploadTx, uploadSim).build();
  uploadPrepared.sign(kp);
  const uploadResp = await server.sendTransaction(uploadPrepared);
  console.log("Upload status:", uploadResp.status, uploadResp.hash);

  if (uploadResp.status !== "PENDING" && uploadResp.status !== "DUPLICATE") {
    throw new Error("Upload failed: " + uploadResp.error);
  }

  let uploadGet = await server.getTransaction(uploadResp.hash);
  for (let i = 0; i < 30 && uploadGet.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    uploadGet = await server.getTransaction(uploadResp.hash);
  }
  if (uploadGet.status !== "SUCCESS") throw new Error("Upload tx not successful: " + uploadGet.status);
  console.log("WASM uploaded!");

  // Step 2: Create contract
  console.log("\nStep 2: Creating contract...");
  const acct2 = await server.getAccount(kp.publicKey());
  const createTx = new sdk.TransactionBuilder(acct2, {
    fee: sdk.BASE_FEE, networkPassphrase: NET,
  })
    .addOperation(sdk.Operation.createCustomContract({
      wasmHash,
      address: new sdk.Address(kp.publicKey()),
    }))
    .setTimeout(30)
    .build();

  const createSim = await server.simulateTransaction(createTx);
  if (!createSim || createSim.error) throw new Error("Create sim: " + createSim?.error);

  const createPrepared = sdk.rpc.assembleTransaction(createTx, createSim).build();
  createPrepared.sign(kp);
  const createResp = await server.sendTransaction(createPrepared);
  console.log("Create status:", createResp.status, createResp.hash);

  if (createResp.status !== "PENDING" && createResp.status !== "DUPLICATE") {
    throw new Error("Create failed: " + createResp.error);
  }

  let createGet = await server.getTransaction(createResp.hash);
  for (let i = 0; i < 30 && createGet.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    createGet = await server.getTransaction(createResp.hash);
  }

  if (createGet.status !== "SUCCESS") throw new Error("Create tx not successful: " + createGet.status);

  const cidBytes = createGet.returnValue?._value?._value;
  const contractId = cidBytes ? sdk.StrKey.encodeContract(Buffer.from(cidBytes)) : "UNKNOWN";

  console.log("\n========================================");
  console.log("✅  CONTRACT DEPLOYED!");
  console.log("   Contract ID:", contractId);
  console.log("   Upload tx :", uploadResp.hash);
  console.log("   Create tx :", createResp.hash);
  console.log("   Deployer  :", kp.publicKey());
  console.log("   Secret    :", kp.secret());
  console.log("========================================");
  console.log("\nSet these in your .env files:");
  console.log(`CONTRACT_ID=${contractId}`);
  console.log(`FUNDING_SECRET=${kp.secret()}`);
  console.log(`DEPLOYER_ADDRESS=${kp.publicKey()}`);
}

deploy().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
