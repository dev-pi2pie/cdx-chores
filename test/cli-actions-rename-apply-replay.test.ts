import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameApply, actionRenameBatch } from "../src/cli/actions";
import {
  captureRenamePlanCsvSnapshot,
  cleanupRenamePlanCsvSinceSnapshot,
  removeIfPresent,
} from "./helpers/cli-action-test-utils";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  REPO_ROOT,
  toRepoRelativePath,
} from "./helpers/cli-test-utils";

let renamePlanCsvSnapshot = new Set<string>();

beforeEach(async () => {
  renamePlanCsvSnapshot = await captureRenamePlanCsvSnapshot();
});

afterEach(async () => {
  await cleanupRenamePlanCsvSinceSnapshot(renamePlanCsvSnapshot);
});

describe("cli action modules: rename apply replay", () => {
  test("actionRenameBatch dry-run writes a replayable CSV plan under cwd", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-plan-csv");
      await mkdir(dirPath, { recursive: true });

      const filePath = join(dirPath, "sample image.png");
      await writeFile(filePath, "fake", "utf8");
      const fixedTime = new Date("2026-02-25T10:11:12.000Z");
      await utimes(filePath, fixedTime, fixedTime);

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "img",
        dryRun: true,
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(planCsvPath).toBeDefined();
      expect(planCsvPath?.startsWith(REPO_ROOT)).toBe(true);
      expect(planCsvPath).toMatch(/rename-plan-\d{8}T\d{6}Z-[a-f0-9]{8}\.csv$/);

      const csvText = await readFile(planCsvPath!, "utf8");
      expect(csvText).toContain(
        "old_name,new_name,cleaned_stem,ai_new_name,ai_provider,ai_model,changed_at,old_path,new_path,plan_id,planned_at,applied_at,status,reason,timestamp_tz",
      );
      expect(csvText).toContain("sample image.png");
      expect(csvText).toContain(",planned,");
      expect(stdout.text).toContain(`Plan CSV: ${toRepoRelativePath(planCsvPath!)}`);
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply replays the dry-run CSV snapshot exactly", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-replay");
      await mkdir(dirPath, { recursive: true });

      const originalPath = join(dirPath, "zeta image.png");
      await writeFile(originalPath, "fake", "utf8");
      const fixedTime = new Date("2026-02-25T01:02:03.000Z");
      await utimes(originalPath, fixedTime, fixedTime);

      const dryRunResult = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "img",
        dryRun: true,
      });
      planCsvPath = dryRunResult.planCsvPath;
      expect(planCsvPath).toBeDefined();

      const planBeforeApply = await readFile(planCsvPath!, "utf8");
      const rowLine = planBeforeApply.split("\n").find((line) => line.includes("zeta image.png")) ?? "";
      expect(rowLine).not.toBe("");
      const csvCells = rowLine.split(",");
      const newName = csvCells[1] ?? "";
      expect(newName).toMatch(/^img-\d{8}-\d{6}-zeta-image\.png$/);

      const changedTime = new Date("2026-02-25T23:59:59.000Z");
      await utimes(originalPath, changedTime, changedTime);

      const applyResult = await actionRenameApply(runtime, { csv: planCsvPath! });

      expect(stderr.text).toBe("");
      expect(applyResult.appliedCount).toBe(1);
      expect(stdout.text).toContain(`Plan CSV: ${toRepoRelativePath(planCsvPath!)}`);
      expect(stdout.text).toContain("Rows applied: 1");

      const entries = await readdir(dirPath);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toBe(newName);

      const planAfterApply = await readFile(planCsvPath!, "utf8");
      expect(planAfterApply).toContain(",applied,");
      expect(planAfterApply).not.toContain(",planned,");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply can auto-clean the plan CSV after successful apply", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-replay-autoclean");
      await mkdir(dirPath, { recursive: true });

      const originalPath = join(dirPath, "alpha image.png");
      await writeFile(originalPath, "fake", "utf8");
      const fixedTime = new Date("2026-02-25T04:05:06.000Z");
      await utimes(originalPath, fixedTime, fixedTime);

      const dryRunResult = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "img",
        dryRun: true,
      });
      planCsvPath = dryRunResult.planCsvPath;
      expect(planCsvPath).toBeDefined();

      stdout.text = "";
      const applyResult = await actionRenameApply(runtime, { csv: planCsvPath!, autoClean: true });

      expect(stderr.text).toBe("");
      expect(applyResult.appliedCount).toBe(1);
      expect(stdout.text).toContain("Rows applied: 1");
      expect(stdout.text).toContain("Plan CSV auto-cleaned.");
      expect(await stat(planCsvPath!).catch(() => null)).toBeNull();
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
