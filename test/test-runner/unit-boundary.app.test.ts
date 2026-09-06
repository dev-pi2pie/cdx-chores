import { expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { startOwnedProcess } from "../../scripts/testing/execution/process.ts";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

test.each([
  ["Bun.spawnSync", 'Bun.spawnSync(["must-not-launch"]);'],
  [
    "child_process.spawnSync",
    'const {spawnSync} = await import("node:child_process"); spawnSync("must-not-launch");',
  ],
  ["@duckdb/node-api", 'await import("@duckdb/node-api");'],
  ["fetch", 'await fetch("https://example.invalid");'],
])("unit-boundary verification rejects a caught %s probe", async (operation, source) => {
  await withTempFixtureDir("unit-boundary", async (root) => {
    await writeFile(
      join(root, "example.unit.test.ts"),
      `import {test, expect} from "bun:test";
test("controlled inputs", () => expect(1).toBe(1));
test("caught probe", async () => { try { ${source} } catch {} });\n`,
    );
    const result = await startOwnedProcess({
      executable: process.execPath,
      args: [
        "test",
        "--preload",
        join(REPO_ROOT, "test/helpers/unit-boundary-preload.ts"),
        "./example.unit.test.ts",
      ],
      cwd: root,
      env: { PATH: "", HOME: root },
      timeoutMs: 2500,
      graceMs: 250,
      cleanupMs: 1500,
    }).completion;
    expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(operation.startsWith("@duckdb/") ? "@duckdb/" : operation);
    expect(result.stderr).toContain("Unit selection must not probe");
  });
});
