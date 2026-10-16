// Loaded before the private Node harness. These scoped traps record attempted I/O
// even if an adapter catches the thrown error. They are not a security sandbox.
const { syncBuiltinESMExports } = require("node:module");
const fs = require("node:fs");
const sentinel = "/docx-baseline-synthetic-never-load.png";
const counts = {};
const controls = [];
function trap(owner, key, label, args, predicate = () => true) {
  const original = owner[key];
  owner[key] = function (...values) {
    if (!predicate(values[0])) return original.apply(this, values);
    counts[label] = (counts[label] || 0) + 1;
    throw new Error(`DOCX baseline blocked ${label}`);
  };
  controls.push(() => owner[key](...args));
}
trap(globalThis, "fetch", "fetch", ["https://example.invalid/positive-control"]);
for (const scheme of ["http", "https"]) {
  const module = require(`node:${scheme}`);
  for (const key of ["request", "get"])
    trap(module, key, `${scheme}.${key}`, [`${scheme}://example.invalid/positive-control`]);
}
for (const key of ["connect", "createConnection"])
  trap(require("node:net"), key, `net.${key}`, [{ port: 1 }]);
trap(require("node:tls"), "connect", "tls.connect", [{ port: 1 }]);
for (const key of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {
  trap(require("node:child_process"), key, `child_process.${key}`, [
    "docx-baseline-positive-control",
  ]);
}
const isSentinel = (value) => String(value).includes("docx-baseline-synthetic-never-load.png");
for (const key of ["readFile", "readFileSync", "createReadStream"])
  trap(fs, key, `fs.${key}`, [sentinel], isSentinel);
trap(fs.promises, "readFile", "fs.promises.readFile", [sentinel], isSentinel);
syncBuiltinESMExports();
globalThis.__docxBaselineGuard = {
  counts,
  reset() {
    for (const key of Object.keys(counts)) delete counts[key];
  },
  positiveControls() {
    for (const call of controls) {
      try {
        call();
      } catch (error) {
        if (!String(error).includes("DOCX baseline blocked")) throw error;
      }
    }
    if (
      Object.keys(counts).length !== controls.length ||
      Object.values(counts).some((value) => value !== 1)
    ) {
      throw new Error("Offline guard positive control was not intercepted");
    }
    return { ...counts };
  },
};
