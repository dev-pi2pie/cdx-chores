import { expect, test } from "bun:test";
import { join } from "node:path";
import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";
for (const mode of [
  "normal",
  "fallback",
  "overwrite",
  "overwrite-failure",
  "source-alias",
  "target-kind",
  "late-collision",
  "link-collision",
  "partial",
  "limit",
  "copy-cancel",
  "copy-close",
  "cleanup-failure",
  "overwrite-source-alias",
  "slow",
  "byte-backpressure",
  "foreign-staging",
  "closure-unconfirmed",
  "stage-close",
  "disk-full",
  "fallback-collision",
  "direct-source",
  "overwrite-direct-source",
  "parent-replaced",
  "overwrite-unrelated-hardlink",
])
  test(
    `image publication ${mode}`,
    () =>
      withTempFixtureDir("image-publication", async (root) => {
        const bundle = await Bun.build({
          entrypoints: [join(import.meta.dir, "fixtures/publication-driver.ts")],
          target: "node",
        });
        expect(bundle.success).toBe(true);
        const driver = join(root, "driver.mjs");
        await Bun.write(driver, bundle.outputs[0]!);
        const owned = startFixtureProcess({
          executable: "node",
          args: [driver, mode, root],
          cwd: REPO_ROOT,
          env: { PATH: process.env.PATH },
          timeoutMs: 10000,
          graceMs: 500,
          cleanupMs: 4000,
          maxOutputBytes: 65536,
        });
        const result = await owned.completion;
        expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
        expect(result.ok, result.stderr).toBe(true);
        expect(JSON.parse(result.stdout)).toBeObject();
      }),
    15000,
  );
