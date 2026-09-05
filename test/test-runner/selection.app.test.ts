import { describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { startOwnedProcess } from "../../scripts/testing/execution/process.ts";
import {
  assertUnitDiscoveryConfig,
  discoverSuites,
  exactTestArguments,
  inventoryTestFiles,
  selectTestFiles,
  SUITES,
  UNIT_IGNORE_PATTERNS,
} from "../../scripts/testing/suites/selection.ts";
import {
  assertReportedTestFiles,
  reportedTestFiles,
} from "../../scripts/testing/reports/report-files.ts";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

async function put(root: string, path: string, content: string): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
}

describe("filesystem and Bun suite discovery", () => {
  test("inventories without importing files and refreshes additions and deletions", async () => {
    await withTempFixtureDir("suite-inventory", async (root) => {
      const throwing = 'throw new Error("discovery must not import tests");';
      await put(root, "test/a.unit.test.ts", throwing);
      await put(root, "test/fixtures/input_test.cjs", throwing);
      await put(root, ".hidden/invisible.test.ts", throwing);
      await put(root, "node_modules/dependency/test.spec.js", throwing);
      expect(await inventoryTestFiles(root)).toEqual([
        "test/a.unit.test.ts",
        "test/fixtures/input_test.cjs",
      ]);
      expect((await discoverSuites(root)).suites.unit).toEqual(["test/a.unit.test.ts"]);
      await put(root, "test/b.app.test.ts", throwing);
      await rm(join(root, "test/a.unit.test.ts"));
      const next = await discoverSuites(root);
      expect(next.suites.unit).toEqual([]);
      expect(next.suites.app).toEqual(["test/b.app.test.ts"]);
      await put(root, "src/outside.spec.mts", throwing);
      await expect(discoverSuites(root)).rejects.toThrow("outside test/");
    });
  });

  test("proves unit defaults, exact integration overrides, and JUnit file agreement", async () => {
    await withTempFixtureDir("suite-discovery", async (root) => {
      const paths = [
        "test/.filename.unit.test.ts",
        "test/alpha/a.unit.test.ts",
        "test/beta/b.unit.test.ts",
        "test/alpha/c.app.test.ts",
        "test/live.codex.test.ts",
        "test/render.pandoc.test.ts",
      ];
      for (const path of paths) {
        await put(
          root,
          path,
          `import {test, expect} from "bun:test"; test(${JSON.stringify(path)}, () => expect(1).toBe(1));`,
        );
      }
      await put(
        root,
        "test/fixtures/input.test.ts",
        'throw new Error("fixture input was executed");',
      );
      const config = `[test]\nroot = "./test"\npathIgnorePatterns = ${JSON.stringify(UNIT_IGNORE_PATTERNS)}\n`;
      await put(root, "bunfig.toml", config);
      assertUnitDiscoveryConfig(Bun.TOML.parse(config));
      const { suites } = await discoverSuites(root);
      let invocation = 0;
      const run = async (args: string[], expected: string[], ok = true) => {
        const report = join(root, `report-${invocation++}.xml`);
        const result = await startOwnedProcess({
          executable: process.execPath,
          args: [...args, "--reporter=junit", `--reporter-outfile=${report}`],
          cwd: root,
          env: { PATH: process.env.PATH },
          timeoutMs: 2500,
          graceMs: 250,
          cleanupMs: 1500,
        }).completion;
        expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
        expect(result.ok, result.stderr).toBe(ok);
        if (ok) {
          const actual = reportedTestFiles(await readFile(report, "utf8"));
          assertReportedTestFiles(expected, actual);
        }
      };
      await run(["test"], suites.unit);
      await run(["test", "./test/alpha"], ["test/alpha/a.unit.test.ts"]);
      await run(["test", "./test/alpha/c.app.test.ts"], [], false);
      for (const suite of ["app", "codex", "pandoc"] as const) {
        const selection = selectTestFiles(suites, [suite]);
        await run(exactTestArguments(selection), selection);
      }
      const all = selectTestFiles(suites, SUITES);
      await run(exactTestArguments(all), all);
      // Removing the integration exclusions is observable config drift, not a unit pass.
      await put(
        root,
        "bunfig.toml",
        '[test]\nroot = "./test"\npathIgnorePatterns = ["**/fixtures/**"]\n',
      );
      expect(() =>
        assertUnitDiscoveryConfig(
          Bun.TOML.parse('[test]\nroot = "./test"\npathIgnorePatterns = ["**/fixtures/**"]\n'),
        ),
      ).toThrow("disagree");
      await run(["test"], all);
    });
  });
});
