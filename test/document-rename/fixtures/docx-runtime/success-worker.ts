import { parentPort } from "node:worker_threads";

parentPort!.postMessage({
  ok: true,
  facts: {
    rawText: "Independent fixture report\n\n",
    headings: [],
    hasContent: true,
    metadataResult: { warnings: [] },
    diagnostics: [],
  },
});
