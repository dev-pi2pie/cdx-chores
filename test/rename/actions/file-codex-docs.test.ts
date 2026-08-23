import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameFile } from "../../../src/cli/actions";
import { createCapturedRuntime, REPO_ROOT, toRepoRelativePath } from "../../helpers/cli-test-utils";
import {
  captureRenamePlanCsvSnapshot,
  cleanupRenamePlanCsvSinceSnapshot,
} from "../support/plan-artifacts";
import { createRenameFileFixture, withRenameWorkspace } from "./file-support";

let renamePlanCsvSnapshot = new Set<string>();

beforeEach(async () => {
  renamePlanCsvSnapshot = await captureRenamePlanCsvSnapshot();
});

afterEach(async () => {
  await cleanupRenamePlanCsvSinceSnapshot(renamePlanCsvSnapshot);
});

describe("rename file Codex document actions", () => {
  test("actionRenameFile forwards the shared timeout and document tuning options", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stderr } = createCapturedRuntime();
      const { filePath: docPath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-codex-shared-timeout",
        "project notes.md",
        {
          content: "# Project Notes\n\nCurrent decisions.\n",
        },
      );

      const calls: Array<{
        timeoutMs?: number;
        retries?: number;
        batchSize?: number;
      }> = [];
      const result = await actionRenameFile(runtime, {
        path: toRepoRelativePath(docPath),
        dryRun: true,
        codex: true,
        codexTimeoutMs: 45_000,
        codexDocsRetries: 2,
        codexDocsBatchSize: 1,
        codexDocsTitleSuggester: async (options) => {
          calls.push({
            timeoutMs: options.timeoutMs,
            retries: options.retries,
            batchSize: options.batchSize,
          });
          return {
            suggestions: options.documentPaths.map((path) => ({
              path,
              title: "project notes",
            })),
          };
        },
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(calls).toEqual([{ timeoutMs: 45_000, retries: 2, batchSize: 1 }]);
    });
  });

  test("actionRenameFile codex-docs mode records docx extraction error for invalid docx input", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const { filePath: docPath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-codex-docx-error",
        "draft.docx",
        {
          content: "not-a-real-docx",
        },
      );

      const result = await actionRenameFile(runtime, {
        path: toRepoRelativePath(docPath),
        prefix: "doc",
        dryRun: true,
        codexDocs: true,
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(stdout.text).toContain("Codex: analyzing 1 document file(s)...");
      expect(stdout.text).toContain("Codex doc titles: 0/1 document file(s) suggested");

      const csvText = await readFile(result.planCsvPath!, "utf8");
      expect(csvText).toContain("docx_extract_error");
    });
  });

  test("actionRenameFile codex-docs mode can route a heading-rich docx fixture", async () => {
    await withRenameWorkspace(async (fixtureDir, trackPlanCsv) => {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const sourceFixture = join(REPO_ROOT, "test", "fixtures", "docs", "heading-rich.docx");
      const { filePath: docPath } = await createRenameFileFixture(
        fixtureDir,
        "rename-file-codex-docx-heading",
        "project-outline.docx",
        { sourceFixture },
      );

      const result = await actionRenameFile(runtime, {
        path: toRepoRelativePath(docPath),
        prefix: "doc",
        dryRun: true,
        codexDocs: true,
        codexDocsTitleSuggester: async (options) => ({
          suggestions: options.documentPaths.map((path) => ({
            path,
            title: "project goal outline",
          })),
        }),
      });
      trackPlanCsv(result.planCsvPath);

      expect(stderr.text).toBe("");
      expect(result.changed).toBe(true);
      expect(stdout.text).toContain("Codex: analyzing 1 document file(s)...");
      expect(stdout.text).toContain("Codex doc titles: 1/1 document file(s) suggested");
      expect(stdout.text).toContain("project-goal-outline");

      const csvText = await readFile(result.planCsvPath!, "utf8");
      expect(csvText).toContain("project goal outline");
    });
  });
});
