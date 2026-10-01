import { describe, expect, test } from "bun:test";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";
describe("Node resolver with controlled FFprobe", () => {
  for (const mode of [
    "mapping",
    "large",
    "timing",
    "change",
    "during",
    "error",
    "partial",
    "record-limit",
    "metadata-limit",
    "cancel",
  ])
    test(
      mode,
      () =>
        withTempFixtureDir("frame-resolver", async (root) => {
          const probe = join(root, "ffprobe.cjs"),
            driver = join(root, "driver.mjs");
          await writeFile(probe, await readFile(join(import.meta.dir, "fixtures/probe.cjs")));
          await chmod(probe, 0o700);
          const bundle = await Bun.build({
            entrypoints: [join(import.meta.dir, "fixtures/driver.ts")],
            target: "node",
          });
          expect(bundle.success).toBe(true);
          await Bun.write(driver, bundle.outputs[0]!);
          const owned = startFixtureProcess({
            executable: "node",
            args: [driver, mode, root, probe],
            cwd: REPO_ROOT,
            env: { PATH: process.env.PATH },
            timeoutMs: 20000,
            graceMs: 500,
            cleanupMs: 4000,
            maxOutputBytes: 65536,
          });
          const result = await owned.completion;
          expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
          expect(result.ok, result.stderr).toBe(true);
          expect(JSON.parse(result.stdout)).toBeObject();
        }),
      25000,
    );
});
