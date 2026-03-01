import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { actionRenameApply, actionRenameBatch } from "../src/cli/actions";
import { readRenamePlanCsv } from "../src/cli/rename-plan-csv";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  REPO_ROOT,
  toRepoRelativePath,
} from "./helpers/cli-test-utils";
import {
  captureRenamePlanCsvSnapshot,
  cleanupRenamePlanCsvSinceSnapshot,
  expectCliError,
  removeIfPresent,
} from "./helpers/cli-action-test-utils";

let renamePlanCsvSnapshot = new Set<string>();

const RENAME_PLAN_HEADERS = [
  "old_name",
  "new_name",
  "cleaned_stem",
  "ai_new_name",
  "ai_provider",
  "ai_model",
  "changed_at",
  "old_path",
  "new_path",
  "plan_id",
  "planned_at",
  "applied_at",
  "status",
  "reason",
  "timestamp_tz",
] as const;

function createRenamePlanCsvText(headers: readonly string[], rows: Array<Record<string, string>>): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => row[header] ?? "").join(","));
  }
  return `${lines.join("\n")}\n`;
}

function createRenamePlanRow(
  oldPath: string,
  newPath: string,
  overrides: Partial<Record<(typeof RENAME_PLAN_HEADERS)[number], string>> = {},
): Record<string, string> {
  return {
    old_name: basename(oldPath),
    new_name: basename(newPath),
    cleaned_stem: "",
    ai_new_name: "",
    ai_provider: "",
    ai_model: "",
    changed_at: "",
    old_path: oldPath,
    new_path: newPath,
    plan_id: "plan-1",
    planned_at: "2026-02-25T00:00:00.000Z",
    applied_at: "",
    status: "planned",
    reason: "",
    timestamp_tz: "",
    ...overrides,
  };
}

beforeEach(async () => {
  renamePlanCsvSnapshot = await captureRenamePlanCsvSnapshot();
});

afterEach(async () => {
  await cleanupRenamePlanCsvSinceSnapshot(renamePlanCsvSnapshot);
});

describe("cli action modules: rename apply", () => {
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
      const rowLine =
        planBeforeApply.split("\n").find((line) => line.includes("zeta image.png")) ?? "";
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

  test("actionRenameApply rejects CSVs missing required replay columns", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-missing-status.csv");
    try {
      const { runtime } = createCapturedRuntime();
      const oldPath = toRepoRelativePath(join(fixtureDir, "alpha.txt"));
      const newPath = toRepoRelativePath(join(fixtureDir, "beta.txt"));
      const headers = RENAME_PLAN_HEADERS.filter((header) => header !== "status");

      await writeFile(
        csvPath,
        createRenamePlanCsvText(headers, [createRenamePlanRow(oldPath, newPath)]),
        "utf8",
      );

      await expectCliError(
        () => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }),
        {
          code: "INVALID_RENAME_PLAN",
          exitCode: 2,
          messageIncludes: "missing required column: status",
        },
      );
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply rejects rows with blank status instead of defaulting to planned", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-blank-status.csv");
    try {
      const { runtime } = createCapturedRuntime();
      const oldPath = toRepoRelativePath(join(fixtureDir, "alpha.txt"));
      const newPath = toRepoRelativePath(join(fixtureDir, "beta.txt"));

      await writeFile(
        csvPath,
        createRenamePlanCsvText(RENAME_PLAN_HEADERS, [
          createRenamePlanRow(oldPath, newPath, { status: "" }),
        ]),
        "utf8",
      );

      await expectCliError(
        () => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }),
        {
          code: "INVALID_RENAME_PLAN",
          exitCode: 2,
          messageIncludes: "row 2 missing required field: status",
        },
      );
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply rejects rows missing plan_id", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-missing-plan-id.csv");
    try {
      const { runtime } = createCapturedRuntime();
      const oldPath = toRepoRelativePath(join(fixtureDir, "alpha.txt"));
      const newPath = toRepoRelativePath(join(fixtureDir, "beta.txt"));

      await writeFile(
        csvPath,
        createRenamePlanCsvText(RENAME_PLAN_HEADERS, [
          createRenamePlanRow(oldPath, newPath, { plan_id: "" }),
        ]),
        "utf8",
      );

      await expectCliError(
        () => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }),
        {
          code: "INVALID_RENAME_PLAN",
          exitCode: 2,
          messageIncludes: "row 2 missing required field: plan_id",
        },
      );
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply rejects rows missing planned_at", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-missing-planned-at.csv");
    try {
      const { runtime } = createCapturedRuntime();
      const oldPath = toRepoRelativePath(join(fixtureDir, "alpha.txt"));
      const newPath = toRepoRelativePath(join(fixtureDir, "beta.txt"));

      await writeFile(
        csvPath,
        createRenamePlanCsvText(RENAME_PLAN_HEADERS, [
          createRenamePlanRow(oldPath, newPath, { planned_at: "" }),
        ]),
        "utf8",
      );

      await expectCliError(
        () => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }),
        {
          code: "INVALID_RENAME_PLAN",
          exitCode: 2,
          messageIncludes: "row 2 missing required field: planned_at",
        },
      );
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply rejects invalid status values", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-invalid-status.csv");
    try {
      const { runtime } = createCapturedRuntime();
      const oldPath = toRepoRelativePath(join(fixtureDir, "alpha.txt"));
      const newPath = toRepoRelativePath(join(fixtureDir, "beta.txt"));

      await writeFile(
        csvPath,
        createRenamePlanCsvText(RENAME_PLAN_HEADERS, [
          createRenamePlanRow(oldPath, newPath, { status: "queued" }),
        ]),
        "utf8",
      );

      await expectCliError(
        () => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }),
        {
          code: "INVALID_RENAME_PLAN",
          exitCode: 2,
          messageIncludes: "Invalid rename plan status 'queued'",
        },
      );
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply rejects duplicate executable source paths before any rename executes", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-duplicate-old-path.csv");
    const sourcePath = join(fixtureDir, "alpha.txt");
    const targetAPath = join(fixtureDir, "beta.txt");
    const targetBPath = join(fixtureDir, "gamma.txt");
    try {
      const { runtime } = createCapturedRuntime();
      await writeFile(sourcePath, "alpha", "utf8");

      await writeFile(
        csvPath,
        createRenamePlanCsvText(RENAME_PLAN_HEADERS, [
          createRenamePlanRow(toRepoRelativePath(sourcePath), toRepoRelativePath(targetAPath)),
          createRenamePlanRow(toRepoRelativePath(sourcePath), toRepoRelativePath(targetBPath)),
        ]),
        "utf8",
      );

      await expectCliError(
        () => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }),
        {
          code: "INVALID_RENAME_PLAN",
          exitCode: 2,
          messageIncludes: "duplicate executable old_path",
        },
      );

      expect(await stat(sourcePath).catch(() => null)).not.toBeNull();
      expect(await stat(targetAPath).catch(() => null)).toBeNull();
      expect(await stat(targetBPath).catch(() => null)).toBeNull();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply rejects duplicate executable target paths before any rename executes", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-duplicate-new-path.csv");
    const sourceAPath = join(fixtureDir, "alpha.txt");
    const sourceBPath = join(fixtureDir, "beta.txt");
    const targetPath = join(fixtureDir, "renamed.txt");
    try {
      const { runtime } = createCapturedRuntime();
      await writeFile(sourceAPath, "alpha", "utf8");
      await writeFile(sourceBPath, "beta", "utf8");

      await writeFile(
        csvPath,
        createRenamePlanCsvText(RENAME_PLAN_HEADERS, [
          createRenamePlanRow(toRepoRelativePath(sourceAPath), toRepoRelativePath(targetPath)),
          createRenamePlanRow(toRepoRelativePath(sourceBPath), toRepoRelativePath(targetPath)),
        ]),
        "utf8",
      );

      await expectCliError(
        () => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }),
        {
          code: "INVALID_RENAME_PLAN",
          exitCode: 2,
          messageIncludes: "duplicate executable new_path",
        },
      );

      expect(await stat(sourceAPath).catch(() => null)).not.toBeNull();
      expect(await stat(sourceBPath).catch(() => null)).not.toBeNull();
      expect(await stat(targetPath).catch(() => null)).toBeNull();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply rejects cwd-escaping executable paths", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-escape.csv");
    try {
      const { runtime } = createCapturedRuntime();
      const newPath = toRepoRelativePath(join(fixtureDir, "beta.txt"));

      await writeFile(
        csvPath,
        createRenamePlanCsvText(RENAME_PLAN_HEADERS, [
          createRenamePlanRow("../escape.txt", newPath),
        ]),
        "utf8",
      );

      await expectCliError(
        () => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }),
        {
          code: "INVALID_RENAME_PLAN",
          exitCode: 2,
          messageIncludes: "old_path escaped current working directory",
        },
      );
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply rejects mixed plan_id values across rows before execution", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-mixed-plan-id.csv");
    const sourcePath = join(fixtureDir, "alpha.txt");
    const skippedPath = join(fixtureDir, "skip.txt");
    try {
      const { runtime } = createCapturedRuntime();
      await writeFile(sourcePath, "alpha", "utf8");
      await writeFile(skippedPath, "skip", "utf8");

      await writeFile(
        csvPath,
        createRenamePlanCsvText(RENAME_PLAN_HEADERS, [
          createRenamePlanRow(toRepoRelativePath(sourcePath), toRepoRelativePath(join(fixtureDir, "beta.txt"))),
          createRenamePlanRow(toRepoRelativePath(skippedPath), toRepoRelativePath(skippedPath), {
            status: "skipped",
            reason: "unchanged",
            plan_id: "plan-2",
          }),
        ]),
        "utf8",
      );

      await expectCliError(
        () => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }),
        {
          code: "INVALID_RENAME_PLAN",
          exitCode: 2,
          messageIncludes: "inconsistent plan_id",
        },
      );

      expect(await stat(sourcePath).catch(() => null)).not.toBeNull();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply rejects mixed planned_at values across rows before execution", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-mixed-planned-at.csv");
    const sourcePath = join(fixtureDir, "alpha.txt");
    const skippedPath = join(fixtureDir, "skip.txt");
    try {
      const { runtime } = createCapturedRuntime();
      await writeFile(sourcePath, "alpha", "utf8");
      await writeFile(skippedPath, "skip", "utf8");

      await writeFile(
        csvPath,
        createRenamePlanCsvText(RENAME_PLAN_HEADERS, [
          createRenamePlanRow(toRepoRelativePath(sourcePath), toRepoRelativePath(join(fixtureDir, "beta.txt"))),
          createRenamePlanRow(toRepoRelativePath(skippedPath), toRepoRelativePath(skippedPath), {
            status: "skipped",
            reason: "unchanged",
            planned_at: "2026-02-26T00:00:00.000Z",
          }),
        ]),
        "utf8",
      );

      await expectCliError(
        () => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }),
        {
          code: "INVALID_RENAME_PLAN",
          exitCode: 2,
          messageIncludes: "inconsistent planned_at",
        },
      );

      expect(await stat(sourcePath).catch(() => null)).not.toBeNull();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameApply ignores additive columns and non-blocking basename metadata mismatches", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-additive-columns.csv");
    const sourcePath = join(fixtureDir, "alpha.txt");
    const targetPath = join(fixtureDir, "renamed.txt");
    try {
      const { runtime, stderr } = createCapturedRuntime();
      await writeFile(sourcePath, "alpha", "utf8");

      const headers = [...RENAME_PLAN_HEADERS, "future_note"];
      const row = {
        ...createRenamePlanRow(toRepoRelativePath(sourcePath), toRepoRelativePath(targetPath), {
          old_name: "mismatch-old.txt",
          new_name: "mismatch-new.txt",
        }),
        future_note: "ignored",
      };

      await writeFile(csvPath, createRenamePlanCsvText(headers, [row]), "utf8");

      const applyResult = await actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) });

      expect(stderr.text).toBe("");
      expect(applyResult.appliedCount).toBe(1);
      expect(await stat(sourcePath).catch(() => null)).toBeNull();
      expect(await stat(targetPath).catch(() => null)).not.toBeNull();
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("readRenamePlanCsv allows empty plan_id and planned_at for inspection reads while keeping status strict", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    const csvPath = join(fixtureDir, "rename-plan-read-lenient.csv");
    try {
      const { runtime } = createCapturedRuntime();
      const sourcePath = toRepoRelativePath(join(fixtureDir, "alpha.txt"));
      const targetPath = toRepoRelativePath(join(fixtureDir, "renamed.txt"));
      const headers = [...RENAME_PLAN_HEADERS, "future_note"];

      await writeFile(
        csvPath,
        createRenamePlanCsvText(headers, [
          {
            ...createRenamePlanRow(sourcePath, targetPath, {
              plan_id: "",
              planned_at: "",
              old_name: "mismatch-old.txt",
              new_name: "mismatch-new.txt",
            }),
            future_note: "ignored",
          },
        ]),
        "utf8",
      );

      const result = await readRenamePlanCsv(runtime, toRepoRelativePath(csvPath));

      expect(result.csvPath).toBe(csvPath);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        old_path: sourcePath,
        new_path: targetPath,
        plan_id: "",
        planned_at: "",
        status: "planned",
        old_name: "mismatch-old.txt",
        new_name: "mismatch-new.txt",
      });
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
