import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import { runDocxChild } from "../../../../src/docx/runtime/child";

writeFileSync(fileURLToPath(new URL("./child-pid", import.meta.url)), String(process.pid));
const samples: Record<string, number> = {
  "rss-below-child.mjs": 4,
  "rss-at-child.mjs": 5,
  "rss-above-child.mjs": 6,
};
const sample = samples[basename(fileURLToPath(import.meta.url))];
await runDocxChild({
  workerUrl: new URL(
    sample === undefined ? "./rss-worker.mjs" : "./success-worker.mjs",
    import.meta.url,
  ),
  ...(sample === undefined ? {} : { sampleRss: () => sample }),
});
