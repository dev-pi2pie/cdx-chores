import { expect, test } from "bun:test";
import { join } from "node:path";
import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

test(
  "Node smoke workspaces validate both families and retain changed ownership",
  () =>
    withTempFixtureDir("smoke-workspace", async (root) => {
      const driver = await Bun.build({
        entrypoints: [join(REPO_ROOT, "scripts/spikes/video-frames/verify-workspace.ts")],
        target: "node",
      });
      expect(driver.success).toBe(true);
      const driverPath = join(root, "verify.mjs");
      await Bun.write(driverPath, driver.outputs[0]!);
      const owned = startFixtureProcess({
        executable: "node",
        args: [driverPath],
        cwd: REPO_ROOT,
        env: { PATH: process.env.PATH },
        timeoutMs: 8_000,
        graceMs: 500,
        cleanupMs: 4_000,
        maxOutputBytes: 8_192,
      });
      const result = await owned.completion;
      expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
      expect(result.ok, result.stderr).toBe(true);
      expect(result.stdout).toBe(
        "Smoke recipes, budgets, families, ignored workspaces, ownership and cleanup passed. No media created.\n",
      );
    }),
  13_000,
);
