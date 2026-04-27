import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  createDataStackCodexReportArtifact,
  serializeDataStackCodexReportArtifact,
} from "../../src/cli/data-stack/codex-report";
import { computeDataStackDiagnostics } from "../../src/cli/data-stack/diagnostics";
import {
  readDataStackPlanArtifact,
  serializeDataStackPlanArtifact,
} from "../../src/cli/data-stack/plan";
import { runCli, toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";

describe("CLI data stack command replay", () => {
  test("replays a dry-run stack plan", async () => {
    await withTempFixtureDir("data-stack-cli-replay", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(sourcePath, "id,status\n1,active\n2,paused\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);
      expect(dryRun.exitCode).toBe(0);

      const replay = runCli(["data", "stack", "replay", toRepoRelativePath(planPath)]);

      expect(replay.exitCode).toBe(0);
      expect(replay.stdout).toBe("");
      expect(replay.stderr).toContain(`Wrote CSV: ${toRepoRelativePath(outputPath)}`);
      expect(await readFile(outputPath, "utf8")).toBe("id,status\n1,active\n2,paused\n");
    });
  });

  test("replay supports output override and auto-clean", async () => {
    await withTempFixtureDir("data-stack-cli-replay-override", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const originalOutputPath = join(fixtureDir, "merged.csv");
      const overrideOutputPath = join(fixtureDir, "override.json");
      await writeFile(sourcePath, "id,status\n1,active\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(originalOutputPath),
        "--overwrite",
      ]);
      expect(dryRun.exitCode).toBe(0);

      const replay = runCli([
        "data",
        "stack",
        "replay",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(overrideOutputPath),
        "--auto-clean",
      ]);

      expect(replay.exitCode).toBe(0);
      expect(JSON.parse(await readFile(overrideOutputPath, "utf8"))).toEqual([
        { id: "1", status: "active" },
      ]);
      await expect(readFile(originalOutputPath, "utf8")).rejects.toThrow();
      await expect(readFile(planPath, "utf8")).rejects.toThrow();
    });
  });

  test("replay refuses to write output over its own plan artifact", async () => {
    await withTempFixtureDir("data-stack-cli-replay-self-overwrite", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(sourcePath, "id,status\n1,active\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
      ]);
      expect(dryRun.exitCode).toBe(0);

      const replay = runCli([
        "data",
        "stack",
        "replay",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(planPath),
      ]);

      expect(replay.exitCode).toBe(2);
      expect(replay.stderr).toContain("Replay output path cannot be the stack-plan record path");
      expect((await readDataStackPlanArtifact(planPath)).metadata.artifactType).toBe(
        "data-stack-plan",
      );
    });
  });

  test("replay rejects Codex advisory reports instead of treating them as stack plans", async () => {
    await withTempFixtureDir("data-stack-cli-replay-report", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const reportPath = join(fixtureDir, "codex-report.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(sourcePath, "id,status\n1,active\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
      ]);
      expect(dryRun.exitCode).toBe(0);

      const plan = await readDataStackPlanArtifact(planPath);
      const diagnostics = computeDataStackDiagnostics({
        header: plan.schema.includedNames,
        matchedFileCount: 1,
        rows: [["1", "active"]],
      });
      await writeFile(
        reportPath,
        serializeDataStackCodexReportArtifact(
          createDataStackCodexReportArtifact({
            diagnostics,
            now: new Date("2026-04-26T00:00:00.000Z"),
            plan,
            recommendations: [
              {
                confidence: 0.9,
                id: "rec_unique_id",
                patches: [{ op: "replace", path: "/duplicates/uniqueBy", value: ["id"] }],
                reasoningSummary: "id is complete and unique.",
                title: "Use id as unique key",
              },
            ],
            uid: "aaaabbbb",
          }),
        ),
        "utf8",
      );

      const replay = runCli(["data", "stack", "replay", toRepoRelativePath(reportPath)]);

      expect(replay.exitCode).toBe(2);
      expect(replay.stderr).toContain("Invalid data stack plan artifact");
    });
  });

  test("replay fails clearly when no output path is available", async () => {
    await withTempFixtureDir("data-stack-cli-replay-missing-output", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(sourcePath, "id,status\n1,active\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
      ]);
      expect(dryRun.exitCode).toBe(0);

      const plan = await readDataStackPlanArtifact(planPath);
      await writeFile(
        planPath,
        serializeDataStackPlanArtifact({
          ...plan,
          output: {
            ...plan.output,
            path: null,
          },
        }),
        "utf8",
      );

      const replay = runCli(["data", "stack", "replay", toRepoRelativePath(planPath)]);

      expect(replay.exitCode).toBe(2);
      expect(replay.stderr).toContain("Replay requires an output path");
    });
  });

  test("replay warns on fingerprint drift", async () => {
    await withTempFixtureDir("data-stack-cli-replay-drift", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(sourcePath, "id,status\n1,active\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--overwrite",
      ]);
      expect(dryRun.exitCode).toBe(0);
      await writeFile(sourcePath, "id,status\n1,active\n2,paused\n", "utf8");

      const replay = runCli(["data", "stack", "replay", toRepoRelativePath(planPath)]);

      expect(replay.exitCode).toBe(0);
      expect(replay.stderr).toContain("Warning: source fingerprint changed");
      expect(await readFile(outputPath, "utf8")).toBe("id,status\n1,active\n2,paused\n");
    });
  });

  test("replay enforces stored reject duplicate policy", async () => {
    await withTempFixtureDir("data-stack-cli-replay-duplicate-reject", async (fixtureDir) => {
      const sourcePath = join(fixtureDir, "a.csv");
      const planPath = join(fixtureDir, "stack-plan.json");
      const outputPath = join(fixtureDir, "merged.csv");
      await writeFile(sourcePath, "id,status\n1,active\n1,paused\n", "utf8");

      const dryRun = runCli([
        "data",
        "stack",
        toRepoRelativePath(sourcePath),
        "--dry-run",
        "--plan-output",
        toRepoRelativePath(planPath),
        "--output",
        toRepoRelativePath(outputPath),
        "--unique-by",
        "id",
        "--on-duplicate",
        "reject",
      ]);
      expect(dryRun.exitCode).toBe(0);

      const replay = runCli(["data", "stack", "replay", toRepoRelativePath(planPath)]);

      expect(replay.exitCode).toBe(2);
      expect(replay.stderr).toContain("Replay duplicate key conflicts found");
      await expect(readFile(outputPath, "utf8")).rejects.toThrow();
    });
  });
});
