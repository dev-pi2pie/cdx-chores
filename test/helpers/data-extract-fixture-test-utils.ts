import { join } from "node:path";

import { REPO_ROOT } from "./cli-test-utils";

export function seedDataExtractFixtures(outputDir: string): void {
  const proc = Bun.spawnSync({
    cmd: ["node", "scripts/generate-data-extract-fixtures.mjs", "reset", "--output-dir", outputDir],
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
    `Failed to seed data-extract fixtures in ${join(outputDir)} (exit ${proc.exitCode}).\nstdout:\n${stdout}\nstderr:\n${stderr}`,
  );
}
