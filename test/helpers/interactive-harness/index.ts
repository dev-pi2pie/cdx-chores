import { REPO_ROOT } from "../cli-test-utils";
import { interactiveHarnessRunnerPath } from "./module-urls";
import type {
  InteractiveHarnessResult,
  InteractiveHarnessScenario,
} from "./types";

export function runInteractiveHarness(
  scenario: InteractiveHarnessScenario,
  options: { allowFailure?: boolean } = {},
): InteractiveHarnessResult {
  const proc = Bun.spawnSync({
    cmd: [process.execPath, interactiveHarnessRunnerPath, JSON.stringify(scenario)],
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = Buffer.from(proc.stdout).toString("utf8").trim();
  const stderr = Buffer.from(proc.stderr).toString("utf8");

  if (!stdout) {
    throw new Error(`Interactive harness produced no stdout.\n${stderr}`);
  }

  const parsed = JSON.parse(stdout) as InteractiveHarnessResult;
  if (proc.exitCode !== 0 && !(options.allowFailure ?? false)) {
    throw new Error(`Interactive harness failed: ${parsed.error ?? stderr}`);
  }

  return parsed;
}
