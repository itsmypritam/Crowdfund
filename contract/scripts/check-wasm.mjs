import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const wasmPath = "target/wasm32v1-none/release/crowd_escrow.wasm";
const tsPath = "../src/components/wasm_base64.ts";

function lebValue(buf, start) {
  let result = 0;
  let shift = 0;
  let pos = start;
  for (;;) {
    const b = buf[pos++];
    result |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return result;
}

function lebSize(buf, start) {
  let pos = start;
  while (buf[pos++] & 0x80) {}
  return pos - start;
}

function funcExports(buf) {
  const names = [];
  let offset = 8;
  while (offset < buf.length) {
    const id = buf[offset++];
    const size = lebValue(buf, offset);
    const sectionEnd = offset + lebSize(buf, offset) + size;
    if (id === 7) {
      let pos = offset + lebSize(buf, offset);
      const count = lebValue(buf, pos);
      pos += lebSize(buf, pos);
      for (let i = 0; i < count; i++) {
        const nameLen = lebValue(buf, pos);
        pos += lebSize(buf, pos);
        const name = buf.toString("utf8", pos, pos + nameLen);
        pos += nameLen;
        const kind = buf[pos++];
        const index = lebValue(buf, pos);
        pos += lebSize(buf, pos);
        if (kind === 0 && Number.isInteger(index)) names.push(name);
      }
      break;
    }
    offset = sectionEnd;
  }
  return names.sort();
}

const ts = readFileSync(tsPath, "utf8");
const b64Match = ts.match(/WASM_B64 = "([^"]+)"/);
const shaMatch = ts.match(/WASM_SHA = "([^"]+)"/);
if (!b64Match || !shaMatch) {
  console.error(
    "FAIL: " + tsPath + " is missing WASM_B64/WASM_SHA. Run: cargo build --target wasm32v1-none --release && node scripts/update-wasm.mjs"
  );
  process.exit(1);
}

const currentSha = createHash("sha256")
  .update(readFileSync("src/lib.rs").toString("utf8").replace(/\r\n/g, "\n"))
  .update(readFileSync("Cargo.toml").toString("utf8").replace(/\r\n/g, "\n"))
  .digest("hex");
if (currentSha !== shaMatch[1]) {
  console.error(
    "FAIL: the contract source changed but src/components/wasm_base64.ts was not regenerated. Run: cargo build --target wasm32v1-none --release && node scripts/update-wasm.mjs"
  );
  process.exit(1);
}

const embeddedExports = funcExports(Buffer.from(b64Match[1], "base64"));
const builtExports = funcExports(readFileSync(wasmPath));
if (JSON.stringify(embeddedExports) !== JSON.stringify(builtExports)) {
  console.error(
    "FAIL: the WASM embedded in src/components/wasm_base64.ts does not match the built contract. Regenerate with: cargo build --target wasm32v1-none --release && node scripts/update-wasm.mjs"
  );
  process.exit(1);
}

console.log("OK: embedded WASM is up to date (source hash + exports match).");
