import { writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runDocxChild } from "../../src/docx/runtime/child";

const path = fileURLToPath(import.meta.url);
// Entry aliases may share a bundled chunk; argv identifies the fixed invoked fixture.
const name = basename(process.argv[1]!);
const transition = name.includes("postparse") ? 3 : 4;
const observed = name.includes("below") ? 4 : name.includes("above") ? 6 : 5;
let samples = 0;
await runDocxChild({
  workerUrl: new URL("./measure-success-worker.mjs", import.meta.url),
  sampleRss: () => (++samples === transition ? observed : 1),
});
await writeFile(
  join(dirname(path), "child-transition.json"),
  JSON.stringify({ pid: process.pid, samples }),
);
