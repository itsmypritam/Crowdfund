#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const ROOT = resolve(import.meta.dirname, "..");
const WASM_PATH = join(ROOT, "contract", "target", "wasm32v1-none", "release", "crowd_escrow.wasm");
const OUT_PATH = join(ROOT, "src", "components", "wasm_base64.ts");
const SRC_DIR = join(ROOT, "contract", "src");

if (!existsSync(WASM_PATH)) {
  console.error(`WASM not found at ${WASM_PATH}\nRun: cargo build --target wasm32v1-none --release`);
  process.exit(1);
}

const wasmBytes = readFileSync(WASM_PATH);

const wasmB64 = wasmBytes.toString("base64");
const wasmSha = createHash("sha256").update(wasmBytes).digest("hex");

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
  (h, f) => createHash("sha256").update(h).update(readFileSync(f)).digest("hex"),
  ""
);

const mod = new WebAssembly.Module(wasmBytes);
const exports = WebAssembly.Module.exports(mod)
  .filter((e) => e.kind === "function")
  .map((e) => e.name)
  .sort();
const exportSet = exports.join(",");

const content = `export const WASM_B64 = ${JSON.stringify(wasmB64)};

export const WASM_SHA = ${JSON.stringify(wasmSha)};

export const WASM_SOURCE_HASH = ${JSON.stringify(sourceHash)};

export const WASM_EXPORTS = ${JSON.stringify(exportSet)};
`;

writeFileSync(OUT_PATH, content);
console.log(`Updated ${OUT_PATH}`);
console.log(`  SHA:   ${wasmSha}`);
console.log(`  Size:  ${wasmBytes.length} bytes`);
console.log(`  Source hash: ${sourceHash}`);
console.log(`  Exports (${exports.length}): ${exportSet}`);
