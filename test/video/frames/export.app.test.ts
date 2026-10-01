import { expect, test } from "bun:test";
import { join } from "node:path";
import { chmod } from "node:fs/promises";
import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";
for (const mode of [
  "normal",
  "repeat",
  "unavailable",
  "late-alpha",
  "decoder-partial",
  "short-encoder",
  "encoder-failure",
  "source-changed",
  "cancel",
  "duplicate",
  "duplicate-overwrite",
  "duplicate-case",
  "duplicate-case-overwrite",
  "duplicate-unicode",
  "duplicate-unicode-overwrite",
])
  test(
    `image export under Node: ${mode}`,
    () =>
      withTempFixtureDir("image-export", async (root) => {
        const toolBuild = await Bun.build({
          entrypoints: [join(import.meta.dir, "fixtures/export-tool.ts")],
          target: "node",
        });
        const driverBuild = await Bun.build({
          entrypoints: [join(import.meta.dir, "fixtures/export-driver.ts")],
          target: "node",
        });
        expect(toolBuild.success).toBe(true);
        expect(driverBuild.success).toBe(true);
        const tool = join(root, "tool"),
          driver = join(root, "driver.mjs");
        await Bun.write(tool, `#!/usr/bin/env node\n${await toolBuild.outputs[0]!.text()}`);
        await chmod(tool, 0o700);
        await Bun.write(driver, driverBuild.outputs[0]!);
        const owned = startFixtureProcess({
          executable: "node",
          args: [driver, mode, root, tool],
          cwd: REPO_ROOT,
          env: { PATH: process.env.PATH },
          timeoutMs: 15000,
          graceMs: 500,
          cleanupMs: 4000,
          maxOutputBytes: 65536,
        });
        const result = await owned.completion;
        expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
        expect(result.ok, result.stderr).toBe(true);
        expect(JSON.parse(result.stdout)).toBeObject();
      }),
    20000,
  );
