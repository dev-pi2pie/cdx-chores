import { expect } from "bun:test";
import { chmod } from "node:fs/promises";
import { join } from "node:path";
import { startFixtureProcess } from "../../../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../../../helpers/cli-test-utils";

const bundles = new Map<string, Promise<Blob>>();

function bundle(entrypoint: string): Promise<Blob> {
  const existing = bundles.get(entrypoint);
  if (existing) return existing;

  const pending = Bun.build({
    entrypoints: [join(import.meta.dir, entrypoint)],
    target: "node",
  })
    .then((result) => {
      if (!result.success || !result.outputs[0])
        throw new AggregateError(result.logs, `Could not bundle ${entrypoint}.`);
      return result.outputs[0];
    })
    .catch((error) => {
      bundles.delete(entrypoint);
      throw error;
    });
  bundles.set(entrypoint, pending);
  return pending;
}

export async function runExportFixture(
  entrypoint: "export-driver.ts" | "sequence-driver.ts",
  mode: string,
  completed: boolean,
) {
  let canClean = true;
  await withTempFixtureDir(
    "frame-export",
    async (root) => {
      const [toolBundle, driverBundle] = await Promise.all([
        bundle("export-tool.ts"),
        bundle(entrypoint),
      ]);
      const tool = join(root, "tool");
      const driver = join(root, "driver.mjs");
      await Bun.write(tool, `#!/usr/bin/env node\n${await toolBundle.text()}`);
      await chmod(tool, 0o700);
      await Bun.write(driver, driverBundle);

      canClean = false;
      const result = await startFixtureProcess({
        executable: "node",
        args: [driver, mode, root, tool],
        cwd: REPO_ROOT,
        env: { PATH: process.env.PATH },
        timeoutMs: 15_000,
        graceMs: 500,
        cleanupMs: 4_000,
        maxOutputBytes: 65_536,
      }).completion;
      canClean = result.stopped;
      expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
      expect(result.ok, result.stderr || result.reason).toBe(true);
      expect(JSON.parse(result.stdout)).toMatchObject({ completed });
    },
    () => canClean,
  );
}
