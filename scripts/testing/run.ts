import { fileURLToPath } from "node:url";

import { runManagedTests } from "./orchestration/runner.ts";

const cancellation = new AbortController();
const cancel = () => cancellation.abort();
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
let outputFailed = false;
try {
  const result = await runManagedTests(
    fileURLToPath(new URL("../../", import.meta.url)),
    process.argv.slice(2),
    {
      signal: cancellation.signal,
    },
  );
  process.exitCode = result.exitCode;
  outputFailed = result.outputFailed;
} finally {
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}

// Finalization and bounded fallback have finished. A broken or stalled stdio
// handle must not keep the command alive waiting for an undeliverable write.
if (outputFailed) process.exit(1);
