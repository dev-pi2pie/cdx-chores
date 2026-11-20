import { runLiveCheck } from "../../../scripts/spikes/codex-benchmark-live-check.ts";

const executable = process.env.CDX_CHORES_CODEX_PATH;
if (!executable) throw new Error("The test launcher requires the synthetic app-server.");

await runLiveCheck(process.argv.slice(2), {
  appServer: { executable, args: ["app-server", "--listen", "stdio://"] },
});
