import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameBatch } from "../src/cli/actions";
import {
  createCapturedRuntime,
  createTempFixtureDir,
  toRepoRelativePath,
} from "./helpers/cli-test-utils";
import {
  captureRenamePlanCsvSnapshot,
  cleanupRenamePlanCsvSinceSnapshot,
  removeIfPresent,
} from "./helpers/cli-action-test-utils";

let renamePlanCsvSnapshot = new Set<string>();

beforeEach(async () => {
  renamePlanCsvSnapshot = await captureRenamePlanCsvSnapshot();
});

afterEach(async () => {
  await cleanupRenamePlanCsvSinceSnapshot(renamePlanCsvSnapshot);
});

describe("cli action modules: rename batch codex auto", () => {
  for (const scenario of [
    {
      label: "image-only input to the image analyzer",
      fixtureDirName: "rename-codex-auto-images",
      prefix: "img",
      fileName: "cover.png",
      fileContents: "fakepng",
      expectedImageCalls: 1,
      expectedDocCalls: 0,
      expectedSummary: "Codex image titles: 1/1 image file(s) suggested",
      expectedSlug: "cover-photo",
    },
    {
      label: "docs-only input to the document analyzer",
      fixtureDirName: "rename-codex-auto-docs",
      prefix: "doc",
      fileName: "notes.md",
      fileContents: "# Project Plan\n\nDraft.\n",
      expectedImageCalls: 0,
      expectedDocCalls: 1,
      expectedSummary: "Codex doc titles: 1/1 document file(s) suggested",
      expectedSlug: "project-plan",
    },
  ] as const) {
    test(`actionRenameBatch codex auto routes ${scenario.label}`, async () => {
      const fixtureDir = await createTempFixtureDir("actions");
      let planCsvPath: string | undefined;
      try {
        const { runtime, stdout, stderr } = createCapturedRuntime();
        const dirPath = join(fixtureDir, scenario.fixtureDirName);
        await mkdir(dirPath, { recursive: true });

        await writeFile(join(dirPath, scenario.fileName), scenario.fileContents, "utf8");

        let imageCalls = 0;
        let docCalls = 0;
        const result = await actionRenameBatch(runtime, {
          directory: toRepoRelativePath(dirPath),
          prefix: scenario.prefix,
          dryRun: true,
          codex: true,
          codexImagesTitleSuggester: async (options) => {
            imageCalls += 1;
            return {
              suggestions: options.imagePaths.map((path) => ({ path, title: "cover photo" })),
            };
          },
          codexDocsTitleSuggester: async (options) => {
            docCalls += 1;
            return {
              suggestions: options.documentPaths.map((path) => ({ path, title: "project plan" })),
            };
          },
        });
        planCsvPath = result.planCsvPath;

        expect(stderr.text).toBe("");
        expect(result.totalCount).toBe(1);
        expect(imageCalls).toBe(scenario.expectedImageCalls);
        expect(docCalls).toBe(scenario.expectedDocCalls);
        expect(stdout.text).toContain(scenario.expectedSummary);
        expect(stdout.text).toContain(scenario.expectedSlug);
      } finally {
        await removeIfPresent(planCsvPath);
        await rm(fixtureDir, { recursive: true, force: true });
      }
    });
  }

  test("actionRenameBatch codex auto can combine image and document analyzers in one run", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-auto-mixed");
      await mkdir(dirPath, { recursive: true });

      const imagePath = join(dirPath, "cover.png");
      const docPath = join(dirPath, "notes.md");
      await writeFile(imagePath, "fakepng", "utf8");
      await writeFile(docPath, "# Project Plan\n\nDraft.\n", "utf8");

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "asset",
        dryRun: true,
        codex: true,
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

  test("actionRenameBatch explicit analyzer flags override codex auto", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-auto-override");
      await mkdir(dirPath, { recursive: true });

      const imagePath = join(dirPath, "cover.png");
      const docPath = join(dirPath, "notes.md");
      await writeFile(imagePath, "fakepng", "utf8");
      await writeFile(docPath, "# Project Plan\n\nDraft.\n", "utf8");

      let imageCalls = 0;
      let docCalls = 0;
      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "asset",
        dryRun: true,
        codex: true,
        codexImages: true,
        codexImagesTitleSuggester: async (options) => {
          imageCalls += 1;
          return {
            suggestions: options.imagePaths.map((path) => ({ path, title: "cover photo" })),
          };
        },
        codexDocsTitleSuggester: async () => {
          docCalls += 1;
          return { suggestions: [] };
        },
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(2);
      expect(imageCalls).toBe(1);
      expect(docCalls).toBe(0);
      expect(stdout.text).toContain("Codex image titles: 1/1 image file(s) suggested");
      expect(stdout.text).not.toContain("Codex doc titles:");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch codex auto keeps unsupported-only files deterministic", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-auto-unsupported");
      await mkdir(dirPath, { recursive: true });

      const mediaPath = join(dirPath, "clip.mp4");
      await writeFile(mediaPath, "fakevideo", "utf8");

      let imageCalls = 0;
      let docCalls = 0;
      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "media",
        dryRun: true,
        codex: true,
        codexImagesTitleSuggester: async () => {
          imageCalls += 1;
          return { suggestions: [] };
        },
        codexDocsTitleSuggester: async () => {
          docCalls += 1;
          return { suggestions: [] };
        },
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(imageCalls).toBe(0);
      expect(docCalls).toBe(0);
      expect(stdout.text).toContain(
        "Codex note: no supported Codex analyzer inputs are in scope; deterministic rename is used.",
      );
      expect(stdout.text).toContain("clip.mp4 -> media-");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
