#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const ROOT = resolve(import.meta.dirname, "..");
const WASM_PATH = join(ROOT, "contract", "target", "wasm32v1-none", "release", "crowd_escrow.wasm");
const EMBED_PATH = join(ROOT, "src", "components", "wasm_base64.ts");

if (!existsSync(WASM_PATH)) {
  console.error(`FAIL: WASM not found at ${WASM_PATH}\nRun: cargo build --target wasm32v1-none --release`);
  process.exit(1);
}

if (!existsSync(EMBED_PATH)) {
  console.error(`FAIL: ${EMBED_PATH} not found.\nRun: node scripts/update-wasm.mjs`);
  process.exit(1);
}

const wasmBytes = readFileSync(WASM_PATH);

const sourceFiles = [];
function collectRust(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectRust(full);
    else if (entry.name.endsWith(".rs") || entry.name.endsWith(".toml")) sourceFiles.push(full);
  }
}
collectRust(join(ROOT, "contract", "src"));
sourceFiles.push(join(ROOT, "contract", "Cargo.toml"));
sourceFiles.sort();
const sourceHash = sourceFiles.reduce(
  (h, f) => createHash("sha256").update(h).update(readFileSync(f, "utf8").replace(/\r\n/g, "\n")).digest("hex"),
  ""
);

const mod = new WebAssembly.Module(wasmBytes);
const exports = WebAssembly.Module.exports(mod)
  .filter((e) => e.kind === "function")
  .map((e) => e.name)
  .sort();
const exportSet = exports.join(",");

const embedded = readFileSync(EMBED_PATH, "utf8");

function extract(name) {
  const re = new RegExp(`export const ${name} = "([^"]*)"`);
  const m = embedded.match(re);
  return m ? m[1] : null;
}

const embeddedSourceHash = extract("WASM_SOURCE_HASH");
const embeddedExports = extract("WASM_EXPORTS");

let fail = false;

if (embeddedSourceHash !== sourceHash) {
  console.error(`FAIL: WASM_SOURCE_HASH mismatch\n  embedded: ${embeddedSourceHash}\n  actual:   ${sourceHash}\n  Rust source changed but the embedded hash is stale.\n  Run: cargo build --target wasm32v1-none --release && node scripts/update-wasm.mjs`);
  fail = true;
}

if (embeddedExports !== exportSet) {
  console.error(`FAIL: WASM_EXPORTS mismatch\n  embedded: ${embeddedExports}\n  actual:   ${exportSet}\n  Contract exports changed but the embedded list is stale.\n  Run: cargo build --target wasm32v1-none --release && node scripts/update-wasm.mjs`);
  fail = true;
}

if (fail) process.exit(1);
console.log("OK: embedded WASM is up to date");
