import { runCodexBenchmark } from "../../../src/adapters/codex/benchmark";
import { inspectCodexBenchmark } from "../../../src/cli/doctor/codex-benchmark";

const cwd = process.cwd();
await Promise.all([
  runCodexBenchmark({ cwd, models: [], speeds: [], runs: 1, prompt: "fixture" }),
  inspectCodexBenchmark(cwd, {
    ...process.env,
    CODEX_HOME: process.env.FIXTURE_SECOND_HOME,
    CDX_CHORES_CODEX_PATH: process.env.FIXTURE_SECOND_EXECUTABLE,
  }),
]);
