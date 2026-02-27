import { describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameBatch } from "../src/cli/actions";
import { createCapturedRuntime, createTempFixtureDir, REPO_ROOT, toRepoRelativePath } from "./helpers/cli-test-utils";
import { removeIfPresent } from "./helpers/cli-action-test-utils";

describe("cli action modules: rename batch codex images", () => {
  test("actionRenameBatch codex mode shows progress and fallback messaging when Codex returns an error", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-fallback");
      await mkdir(dirPath, { recursive: true });

      const imagePath = join(dirPath, "a.png");
      await writeFile(imagePath, "fakepng", "utf8");
      const fixedTime = new Date("2026-02-25T03:04:05.000Z");
      await utimes(imagePath, fixedTime, fixedTime);

      const relativeDir = toRepoRelativePath(dirPath);
      const result = await actionRenameBatch(runtime, {
        directory: relativeDir,
        prefix: "img",
        dryRun: true,
        codexImages: true,
        codexImagesTitleSuggester: async () => ({
          suggestions: [],
          errorMessage: "Codex unavailable in test",
        }),
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(result.changedCount).toBe(1);
      expect(stdout.text).toContain("Codex: analyzing 1 image file(s)...");
      expect(stdout.text).toContain("Codex image titles: 0/1 image file(s) suggested (fallback used for others)");
      expect(stdout.text).toContain("Codex note: Codex unavailable in test");
      expect(stdout.text).toContain("- a.png -> img-");
      expect(stdout.text).toContain("Dry run only. No files were renamed.");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch can combine codex image and codex doc analyzers in one run", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-mixed");
      await mkdir(dirPath, { recursive: true });

      const imagePath = join(dirPath, "cover.png");
      const docPath = join(dirPath, "notes.md");
      await writeFile(imagePath, "fakepng", "utf8");
      await writeFile(docPath, "# Project Plan\n\nDraft.\n", "utf8");

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "asset",
        dryRun: true,
        codexImages: true,
        codexDocs: true,
        codexImagesTitleSuggester: async (options) => ({
          suggestions: options.imagePaths.map((path) => ({ path, title: "cover photo" })),
        }),
        codexDocsTitleSuggester: async (options) => ({
          suggestions: options.documentPaths.map((path) => ({ path, title: "project plan" })),
        }),
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(2);
      expect(stdout.text).toContain("Codex image titles: 1/1 image file(s) suggested");
      expect(stdout.text).toContain("Codex doc titles: 1/1 document file(s) suggested");
      expect(stdout.text).toContain("cover-photo");
      expect(stdout.text).toContain("project-plan");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch forwards Codex tuning options to the suggester", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-options");
      await mkdir(dirPath, { recursive: true });

      const imageA = join(dirPath, "a.png");
      const imageB = join(dirPath, "b.png");
      await writeFile(imageA, "fakepng", "utf8");
      await writeFile(imageB, "fakepng", "utf8");

      const calls: Array<{
        imagePaths: string[];
        workingDirectory: string;
        timeoutMs?: number;
        retries?: number;
        batchSize?: number;
      }> = [];

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        dryRun: true,
        codexImages: true,
        codexImagesTimeoutMs: 12345,
        codexImagesRetries: 2,
        codexImagesBatchSize: 1,
        codexImagesTitleSuggester: async (options) => {
          calls.push(options);
          return { suggestions: [] };
        },
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(calls).toHaveLength(1);
      expect(calls[0]?.workingDirectory).toBe(REPO_ROOT);
      expect(calls[0]?.timeoutMs).toBe(12345);
      expect(calls[0]?.retries).toBe(2);
      expect(calls[0]?.batchSize).toBe(1);
      expect(calls[0]?.imagePaths).toHaveLength(2);
      expect(stdout.text).toContain("Codex image titles:");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch skips Codex assist for non-static or oversized images but still renames them", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-skip-ineligible");
      await mkdir(dirPath, { recursive: true });

      const gifPath = join(dirPath, "animated.gif");
      const largePngPath = join(dirPath, "large.png");
      const okPngPath = join(dirPath, "ok.png");

      await writeFile(gifPath, "fakegif", "utf8");
      await writeFile(largePngPath, Buffer.alloc(21 * 1024 * 1024));
      await writeFile(okPngPath, "fakepng", "utf8");

      const calls: Array<{ imagePaths: string[] }> = [];
      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "img",
        dryRun: true,
        codexImages: true,
        codexImagesTitleSuggester: async (options) => {
          calls.push({ imagePaths: options.imagePaths });
          return {
            suggestions: options.imagePaths.map((path) => ({ path, title: "only eligible image" })),
          };
        },
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(3);
      expect(result.changedCount).toBe(3);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.imagePaths).toHaveLength(1);
      expect(calls[0]?.imagePaths[0]?.endsWith("/ok.png")).toBe(true);
      expect(stdout.text).toContain("Codex image titles: 1/3 image file(s) suggested");
      expect(stdout.text).toContain("- animated.gif -> img-");
      expect(stdout.text).toContain("- large.png -> img-");
      expect(stdout.text).toContain("- ok.png -> img-");
      const csvText = await readFile(planCsvPath!, "utf8");
      expect(csvText).toContain("codex_skipped_non_static");
      expect(csvText).toContain("codex_skipped_too_large");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
