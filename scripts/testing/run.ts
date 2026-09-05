import { fileURLToPath } from "node:url";

import { runManagedTests } from "./orchestration/runner.ts";

const cancellation = new AbortController();
const cancel = () => cancellation.abort();
process.on("SIGINT", cancel);
process.on("SIGTERM", cancel);
try {
  const result = await runManagedTests(
    fileURLToPath(new URL("../../", import.meta.url)),
    process.argv.slice(2),
    {
      signal: cancellation.signal,
    },
  );
  process.exitCode = result.exitCode;
} finally {
  process.off("SIGINT", cancel);
  process.off("SIGTERM", cancel);
}
