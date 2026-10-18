import assert from "node:assert/strict";
import { expect } from "bun:test";
import { join } from "node:path";
import { startFixtureProcess } from "../../../../scripts/testing/fixtures/fixture-process";
import { removeFixtureDir } from "../../../../scripts/testing/fixtures/fixture-exports";
import { createTempFixtureDir, REPO_ROOT } from "../../../helpers/cli-test-utils";

export async function runFrameMenuFixture(
  entry: "frames-menu-navigation.ts" | "frames-menu-byte-input.ts",
  scenario: string,
  method = "raw",
): Promise<unknown> {
  const deadline = performance.now() + 20_000;
  const root = await createTempFixtureDir("frames-menus");
  let removable = true;
  const errors: unknown[] = [];
  let value: unknown;
  try {
    const driver = await Bun.build({
      entrypoints: [join(import.meta.dir, entry)],
      target: "node",
      packages: "external",
    });
    expect(driver.success).toBe(true);
    const driverPath = join(root, "menus.mjs");
    await Bun.write(driverPath, driver.outputs[0]!);
    assert(
      deadline - performance.now() >= 18_000,
      "Insufficient time for menu driver execution, termination, and assertions",
    );
    removable = false;
    const owned = startFixtureProcess({
      executable: "node",
      args: [driverPath, scenario, method, root],
      cwd: REPO_ROOT,
      env: { PATH: process.env.PATH, TERM: "xterm-256color" },
      timeoutMs: 12_000,
      graceMs: 500,
      cleanupMs: 4_000,
      maxOutputBytes: 65_536,
    });
    const result = await owned.completion;
    removable = result.stopped;
    expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
    expect(result.ok, result.stderr).toBe(true);
    value = JSON.parse(result.stdout) as unknown;
  } catch (error) {
    errors.push(error);
  }
  if (removable) {
    try {
      await removeFixtureDir(root);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 1) throw new AggregateError(errors, "Menu fixture and cleanup failed");
  if (errors.length) throw errors[0];
  return value;
}
