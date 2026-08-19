const sdk = require("@stellar/stellar-sdk");
const fs = require("fs");
const crypto = require("crypto");
const https = require("https");

const RPC_URL = "https://soroban-testnet.stellar.org";
const NET = sdk.Networks.TESTNET;
const WASM_PATH = "contract/target/wasm32v1-none/release/crowd_escrow.wasm";

const GOAL_XLM = "10000";
const DEADLINE_DAYS = 30;
const TITLE = "Help build my rocket \u{1F680}";
const DESCRIPTION = "Rocket science needs funding!";
const NATIVE_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function poll(server, hash, label) {
  let resp = await server.getTransaction(hash);
  for (let i = 0; i < 30 && resp.status === "NOT_FOUND"; i++) {
    await sleep(1000);
    resp = await server.getTransaction(hash);
  }
  if (resp.status !== "SUCCESS") {
    throw new Error(label + " tx failed: " + resp.status + " " + (resp.error || ""));
  }
  return resp;
}

async function main() {
  if (!fs.existsSync(WASM_PATH)) {
    throw new Error("WASM not found at " + WASM_PATH + " - build it first (cargo build --target wasm32v1-none --release)");
  }
  const wasm = fs.readFileSync(WASM_PATH);
  const wasmHash = crypto.createHash("sha256").update(wasm).digest();
  console.log("WASM size:", wasm.length, "bytes");
  console.log("WASM sha256:", wasmHash.toString("hex"));

  const kp = process.env.STELLAR_SECRET
    ? sdk.Keypair.fromSecret(process.env.STELLAR_SECRET)
    : sdk.Keypair.random();
  console.log("Deployer:", kp.publicKey());

  if (!process.env.STELLAR_SECRET) {
    console.log("Funding account via friendbot...");
    const fb = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
    if (fb.status !== "ok" && !fb.hash) throw new Error("Friendbot failed: " + JSON.stringify(fb));
    await sleep(5000);
  }

  const server = new sdk.rpc.Server(RPC_URL);

  console.log("\nStep 1: Uploading WASM...");
  const acct1 = await server.getAccount(kp.publicKey());
  const uploadTx = new sdk.TransactionBuilder(acct1, { fee: sdk.BASE_FEE, networkPassphrase: NET })
    .addOperation(sdk.Operation.uploadContractWasm({ wasm }))
    .setTimeout(30)
    .build();
  const uploadSim = await server.simulateTransaction(uploadTx);
  if (!uploadSim || uploadSim.error) throw new Error("Upload sim failed: " + JSON.stringify(uploadSim?.error));
  const uploadPrepared = sdk.rpc.assembleTransaction(uploadTx, uploadSim).build();
  uploadPrepared.sign(kp);
  const uploadResp = await server.sendTransaction(uploadPrepared);
  if (uploadResp.status !== "PENDING" && uploadResp.status !== "DUPLICATE") {
    throw new Error("Upload failed: " + uploadResp.error);
  }
  await poll(server, uploadResp.hash, "Upload");
  console.log("WASM uploaded:", uploadResp.hash);

  console.log("\nStep 2: Creating contract...");
  const acct2 = await server.getAccount(kp.publicKey());
  const createTx = new sdk.TransactionBuilder(acct2, { fee: sdk.BASE_FEE, networkPassphrase: NET })
    .addOperation(
      sdk.Operation.createCustomContract({
        wasmHash,
        address: new sdk.Address(kp.publicKey()),
      })
    )
    .setTimeout(30)
    .build();
  const createSim = await server.simulateTransaction(createTx);
  if (!createSim || createSim.error) throw new Error("Create sim failed: " + JSON.stringify(createSim?.error));
  const createPrepared = sdk.rpc.assembleTransaction(createTx, createSim).build();
  createPrepared.sign(kp);
  const createResp = await server.sendTransaction(createPrepared);
  if (createResp.status !== "PENDING" && createResp.status !== "DUPLICATE") {
    throw new Error("Create failed: " + createResp.error);
  }
  const createGet = await poll(server, createResp.hash, "Create");
  const cidBytes = createGet.returnValue?._value?._value;
  if (!cidBytes) throw new Error("Could not extract contract ID from create response");
  const contractId = sdk.StrKey.encodeContract(Buffer.from(cidBytes));
  console.log("Contract deployed:", contractId);

  console.log("\nStep 3: Initializing campaign...");
  const contract = new sdk.Contract(contractId);
  const acct3 = await server.getAccount(kp.publicKey());
  const goal = sdk.nativeToScVal(BigInt(Math.floor(parseFloat(GOAL_XLM) * 1e7)), { type: "i128" });
  const deadline = sdk.nativeToScVal(BigInt(Math.floor(Date.now() / 1000) + 86400 * DEADLINE_DAYS), { type: "u64" });
  const initTx = new sdk.TransactionBuilder(acct3, { fee: sdk.BASE_FEE, networkPassphrase: NET })
    .addOperation(
      contract.call(
        "initialize",
        sdk.nativeToScVal(kp.publicKey(), { type: "address" }),
        goal,
        deadline,
        sdk.nativeToScVal(TITLE, { type: "string" }),
        sdk.nativeToScVal(DESCRIPTION, { type: "string" }),
        sdk.nativeToScVal(NATIVE_TOKEN, { type: "address" })
      )
    )
    .setTimeout(30)
    .build();
  const initSim = await server.simulateTransaction(initTx, undefined, "record");
  if (!initSim || initSim.error) throw new Error("Init sim failed: " + JSON.stringify(initSim?.error));
  if (!sdk.rpc.Api.isSimulationSuccess(initSim)) throw new Error("Init contract sim failed");
  const initPrepared = sdk.rpc.assembleTransaction(initTx, initSim).build();
  initPrepared.sign(kp);
  const initResp = await server.sendTransaction(initPrepared);
  if (initResp.status !== "PENDING" && initResp.status !== "DUPLICATE") {
    throw new Error("Init failed: " + initResp.error);
  }
  await poll(server, initResp.hash, "Init");
  console.log("Campaign initialized:", initResp.hash);

  console.log("\n========================================");
  console.log("CONTRACT_ID=" + contractId);
  console.log("FUNDING_SECRET=" + kp.secret());
  console.log("DEPLOYER_ADDRESS=" + kp.publicKey());
  console.log("INIT_TX=" + initResp.hash);
  console.log("========================================");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
