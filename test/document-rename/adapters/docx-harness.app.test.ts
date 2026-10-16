import { expect, test } from "bun:test";
import { join } from "node:path";

import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

for (const mode of [
  "progress",
  "startup",
  "timeout",
  "cancel",
  "cancel-term",
  "descendant",
  "descendant-pipes",
  "overflow",
  "failure",
  "unconfirmed",
]) {
  test(`candidate harness owns ${mode} outcome and temporary cleanup`, async () => {
    await withTempFixtureDir("docx-harness", async (root) => {
      const owned = startFixtureProcess({
        executable: "node",
        args: [
          join(REPO_ROOT, "test/document-rename/fixtures/docx-harness-driver.mjs"),
          mode,
          join(root, "owned"),
        ],
        cwd: REPO_ROOT,
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot },
        timeoutMs: 12_000,
        graceMs: 500,
        cleanupMs: 4_000,
        maxOutputBytes: 65_536,
      });
      const result = await owned.completion;
      expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
      expect(result.ok, result.stderr).toBe(true);
      expect(result.stdout).toBe("passed yes\n");
    });
  }, 20_000);
}
