import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionDataStack } from "../../src/cli/actions";
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

describe("cli action modules: data stack schema modes", () => {
  test("actionDataStack stacks union-by-name CSV inputs with explicit exclusions", async () => {
    await withTempFixtureDir("data-stack-action-union", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "parts");
      const outputPath = join(fixtureDir, "merged.csv");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "a.csv"), "id,name,noise\n1,Ada,drop-a\n", "utf8");
      await writeFile(join(sourceDir, "b.csv"), "id,status,noise\n2,active,drop-b\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        excludeColumns: ["noise"],
        output: "merged.csv",
        overwrite: true,
        sources: ["parts"],
        unionByName: true,
      });

      expectNoStdout();
      expect(stderr.text).toContain("Schema mode: union-by-name");
      expect(stderr.text).toContain("Columns: 3");
      expect(stderr.text).toContain("Excluded columns: 1 (noise)");
      expect(await readFile(outputPath, "utf8")).toBe("id,name,status\n1,Ada,\n2,,active\n");
    });
  });

  test("actionDataStack stacks union-by-name JSON arrays with first-seen key order", async () => {
    await withTempFixtureDir("data-stack-action-json-union", async (fixtureDir) => {
      const sourceDir = join(fixtureDir, "events");
      const outputPath = join(fixtureDir, "merged.json");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        join(sourceDir, "a.json"),
        JSON.stringify([{ id: "evt-001", actor: "ada" }]),
        "utf8",
      );
      await writeFile(
        join(sourceDir, "b.json"),
        JSON.stringify([{ id: "evt-002", action: "login" }]),
        "utf8",
      );

      const { runtime, expectNoStdout } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        output: "merged.json",
        overwrite: true,
        sources: ["events"],
        unionByName: true,
      });

      expectNoStdout();
      expect(await readFile(outputPath, "utf8")).toBe(
        '[{"id":"evt-001","actor":"ada","action":""},{"id":"evt-002","actor":"","action":"login"}]\n',
      );
    });
  });
});
