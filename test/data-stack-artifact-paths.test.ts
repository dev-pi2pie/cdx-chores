import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { resolveDataStackDryRunArtifactPaths } from "../src/cli/data-stack/artifact-paths";
import { CliError } from "../src/cli/errors";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { withTempFixtureDir } from "./helpers/cli-test-utils";

function expectCliError(run: () => unknown, messageIncludes: string): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).message).toContain(messageIncludes);
    return;
  }
  throw new Error("Expected CliError.");
}

describe("data stack dry-run artifact paths", () => {
  test("rejects custom paths that resolve to the stack output path", async () => {
    await withTempFixtureDir("data-stack-artifact-path-output", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });

      expectCliError(
        () =>
          resolveDataStackDryRunArtifactPaths({
            outputPath: join(fixtureDir, "merged.csv"),
            planOutput: "nested/../merged.csv",
            runtime,
          }),
        "--plan-output cannot be the same path as --output",
      );
    });
  });

  test("falls back when a generated plan path resolves to the stack output path", async () => {
    await withTempFixtureDir("data-stack-artifact-path-plan-fallback", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const generatedPlanNames = ["merged.csv", "fallback-plan.json"];

      const paths = resolveDataStackDryRunArtifactPaths({
        generators: {
          plan: () => generatedPlanNames.shift() ?? "unexpected-plan.json",
        },
        outputPath: join(fixtureDir, "merged.csv"),
        runtime,
      });

      expect(paths.planPath).toBe(join(fixtureDir, "fallback-plan.json"));
    });
  });

  test("falls back when generated plan and report paths collide", async () => {
    await withTempFixtureDir("data-stack-artifact-path-generated-fallback", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const generatedReportNames = ["stack-artifact.json", "codex-report.json"];

      const paths = resolveDataStackDryRunArtifactPaths({
        codexAssist: true,
        generators: {
          plan: () => "stack-artifact.json",
          codexReport: () => generatedReportNames.shift() ?? "unexpected-report.json",
        },
        outputPath: join(fixtureDir, "merged.csv"),
        runtime,
      });

      expect(paths.planPath).toBe(join(fixtureDir, "stack-artifact.json"));
      expect(paths.codexReportPath).toBe(join(fixtureDir, "codex-report.json"));
    });
  });
});
