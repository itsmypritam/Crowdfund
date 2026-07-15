const sdk = require("@stellar/stellar-sdk");
const fs = require("fs");
const crypto = require("crypto");

const RPC_URL = "https://soroban-testnet.stellar.org";
const NET = sdk.Networks.TESTNET;

async function deploy() {
  const secret = process.env.STELLAR_SECRET;
  if (!secret) {
    console.error("Set STELLAR_SECRET env var to your testnet secret key");
    process.exit(1);
  }

  const wasm = fs.readFileSync(
    "contract/target/wasm32-unknown-unknown/release/crowd_escrow.wasm"
  );
  const wasmHash = crypto.createHash("sha256").update(wasm).digest();

  const server = new sdk.rpc.Server(RPC_URL);
  const keypair = sdk.Keypair.fromSecret(secret);
  const pubkey = keypair.publicKey();

  console.log("Deploying from:", pubkey);
  console.log("WASM size:", wasm.length, "bytes");

  const account = await server.getAccount(pubkey);

  // Step 1: Upload WASM
  console.log("\nStep 1: Uploading WASM...");
  const uploadTx = new sdk.TransactionBuilder(account, {
    fee: sdk.BASE_FEE,
    networkPassphrase: NET,
  })
    .addOperation(sdk.Operation.uploadContractWasm({ wasm }))
    .setTimeout(30)
    .build();

  const uploadSim = await server.simulateTransaction(uploadTx);
  if (!uploadSim || uploadSim.error) {
    console.error("Upload sim failed:", uploadSim?.error);
    process.exit(1);
  }

  const uploadPrepared = sdk.rpc.assembleTransaction(uploadTx, uploadSim).build();
  uploadPrepared.sign(keypair);
  const uploadResp = await server.sendTransaction(uploadPrepared);
  console.log("Upload status:", uploadResp.status, uploadResp.hash);

  if (uploadResp.status !== "PENDING" && uploadResp.status !== "DUPLICATE") {
    console.error("Upload failed:", uploadResp.error);
    process.exit(1);
  }

  let uploadGet = await server.getTransaction(uploadResp.hash);
  let retries = 0;
  while (uploadGet.status === "NOT_FOUND" && retries < 30) {
    await new Promise((r) => setTimeout(r, 1000));
    uploadGet = await server.getTransaction(uploadResp.hash);
    retries++;
  }
  if (uploadGet.status !== "SUCCESS") {
    console.error("Upload tx failed:", uploadGet.status);
    process.exit(1);
  }
  console.log("WASM uploaded successfully!");

  // Step 2: Create contract
  console.log("\nStep 2: Creating contract...");
  const account2 = await server.getAccount(pubkey);

  const createTx = new sdk.TransactionBuilder(account2, {
    fee: sdk.BASE_FEE,
    networkPassphrase: NET,
  })
    .addOperation(
      sdk.Operation.createCustomContract({
        wasmHash,
        address: new sdk.Address(pubkey),
      })
    )
    .setTimeout(30)
    .build();

  const createSim = await server.simulateTransaction(createTx);
  if (!createSim || createSim.error) {
    console.error("Create sim failed:", createSim?.error);
    process.exit(1);
  }

  const createPrepared = sdk.rpc.assembleTransaction(createTx, createSim).build();
  createPrepared.sign(keypair);
  const createResp = await server.sendTransaction(createPrepared);
  console.log("Create status:", createResp.status, createResp.hash);

  if (createResp.status !== "PENDING" && createResp.status !== "DUPLICATE") {
    console.error("Create failed:", createResp.error);
    process.exit(1);
  }

  let createGet = await server.getTransaction(createResp.hash);
  retries = 0;
  while (createGet.status === "NOT_FOUND" && retries < 30) {
    await new Promise((r) => setTimeout(r, 1000));
    createGet = await server.getTransaction(createResp.hash);
    retries++;
  }

  if (createGet.status === "SUCCESS") {
    // Contract ID is in the returnValue as an scvAddress
    const contractIdBytes = createGet.returnValue?._value?._value;
    const contractId = contractIdBytes ? sdk.StrKey.encodeContract(Buffer.from(contractIdBytes)) : "UNKNOWN";
    console.log("\n✅ CONTRACT DEPLOYED!");
    console.log("Contract ID:", contractId);
    console.log("Tx hash:", createResp.hash);
    console.log("\nSet this as CONTRACT_ID in your .env and Render dashboard");
  } else {
    console.error("Create failed:", createGet.status, createGet.error);
  }
}

deploy().catch(console.error);
