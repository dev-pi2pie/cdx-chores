import { expect, test } from "bun:test";
import { join } from "node:path";
import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

for (const scenario of [
  "boundaries",
  "resize",
  "cadence",
  "count-information",
  "destination-information",
  "custom-destinations-inline",
  "custom-destinations-simple",
  "naming-information",
  "retained-filename-inline",
  "retained-filename-simple",
  "direct",
  "naming",
  "settings",
])
  test(
    "Node frames menus preserve " + scenario + " and release input ownership",
    () =>
      withTempFixtureDir("frames-menus", async (root) => {
        const driver = await Bun.build({
          entrypoints: [join(import.meta.dir, "fixtures/frames-menu-navigation.ts")],
          target: "node",
          packages: "external",
        });
        expect(driver.success).toBe(true);
        const driverPath = join(root, "menus.mjs");
        await Bun.write(driverPath, driver.outputs[0]!);
        const owned = startFixtureProcess({
          executable: "node",
          args: [driverPath, scenario],
          cwd: REPO_ROOT,
          // The controlled streams represent a capable editable terminal.
          env: { PATH: process.env.PATH, TERM: "xterm-256color" },
          timeoutMs: 12_000,
          graceMs: 500,
          cleanupMs: 4_000,
          maxOutputBytes: 65_536,
        });
        const result = await owned.completion;
        expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
        expect(result.ok, result.stderr).toBe(true);
        expect(JSON.parse(result.stdout)).toEqual({ scenario, passed: true });
      }),
    16_000,
  );
