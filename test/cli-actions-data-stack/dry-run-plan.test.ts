import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionDataStack } from "../../src/cli/actions";
import { readDataStackPlanArtifact } from "../../src/cli/data-stack/plan";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

describe("cli action modules: data stack dry-run plans", () => {
  test("actionDataStack writes a dry-run stack plan without materializing output", async () => {
    await withTempFixtureDir("data-stack-action-dry-run", async (fixtureDir) => {
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n1,paused\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        dryRun: true,
        onDuplicate: "report",
        output: "merged.csv",
        planOutput: "stack-plan.json",
        sources: ["a.csv"],
        uniqueBy: ["id"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Dry run: wrote stack plan stack-plan.json");
      expect(stderr.text).toContain("Duplicate key conflicts: 1");
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();
      const plan = await readDataStackPlanArtifact(planPath);
      expect(plan.duplicates).toEqual({
        duplicateKeyConflicts: 1,
        exactDuplicateRows: 0,
        policy: "report",
        uniqueBy: ["id"],
      });
      expect(plan.output.path).toBe(outputPath);
      expect(plan.diagnostics.schemaNameCount).toBe(2);
    });
  });

  test("actionDataStack generates a default dry-run plan path", async () => {
    await withTempFixtureDir("data-stack-action-dry-run-generated", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n", "utf8");

      const { runtime, stderr } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-04-25T12:00:00.000Z"),
      });
      await actionDataStack(runtime, {
        dryRun: true,
        output: "merged.csv",
        sources: ["a.csv"],
      });

      expect(stderr.text).toMatch(
        /Dry run: wrote stack plan data-stack-plan-20260425T120000Z-[0-9a-f]{8}\.json/,
      );
    });
  });

  test("actionDataStack rejects dry-run plan output matching an input file", async () => {
    await withTempFixtureDir("data-stack-action-plan-input-collision", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      await writeFile(sourcePath, "id,status\n1,active\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            dryRun: true,
            output: "merged.csv",
            overwrite: true,
            planOutput: "a.csv",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--plan-output cannot be the same path as an input source",
        },
      );
      expectNoOutput();
      expect(await readFile(sourcePath, "utf8")).toBe("id,status\n1,active\n");
    });
  });

  test("actionDataStack rejects Codex report output matching an input file", async () => {
    await withTempFixtureDir("data-stack-action-report-input-collision", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      await writeFile(sourcePath, "id,status\n1,active\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            codexAssist: true,
            codexReportOutput: "a.csv",
            codexRunner: async () => JSON.stringify({ recommendations: [] }),
            dryRun: true,
            output: "merged.csv",
            overwrite: true,
            planOutput: "stack-plan.json",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-report-output cannot be the same path as an input source",
        },
      );
      expectNoOutput();
      expect(await readFile(sourcePath, "utf8")).toBe("id,status\n1,active\n");
      await expect(readFile(planPath, "utf8")).rejects.toThrow();
    });
  });

  test("actionDataStack rejects matching plan and Codex report output paths", async () => {
    await withTempFixtureDir("data-stack-action-codex-report-collision", async (fixtureDir) => {
      const planPath = join(fixtureDir, "stack-plan.json");
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            codexAssist: true,
            codexReportOutput: "nested/../stack-plan.json",
            codexRunner: async () =>
              JSON.stringify({
                recommendations: [
                  {
                    confidence: 0.92,
                    id: "rec_unique_id",
                    patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
                    reasoning_summary: "id is complete and unique in the deterministic facts.",
                    title: "Use id as unique key",
                  },
                ],
              }),
            dryRun: true,
            output: "merged.csv",
            overwrite: true,
            planOutput: "stack-plan.json",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-report-output cannot be the same path as --plan-output",
        },
      );
      expectNoOutput();
      await expect(readFile(planPath, "utf8")).rejects.toThrow();
    });
  });

  test("actionDataStack rejects custom plan output matching stack output", async () => {
    await withTempFixtureDir("data-stack-action-plan-output-collision", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            dryRun: true,
            output: "merged.csv",
            overwrite: true,
            planOutput: "./merged.csv",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--plan-output cannot be the same path as --output",
        },
      );
      expectNoOutput();
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();
    });
  });

  test("actionDataStack rejects custom Codex report output matching stack output", async () => {
    await withTempFixtureDir("data-stack-action-report-output-collision", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "merged.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            codexAssist: true,
            codexReportOutput: "subdir/../merged.csv",
            dryRun: true,
            output: "merged.csv",
            overwrite: true,
            planOutput: "stack-plan.json",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-report-output cannot be the same path as --output",
        },
      );
      expectNoOutput();
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();
      await expect(readFile(planPath, "utf8")).rejects.toThrow();
    });
  });
});
