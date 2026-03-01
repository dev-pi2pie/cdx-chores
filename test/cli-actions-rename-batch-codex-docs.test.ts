import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionRenameBatch } from "../src/cli/actions";
import { createCapturedRuntime, createTempFixtureDir, toRepoRelativePath } from "./helpers/cli-test-utils";
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

describe("cli action modules: rename batch codex docs", () => {
  test("actionRenameBatch codex-docs mode records weak-title docx fallback reason when experimental gate is enabled", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    const previousDocxGate = process.env.CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL;
    process.env.CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL = "1";
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-batch-codex-docx-weak");
      await mkdir(dirPath, { recursive: true });

      const docPath = join(dirPath, "weak.docx");
      await writeFile(docPath, "not-a-real-docx-but-gated-integration-test", "utf8");

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "doc",
        dryRun: true,
        codexDocs: true,
        codexDocsTitleSuggester: async (options) => ({
          suggestions: [],
          reasons: options.documentPaths.map((path) => ({ path, reason: "docx_no_title_signal" })),
        }),
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(1);
      expect(stdout.text).toContain("Codex: analyzing 1 document file(s)...");
      expect(stdout.text).toContain("Codex doc titles: 0/1 document file(s) suggested");
      expect(stdout.text).not.toContain("experimental and currently disabled");

      const csvText = await readFile(planCsvPath!, "utf8");
      expect(csvText).toContain("docx_no_title_signal");
    } finally {
      if (previousDocxGate === undefined) {
        delete process.env.CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL;
      } else {
        process.env.CDX_CHORES_CODEX_DOCS_DOCX_EXPERIMENTAL = previousDocxGate;
      }
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  for (const scenario of [
    {
      label: "records doc-specific fallback reasons for text files",
      fixtureDirName: "rename-codex-docs-fallback",
      fileName: "notes.txt",
      fileContents: "...\n",
      setMtime: true,
      reason: "doc_no_title_signal",
    },
    {
      label: "records pdf-specific fallback reasons",
      fixtureDirName: "rename-codex-docs-pdf-fallback",
      fileName: "empty.pdf",
      fileContents: "fakepdf",
      setMtime: false,
      reason: "pdf_no_text",
    },
  ] as const) {
    test(`actionRenameBatch codex-docs mode ${scenario.label}`, async () => {
      const fixtureDir = await createTempFixtureDir("actions");
      let planCsvPath: string | undefined;
      try {
        const { runtime, stdout, stderr } = createCapturedRuntime();
        const dirPath = join(fixtureDir, scenario.fixtureDirName);
        await mkdir(dirPath, { recursive: true });

        const path = join(dirPath, scenario.fileName);
        await writeFile(path, scenario.fileContents, "utf8");
        if (scenario.setMtime) {
          const fixedTime = new Date("2026-02-25T03:04:05.000Z");
          await utimes(path, fixedTime, fixedTime);
        }

        const result = await actionRenameBatch(runtime, {
          directory: toRepoRelativePath(dirPath),
          prefix: "doc",
          dryRun: true,
          codexDocs: true,
          codexDocsTitleSuggester: async (options) => ({
            suggestions: [],
            reasons: options.documentPaths.map((path) => ({ path, reason: scenario.reason })),
          }),
        });
        planCsvPath = result.planCsvPath;

        expect(stderr.text).toBe("");
        expect(result.totalCount).toBe(1);
        expect(stdout.text).toContain("Codex doc titles: 0/1 document file(s) suggested");
        const csvText = await readFile(planCsvPath!, "utf8");
        expect(csvText).toContain(scenario.reason);
      } finally {
        await removeIfPresent(planCsvPath);
        await rm(fixtureDir, { recursive: true, force: true });
      }
    });
  }

  test("actionRenameBatch codex-docs mode supports json/yaml/toml/html/xml/pdf files", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-docs-textlike");
      await mkdir(dirPath, { recursive: true });

      await writeFile(join(dirPath, "meta.json"), '{ "title": "Release Plan", "author": "Ada" }\n', "utf8");
      await writeFile(join(dirPath, "guide.yaml"), 'title: "Ops Runbook"\nauthor: "Lin"\n', "utf8");
      await writeFile(join(dirPath, "site.toml"), 'title = "Landing Page"\n', "utf8");
      await writeFile(
        join(dirPath, "page.html"),
        "<html><head><title>Pricing Overview</title></head><body><h1>Pricing Overview</h1><p>Product tiers and add-ons.</p></body></html>\n",
        "utf8",
      );
      await writeFile(
        join(dirPath, "feed.xml"),
        '<?xml version="1.0"?><doc><title>Release Feed</title><summary>Build and deploy updates.</summary></doc>\n',
        "utf8",
      );
      await writeFile(join(dirPath, "sheet.pdf"), "fake-pdf-bytes", "utf8");

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        prefix: "doc",
        dryRun: true,
        codexDocs: true,
        codexDocsTitleSuggester: async (options) => ({
          suggestions: options.documentPaths.map((path) => ({ path, title: "semantic doc title" })),
        }),
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(6);
      expect(stdout.text).toContain("Codex doc titles: 6/6 document file(s) suggested");
      const csvText = await readFile(planCsvPath!, "utf8");
      expect(csvText).toContain("meta.json");
      expect(csvText).toContain("guide.yaml");
      expect(csvText).toContain("site.toml");
      expect(csvText).toContain("page.html");
      expect(csvText).toContain("feed.xml");
      expect(csvText).toContain("sheet.pdf");
      expect(csvText).toContain("semantic doc title");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  test("actionRenameBatch codex-docs mode works with docs profile scoping", async () => {
    const fixtureDir = await createTempFixtureDir("actions");
    let planCsvPath: string | undefined;
    try {
      const { runtime, stdout, stderr } = createCapturedRuntime();
      const dirPath = join(fixtureDir, "rename-codex-docs-profile");
      await mkdir(dirPath, { recursive: true });

      await writeFile(join(dirPath, "notes.md"), "# Release Notes\n\nSummary.\n", "utf8");
      await writeFile(join(dirPath, "meta.json"), '{ "title": "Deploy Checklist" }\n', "utf8");
      await writeFile(join(dirPath, "cover.png"), "fakepng", "utf8");

      const result = await actionRenameBatch(runtime, {
        directory: toRepoRelativePath(dirPath),
        profile: "docs",
        prefix: "doc",
        dryRun: true,
        codexDocs: true,
        codexDocsTitleSuggester: async (options) => ({
          suggestions: options.documentPaths.map((path) => ({ path, title: "doc semantic title" })),
        }),
      });
      planCsvPath = result.planCsvPath;

      expect(stderr.text).toBe("");
      expect(result.totalCount).toBe(2);
      expect(stdout.text).toContain("Codex doc titles: 2/2 document file(s) suggested");
      const csvText = await readFile(planCsvPath!, "utf8");
      expect(csvText).toContain("notes.md");
      expect(csvText).toContain("meta.json");
      expect(csvText).not.toContain("cover.png");
    } finally {
      await removeIfPresent(planCsvPath);
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
