import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { actionDataStack } from "../../src/cli/actions";
import { readDataStackPlanArtifact } from "../../src/cli/data-stack/plan";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

describe("cli action modules: data stack Codex assist", () => {
  test("actionDataStack requires dry-run for Codex assist", async () => {
    await withTempFixtureDir("data-stack-action-codex-no-dry-run", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n", "utf8");

      const { runtime, expectNoOutput } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            codexAssist: true,
            output: "merged.csv",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-assist requires --dry-run",
        },
      );
      expectNoOutput();
    });
  });

  test("actionDataStack writes a Codex advisory report without applying recommendations", async () => {
    await withTempFixtureDir("data-stack-action-codex-report", async (fixtureDir) => {
      const planPath = join(fixtureDir, "stack-plan.json");
      const reportPath = join(fixtureDir, "codex-report.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n2,paused\n", "utf8");

      const { runtime, stderr, expectNoStdout } = createActionTestRuntime({ cwd: fixtureDir });
      await actionDataStack(runtime, {
        codexAssist: true,
        codexReportOutput: "codex-report.json",
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
        planOutput: "stack-plan.json",
        sources: ["a.csv"],
      });

      expectNoStdout();
      expect(stderr.text).toContain("Codex assist: wrote advisory report codex-report.json");
      expect(stderr.text).toContain("Codex recommendations were not applied.");
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();
      const plan = await readDataStackPlanArtifact(planPath);
      expect(plan.diagnostics.reportPath).toBe(reportPath);
      expect(plan.metadata.recommendationDecisions).toEqual([]);
      expect(plan.duplicates.uniqueBy).toEqual([]);
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        metadata: { planPayloadId: string };
        recommendations: Array<{ id: string }>;
      };
      expect(report.metadata.planPayloadId).toBe(plan.metadata.payloadId);
      expect(report.recommendations.map((recommendation) => recommendation.id)).toEqual([
        "rec_unique_id",
      ]);
    });
  });

  test("actionDataStack surfaces malformed Codex assist responses", async () => {
    await withTempFixtureDir("data-stack-action-codex-malformed", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n", "utf8");

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            codexAssist: true,
            codexRunner: async () => "not json",
            dryRun: true,
            output: "merged.csv",
            planOutput: "stack-plan.json",
            sources: ["a.csv"],
          }),
        {
          code: "DATA_STACK_CODEX_FAILED",
          exitCode: 2,
          messageIncludes: "Codex stack assist failed",
        },
      );
    });
  });

  test("actionDataStack rejects schema-invalid Codex assist responses", async () => {
    await withTempFixtureDir("data-stack-action-codex-invalid-response", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n", "utf8");

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            codexAssist: true,
            codexRunner: async () => JSON.stringify({ recommendations: [{ id: "rec_bad" }] }),
            dryRun: true,
            output: "merged.csv",
            planOutput: "stack-plan.json",
            sources: ["a.csv"],
          }),
        {
          code: "DATA_STACK_CODEX_FAILED",
          exitCode: 2,
          messageIncludes: "recommendations[].patches must be a non-empty array",
        },
      );
    });
  });

  test("actionDataStack rejects invalid Codex recommendation patches", async () => {
    await withTempFixtureDir("data-stack-action-codex-invalid-patch", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "a.csv"), "id,status\n1,active\n", "utf8");

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          actionDataStack(runtime, {
            codexAssist: true,
            codexRunner: async () =>
              JSON.stringify({
                recommendations: [
                  {
                    confidence: 0.9,
                    id: "rec_missing",
                    patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["missing"] }],
                    reasoning_summary: "Missing is not an accepted schema name.",
                    title: "Use missing key",
                  },
                ],
              }),
            dryRun: true,
            output: "merged.csv",
            planOutput: "stack-plan.json",
            sources: ["a.csv"],
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "unknown schema names",
        },
      );
    });
  });
});
