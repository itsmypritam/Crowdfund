import http from "http";
import fs from "fs";
import crypto from "crypto";
import * as sdk from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";
const NET = sdk.Networks.TESTNET;
const PUBKEY = "GATJMD6BGNK4FQYNFWB354N7RP4XHA2R74GNSYM472ALNLJFX7NXBS3X";
const PORT = 4444;

const wasm = fs.readFileSync("contract/target/wasm32-unknown-unknown/release/crowdfund.wasm");
const wasmHash = crypto.createHash("sha256").update(wasm).digest();
const server = new sdk.rpc.Server(RPC_URL);

async function getTxXDR() {
  const account = await server.getAccount(PUBKEY);
  const tx = new sdk.TransactionBuilder(account, { fee: sdk.BASE_FEE, networkPassphrase: NET })
    .addOperation(sdk.Operation.uploadContractWasm({ wasm }))
    .setTimeout(300)
    .build();
  const sim = await server.simulateTransaction(tx);
  const prepared = sdk.rpc.assembleTransaction(tx, sim);
  return prepared.build().toXDR();
}

http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.url === "/xdr" && req.method === "GET") {
    const xdr = await getTxXDR();
    res.end(JSON.stringify({ xdr }));
    return;
  }

  if (req.url === "/submit" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const { signedXdr } = JSON.parse(body);
        const resp = await server.sendTransaction(signedXdr);
        if (resp.status === "PENDING" || resp.status === "DUPLICATE") {
          let getResp, retries = 0;
          while ((!getResp || getResp.status === "NOT_FOUND") && retries < 30) {
            await new Promise((r) => setTimeout(r, 1000));
            getResp = await server.getTransaction(resp.hash);
            retries++;
          }
          if (getResp.status === "SUCCESS") {
            // Now create contract
            const account2 = await server.getAccount(PUBKEY);
            const createTx = new sdk.TransactionBuilder(account2, { fee: sdk.BASE_FEE, networkPassphrase: NET })
              .addOperation(sdk.Operation.createCustomContract({ wasmHash, address: new sdk.Address(PUBKEY) }))
              .setTimeout(300)
              .build();
            const createSim = await server.simulateTransaction(createTx);
            const createPrepared = sdk.rpc.assembleTransaction(createTx, createSim);
            res.end(JSON.stringify({ status: "upload_done", createXdr: createPrepared.build().toXDR(), hash: resp.hash }));
          } else {
            res.end(JSON.stringify({ error: "Upload tx failed", status: getResp.status }));
          }
        } else {
          res.end(JSON.stringify({ error: "Submit failed", resp }));
        }
      } catch (e) {
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (req.url === "/submit-create" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const { signedXdr } = JSON.parse(body);
        const resp = await server.sendTransaction(signedXdr);
        if (resp.status === "PENDING" || resp.status === "DUPLICATE") {
          let getResp, retries = 0;
          while ((!getResp || getResp.status === "NOT_FOUND") && retries < 30) {
            await new Promise((r) => setTimeout(r, 1000));
            getResp = await server.getTransaction(resp.hash);
            retries++;
          }
          if (getResp.status === "SUCCESS") {
            const contractId = getResp.contractId || "UNKNOWN";
            res.end(JSON.stringify({ status: "success", contractId, hash: resp.hash }));
          } else {
            res.end(JSON.stringify({ error: "Create tx failed", status: getResp.status }));
          }
        } else {
          res.end(JSON.stringify({ error: "Submit failed", resp }));
        }
      } catch (e) {
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // HTML page
  res.setHeader("Content-Type", "text/html");
  res.end(`
<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:2rem">
<h2>Deploy Crowdfund Contract</h2>
<p>Wallet: ${PUBKEY}</p>
<button id="step1">Step 1: Sign & Upload WASM</button>
<p id="status1"></p>
<button id="step2" disabled>Step 2: Sign & Create Contract</button>
<p id="status2"></p>
<p id="result"></p>
<script>
async function getXdr() {
  const r = await fetch("/xdr");
  const d = await r.json();
  return d.xdr;
}
async function submit(xdr) {
  const r = await fetch("/submit", { method:"POST", body:JSON.stringify({signedXdr:xdr}) });
  return r.json();
}
async function submitCreate(xdr) {
  const r = await fetch("/submit-create", { method:"POST", body:JSON.stringify({signedXdr:xdr}) });
  return r.json();
}
document.getElementById("step1").onclick = async () => {
  const s = document.getElementById("status1");
  s.textContent = "Fetching XDR...";
  const xdr = await getXdr();
  s.textContent = "Opening Freighter...";
  try {
    const signed = await window.freighterApi.signTransaction(xdr, { networkPassphrase: "Test SDF Network ; September 2015" });
    if (signed.error) { s.textContent = "Error: " + signed.error; return; }
    s.textContent = "Submitting...";
    const res = await submit(signed.signedTxXdr || signed);
    if (res.error) { s.textContent = "Error: " + res.error; return; }
    s.textContent = "WASM uploaded! Tx: " + (res.hash || "done");
    document.getElementById("step2").disabled = false;
    window._createXdr = res.createXdr;
  } catch(e) { s.textContent = "Error: " + e.message; }
};
document.getElementById("step2").onclick = async () => {
  const s = document.getElementById("status2");
  s.textContent = "Opening Freighter...";
  try {
    const signed = await window.freighterApi.signTransaction(window._createXdr, { networkPassphrase: "Test SDF Network ; September 2015" });
    if (signed.error) { s.textContent = "Error: " + signed.error; return; }
    s.textContent = "Submitting...";
    const res = await submitCreate(signed.signedTxXdr || signed);
    if (res.error) { s.textContent = "Error: " + res.error; return; }
    s.textContent = "Contract created!";
    document.getElementById("result").innerHTML = "<b>Contract ID:</b> " + res.contractId;
  } catch(e) { s.textContent = "Error: " + e.message; }
};
</script>
</body></html>`);
}).listen(PORT, () => console.log("Open http://localhost:" + PORT + " in your browser (where Freighter is installed)"));
