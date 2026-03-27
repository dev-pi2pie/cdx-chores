import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameApply } from "../src/cli/actions";
import { readRenamePlanCsv } from "../src/cli/rename-plan-csv";
import {
  captureRenamePlanCsvSnapshot,
  cleanupRenamePlanCsvSinceSnapshot,
  expectCliError,
} from "./helpers/cli-action-test-utils";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  toRepoRelativePath,
} from "./helpers/cli-test-utils";
import {
  createRenamePlanCsvText,
  createRenamePlanRow,
  RENAME_PLAN_HEADERS,
} from "./helpers/rename-apply-test-utils";

let renamePlanCsvSnapshot = new Set<string>();

beforeEach(async () => {
  renamePlanCsvSnapshot = await captureRenamePlanCsvSnapshot();
});

afterEach(async () => {
  await cleanupRenamePlanCsvSinceSnapshot(renamePlanCsvSnapshot);
});

describe("cli action modules: rename apply validation", () => {
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

      await expectCliError(() => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }), {
        code: "INVALID_RENAME_PLAN",
        exitCode: 2,
        messageIncludes: "missing required column: status",
      });
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

      await expectCliError(() => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }), {
        code: "INVALID_RENAME_PLAN",
        exitCode: 2,
        messageIncludes: "row 2 missing required field: status",
      });
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

      await expectCliError(() => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }), {
        code: "INVALID_RENAME_PLAN",
        exitCode: 2,
        messageIncludes: "row 2 missing required field: plan_id",
      });
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

      await expectCliError(() => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }), {
        code: "INVALID_RENAME_PLAN",
        exitCode: 2,
        messageIncludes: "row 2 missing required field: planned_at",
      });
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

      await expectCliError(() => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }), {
        code: "INVALID_RENAME_PLAN",
        exitCode: 2,
        messageIncludes: "Invalid rename plan status 'queued'",
      });
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

      await expectCliError(() => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }), {
        code: "INVALID_RENAME_PLAN",
        exitCode: 2,
        messageIncludes: "duplicate executable old_path",
      });

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

      await expectCliError(() => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }), {
        code: "INVALID_RENAME_PLAN",
        exitCode: 2,
        messageIncludes: "duplicate executable new_path",
      });

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

      await expectCliError(() => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }), {
        code: "INVALID_RENAME_PLAN",
        exitCode: 2,
        messageIncludes: "old_path escaped current working directory",
      });
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
          createRenamePlanRow(
            toRepoRelativePath(sourcePath),
            toRepoRelativePath(join(fixtureDir, "beta.txt")),
          ),
          createRenamePlanRow(toRepoRelativePath(skippedPath), toRepoRelativePath(skippedPath), {
            status: "skipped",
            reason: "unchanged",
            plan_id: "plan-2",
          }),
        ]),
        "utf8",
      );

      await expectCliError(() => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }), {
        code: "INVALID_RENAME_PLAN",
        exitCode: 2,
        messageIncludes: "inconsistent plan_id",
      });

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
          createRenamePlanRow(
            toRepoRelativePath(sourcePath),
            toRepoRelativePath(join(fixtureDir, "beta.txt")),
          ),
          createRenamePlanRow(toRepoRelativePath(skippedPath), toRepoRelativePath(skippedPath), {
            status: "skipped",
            reason: "unchanged",
            planned_at: "2026-02-26T00:00:00.000Z",
          }),
        ]),
        "utf8",
      );

      await expectCliError(() => actionRenameApply(runtime, { csv: toRepoRelativePath(csvPath) }), {
        code: "INVALID_RENAME_PLAN",
        exitCode: 2,
        messageIncludes: "inconsistent planned_at",
      });

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
