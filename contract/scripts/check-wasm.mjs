import { readFileSync } from "node:fs";

const wasmPath = "target/wasm32v1-none/release/crowd_escrow.wasm";
const tsPath = "../src/components/wasm_base64.ts";

const wasm = readFileSync(wasmPath).toString("base64");

const ts = readFileSync(tsPath, "utf8");
const match = ts.match(/WASM_B64 = "([^"]+)"/);
if (!match) {
  console.error("FAIL: could not find WASM_B64 in " + tsPath);
  process.exit(1);
}

if (match[1] !== wasm) {
  console.error(
    "FAIL: src/components/wasm_base64.ts is out of date. Rebuild the WASM and regenerate the file."
  );
  process.exit(1);
}

console.log("OK: embedded WASM matches the built artifact.");
