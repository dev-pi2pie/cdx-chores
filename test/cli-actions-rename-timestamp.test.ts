import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameBatch, actionRenameFile } from "../src/cli/actions";
import { formatLocalFileDateTime } from "../src/utils/datetime";
import {
  captureRenamePlanCsvSnapshot,
  cleanupRenamePlanCsvSinceSnapshot,
  removeIfPresent,
} from "./helpers/cli-action-test-utils";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  toRepoRelativePath,
} from "./helpers/cli-test-utils";

let renamePlanCsvSnapshot = new Set<string>();

beforeEach(async () => {
  renamePlanCsvSnapshot = await captureRenamePlanCsvSnapshot();
});

afterEach(async () => {
  await cleanupRenamePlanCsvSinceSnapshot(renamePlanCsvSnapshot);
});

type RenameFixtureOptions = {
  content?: string;
  time?: Date;
};

async function withTimezone<T>(timezone: string, run: () => Promise<T>): Promise<T> {
  const previousTimezone = process.env.TZ;
  process.env.TZ = timezone;
  try {
    return await run();
  } finally {
    if (previousTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimezone;
    }
  }
}

async function withActionWorkspace(
  run: (fixtureDir: string, trackPlanCsv: (path: string | undefined) => void) => Promise<void>,
) {
  const fixtureDir = await createTempFixtureDir("actions");
  const planCsvPaths: string[] = [];
  try {
    await run(fixtureDir, (path) => {
      if (path) {
        planCsvPaths.push(path);
      }
    });
  } finally {
    for (const path of planCsvPaths) {
      await removeIfPresent(path);
    }
    await rm(fixtureDir, { recursive: true, force: true });
  }
}

async function createRenameFixture(
  fixtureDir: string,
  dirName: string,
  fileName: string,
  options: RenameFixtureOptions = {},
) {
  const dirPath = join(fixtureDir, dirName);
  const filePath = join(dirPath, fileName);
  await mkdir(dirPath, { recursive: true });
  await writeFile(filePath, options.content ?? "x", "utf8");
  const fixedTime = options.time ?? new Date("2026-03-01T15:00:00.000Z");
  await utimes(filePath, fixedTime, fixedTime);
  return { dirPath, filePath, fixedTime };
}

async function readPlanCsvLine(planCsvPath: string, sourceFileName: string): Promise<string> {
  const csvText = await readFile(planCsvPath, "utf8");
  const dataLine = csvText.split("\n").find((line) => line.includes(sourceFileName));
  expect(dataLine).toBeDefined();
  return dataLine!;
}

function expectTimestampTz(dataLine: string, expected: "" | "local" | "utc"): void {
  if (!expected) {
    expect(dataLine.endsWith(",")).toBe(true);
    return;
  }
  expect(dataLine).toContain(`,${expected}`);
}

describe("cli action modules: rename timestamp behavior", () => {
  describe("rename batch", () => {
    test("rewrites legacy {timestamp} to local time and records local metadata", async () => {
      await withTimezone("Asia/Taipei", async () => {
        await withActionWorkspace(async (fixtureDir, trackPlanCsv) => {
          const { dirPath, fixedTime } = await createRenameFixture(fixtureDir, "batch-legacy", "note.txt");
          const { runtime, stderr } = createCapturedRuntime();

          const result = await actionRenameBatch(runtime, {
            directory: toRepoRelativePath(dirPath),
            prefix: "doc",
            dryRun: true,
            timestampTimezone: "local",
          });
          trackPlanCsv(result.planCsvPath);

          expect(stderr.text).toBe("");
          expect(result.changedCount).toBe(1);

          const dataLine = await readPlanCsvLine(result.planCsvPath!, "note.txt");
          expectTimestampTz(dataLine, "local");

          const newName = dataLine.split(",")[1] ?? "";
          expect(newName).toBe(`doc-${formatLocalFileDateTime(fixedTime)}-note.txt`);
        });
      });
    });

    test("keeps explicit Route A placeholders authoritative even when an override is passed", async () => {
      await withActionWorkspace(async (fixtureDir, trackPlanCsv) => {
        const { dirPath } = await createRenameFixture(fixtureDir, "batch-explicit", "note.txt");
        const { runtime, stderr } = createCapturedRuntime();

        const localIso = await actionRenameBatch(runtime, {
          directory: toRepoRelativePath(dirPath),
          pattern: "{timestamp_local_iso}-{stem}",
          dryRun: true,
          timestampTimezone: "utc",
        });
        trackPlanCsv(localIso.planCsvPath);

        expect(stderr.text).toBe("");
        let dataLine = await readPlanCsvLine(localIso.planCsvPath!, "note.txt");
        expectTimestampTz(dataLine, "local");
        expect((dataLine.split(",")[1] ?? "").includes("Z")).toBe(false);

        const utc12h = await actionRenameBatch(runtime, {
          directory: toRepoRelativePath(dirPath),
          pattern: "{timestamp_utc_12h}-{stem}",
          dryRun: true,
        });
        trackPlanCsv(utc12h.planCsvPath);

        dataLine = await readPlanCsvLine(utc12h.planCsvPath!, "note.txt");
        expectTimestampTz(dataLine, "utc");
      });
    });

    test("leaves timestamp_tz empty for mixed or timestamp-free patterns", async () => {
      await withActionWorkspace(async (fixtureDir, trackPlanCsv) => {
        const { dirPath } = await createRenameFixture(fixtureDir, "batch-empty", "note.txt");
        const { runtime, stderr } = createCapturedRuntime();

        const mixed = await actionRenameBatch(runtime, {
          directory: toRepoRelativePath(dirPath),
          pattern: "{timestamp_local}-{timestamp_utc_iso}-{stem}",
          dryRun: true,
        });
        trackPlanCsv(mixed.planCsvPath);

        expect(stderr.text).toBe("");
        let dataLine = await readPlanCsvLine(mixed.planCsvPath!, "note.txt");
        expectTimestampTz(dataLine, "");

        const noTimestamp = await actionRenameBatch(runtime, {
          directory: toRepoRelativePath(dirPath),
          pattern: "{prefix}-{stem}",
          prefix: "raw",
          dryRun: true,
        });
        trackPlanCsv(noTimestamp.planCsvPath);

        dataLine = await readPlanCsvLine(noTimestamp.planCsvPath!, "note.txt");
        expectTimestampTz(dataLine, "");
        expect(dataLine.split(",")[1] ?? "").toBe("raw-note.txt");
      });
    });
  });

  describe("rename file", () => {
    test("rewrites spaced legacy placeholders before planning", async () => {
      await withTimezone("Asia/Taipei", async () => {
        await withActionWorkspace(async (fixtureDir, trackPlanCsv) => {
          const { filePath, fixedTime } = await createRenameFixture(fixtureDir, "file-spaced", "memo.txt");
          const { runtime, stderr } = createCapturedRuntime();

          const result = await actionRenameFile(runtime, {
            path: toRepoRelativePath(filePath),
            pattern: "{ prefix }-{ timestamp }-{ stem }",
            prefix: "doc",
            dryRun: true,
            timestampTimezone: "local",
          });
          trackPlanCsv(result.planCsvPath);

          expect(stderr.text).toBe("");

          const dataLine = await readPlanCsvLine(result.planCsvPath!, "memo.txt");
          expectTimestampTz(dataLine, "local");
          expect(dataLine.split(",")[1] ?? "").toBe(`doc-${formatLocalFileDateTime(fixedTime)}-memo.txt`);
        });
      });
    });

    test("derives metadata from explicit Route A placeholders and clears it for mixed patterns", async () => {
      await withActionWorkspace(async (fixtureDir, trackPlanCsv) => {
        const { filePath } = await createRenameFixture(fixtureDir, "file-explicit", "memo.txt");
        const { runtime, stderr } = createCapturedRuntime();

        const scenarios = [
          {
            pattern: "{timestamp_local_12h}-{stem}",
            expectedTimestampTz: "local" as const,
          },
          {
            pattern: "{timestamp_utc_iso}-{stem}",
            expectedTimestampTz: "utc" as const,
          },
          {
            pattern: "{timestamp_local}-{timestamp_utc}-{stem}",
            expectedTimestampTz: "" as const,
          },
        ];

        for (const scenario of scenarios) {
          const result = await actionRenameFile(runtime, {
            path: toRepoRelativePath(filePath),
            pattern: scenario.pattern,
            dryRun: true,
          });
          trackPlanCsv(result.planCsvPath);

          expect(stderr.text).toBe("");
          const dataLine = await readPlanCsvLine(result.planCsvPath!, "memo.txt");
          expectTimestampTz(dataLine, scenario.expectedTimestampTz);
        }
      });
    });

    test("preserves the effective timestamp basis when Codex replans the title", async () => {
      await withTimezone("Asia/Taipei", async () => {
        await withActionWorkspace(async (fixtureDir, trackPlanCsv) => {
          const { filePath, fixedTime } = await createRenameFixture(
            fixtureDir,
            "file-codex",
            "weekly notes.md",
            {
              content: "# Weekly Sync\n",
            },
          );
          const { runtime, stderr } = createCapturedRuntime();

          const result = await actionRenameFile(runtime, {
            path: toRepoRelativePath(filePath),
            pattern: "{timestamp}-{stem}",
            dryRun: true,
            timestampTimezone: "local",
            codexDocs: true,
            codexDocsTitleSuggester: async (options) => ({
              suggestions: options.documentPaths.map((path) => ({
                path,
                title: "weekly sync notes",
              })),
            }),
          });
          trackPlanCsv(result.planCsvPath);

          expect(stderr.text).toBe("");

          const dataLine = await readPlanCsvLine(result.planCsvPath!, "weekly notes.md");
          expectTimestampTz(dataLine, "local");
          expect(dataLine.split(",")[1] ?? "").toBe(
            `${formatLocalFileDateTime(fixedTime)}-weekly-sync-notes.md`,
          );
        });
      });
    });
  });
});
