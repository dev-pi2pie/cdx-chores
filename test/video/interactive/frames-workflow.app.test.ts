import { expect, test } from "bun:test";
import { join } from "node:path";
import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";
test(
  "Node guided frames flow owns review, retained selections, settings corrections and fatal recovery boundaries",
  () =>
    withTempFixtureDir("frames-workflow", async (root) => {
      const [tool, driver] = await Promise.all([
        Bun.build({
          entrypoints: [join(import.meta.dir, "../frames/fixtures/export-tool.ts")],
          target: "node",
        }),
        Bun.build({
          entrypoints: [join(import.meta.dir, "fixtures/frames-workflow.ts")],
          target: "node",
          packages: "external",
        }),
      ]);
      expect(tool.success).toBe(true);
      expect(driver.success).toBe(true);
      const toolPath = join(root, "tool.mjs"),
        driverPath = join(root, "driver.mjs");
      await Bun.write(toolPath, tool.outputs[0]!);
      await Bun.write(driverPath, driver.outputs[0]!);
      const owned = startFixtureProcess({
        executable: "node",
        args: [driverPath, root, toolPath],
        cwd: REPO_ROOT,
        env: { PATH: process.env.PATH },
        timeoutMs: 30000,
        graceMs: 500,
        cleanupMs: 4000,
        maxOutputBytes: 65536,
      });
      const result = await owned.completion;
      expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
      expect(result.ok, result.stderr).toBe(true);
      expect(JSON.parse(result.stdout)).toEqual({
        changedSettings: true,
        exactIdentity: true,
        extension: true,
        reviewCancel: true,
        nestedDestinations: true,
        pathKindConflicts: true,
        sequence: true,
        oneImageSequence: true,
        repeatedSet: true,
        sourceChange: true,
        fatalStop: true,
      });
    }),
  35000,
);
