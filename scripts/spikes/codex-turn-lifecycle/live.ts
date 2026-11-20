import { runLiveCheck } from "../codex-benchmark-live-check.ts";

const executable = process.env.CDX_CHORES_CODEX_PATH;
if (!executable) throw new Error("The lifecycle probe requires its synthetic app-server.");

await runLiveCheck(["--model", "model-a", "--effort", "low", "--session-retention", "archive"], {
  appServer: { executable, args: ["app-server", "--listen", "stdio://"] },
});
