import { expect, test } from "bun:test";
import { join } from "node:path";
import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";
test(
  "Node frames command validates before tools, exports all modes, and retains review identity/partial outcomes",
  () =>
    withTempFixtureDir("frame-action", async (root) => {
      const [tool, driver] = await Promise.all(
        ["export-tool", "action-driver"].map((name) =>
          Bun.build({
            entrypoints: [join(import.meta.dir, `fixtures/${name}.ts`)],
            target: "node",
            packages: "external",
          }),
        ),
      );
      expect(tool!.success).toBe(true);
      expect(driver!.success).toBe(true);
      const toolPath = join(root, "tool.mjs"),
        driverPath = join(root, "driver.mjs");
      await Bun.write(toolPath, tool!.outputs[0]!);
      await Bun.write(driverPath, driver!.outputs[0]!);
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
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(result.stdout.length, result.stderr).toBeGreaterThan(0);
      expect(JSON.parse(result.stdout)).toEqual({
        validation: true,
        toolsBeforeSource: true,
        first: true,
        set: true,
        sequence: true,
        timestamp: true,
        review: true,
        partial: true,
        presentation: true,
      });
    }),
  35000,
);
