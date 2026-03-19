import { join } from "node:path";

import { REPO_ROOT } from "./cli-test-utils";

export function seedStackedMergedBandFixture(outputDir: string): void {
  const proc = Bun.spawnSync({
    cmd: ["node", "scripts/generate-stacked-merged-band-fixture.mjs", "reset", "--output-dir", outputDir],
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode === 0) {
    return;
  }

  const stdout = Buffer.from(proc.stdout).toString("utf8");
  const stderr = Buffer.from(proc.stderr).toString("utf8");
  throw new Error(
    `Failed to seed stacked merged-band fixture in ${join(outputDir)} (exit ${proc.exitCode}).\nstdout:\n${stdout}\nstderr:\n${stderr}`,
  );
}
