import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const wasmPath = resolve(root, "contract/target/wasm32v1-none/release/crowd_escrow.wasm");
const tsPath = resolve(root, "src/components/wasm_base64.ts");

const normalize = (buf) => buf.toString("utf8").replace(/\r\n/g, "\n");

const hash = createHash("sha256")
  .update(normalize(readFileSync(resolve(root, "contract/src/lib.rs"))))
  .update(normalize(readFileSync(resolve(root, "contract/Cargo.toml"))))
  .digest("hex");

const wasmB64 = readFileSync(wasmPath).toString("base64");
writeFileSync(tsPath, `export const WASM_B64 = "${wasmB64}";\n\nexport const WASM_SHA = "${hash}";\n`);
console.log("Wrote " + tsPath);
console.log("source sha256 " + hash);
