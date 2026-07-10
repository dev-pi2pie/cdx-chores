import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  collectMdPdfTemplateCodexSignals,
  createMdPdfTemplateCodexBundleId,
  normalizeMdPdfTemplateCodexCommandState,
  planMdPdfTemplateCodexOutput,
} from "../../src/cli/markdown-pdf/template-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng, pathExists } from "./fixtures";

describe("cli action modules: md pdf-template codex output paths", () => {
  test("generates readable template bundle IDs", () => {
    expect(
      createMdPdfTemplateCodexBundleId(new Date("2026-06-23T01:02:03.000Z"), 0, () => {
        return "md-pdf-template-20260623T010203Z-fixed001";
      }),
    ).toBe("md-pdf-template-20260623T010203Z-fixed001");
    expect(createMdPdfTemplateCodexBundleId(new Date("2026-06-23T01:02:03.000Z"), 0)).toMatch(
      /^md-pdf-template-20260623T010203Z-[0-9a-f]{8}$/,
    );
  });

  test("plans generated output paths without input-derived bundle names", async () => {
    await withTempFixtureDir("md-pdf-template-codex-generated-output", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "README.md");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-23T01:02:03.000Z"),
      });
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        input: "README.md",
        keepCodexReport: true,
        templateBundleIdFactory: () => "md-pdf-template-20260623T010203Z-test0001",
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
      const plan = await planMdPdfTemplateCodexOutput({ runtime, state, signals });

      expect(plan).toMatchObject({
        bundleId: "md-pdf-template-20260623T010203Z-test0001",
        generatedOutputDirectory: true,
        outputDirectory: join(fixtureDir, "md-pdf-template-20260623T010203Z-test0001"),
        templateHtml: {
          bundlePath: "template.html",
          path: join(fixtureDir, "md-pdf-template-20260623T010203Z-test0001", "template.html"),
        },
        styleCss: {
          bundlePath: "style.css",
          path: join(fixtureDir, "md-pdf-template-20260623T010203Z-test0001", "style.css"),
        },
        report: {
          bundlePath: "template.codex-report.json",
          path: join(
            fixtureDir,
            "md-pdf-template-20260623T010203Z-test0001",
            "template.codex-report.json",
          ),
        },
      });
      expect(plan.outputDirectory).not.toContain("README");
      expect(plan.outputDirectory).not.toContain(".md");
      expect(plan.assets).toEqual([]);
      expect(await pathExists(plan.outputDirectory)).toBe(false);
    });
  });

  test("omits report targets by default", async () => {
    await withTempFixtureDir("md-pdf-template-codex-default-no-report", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        now: () => new Date("2026-06-23T01:02:03.000Z"),
      });
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        input: toRepoRelativePath(inputPath),
        templateBundleIdFactory: () => "md-pdf-template-20260623T010203Z-test0001",
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
      const plan = await planMdPdfTemplateCodexOutput({ runtime, state, signals });

      expect(plan.report).toBeUndefined();
      expect(plan.templateHtml.bundlePath).toBe("template.html");
      expect(plan.styleCss.bundlePath).toBe("style.css");
      expect(await pathExists(plan.outputDirectory)).toBe(false);
    });
  });

  test("plans explicit Codex report output as an external report target", async () => {
    await withTempFixtureDir("md-pdf-template-codex-external-report", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const reportPath = join(fixtureDir, "template-codex-report.json");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({
        now: () => new Date("2026-06-23T01:02:03.000Z"),
      });
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        input: toRepoRelativePath(inputPath),
        codexReportOutput: toRepoRelativePath(reportPath),
        templateBundleIdFactory: () => "md-pdf-template-20260623T010203Z-test0001",
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
      const plan = await planMdPdfTemplateCodexOutput({ runtime, state, signals });

      expect(plan.report).toEqual({
        location: "external",
        path: reportPath,
      });
      expect(plan.report && "bundlePath" in plan.report).toBe(false);
    });
  });

  test("retries generated output paths when the first bundle directory exists", async () => {
    await withTempFixtureDir("md-pdf-template-codex-output-retry", async (fixtureDir) => {
      const firstDirectory = join(fixtureDir, "md-pdf-template-20260623T010203Z-first001");
      await mkdir(firstDirectory, { recursive: true });

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-23T01:02:03.000Z"),
      });
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: "cover.png",
        templateBundleIdFactory: (_now, attempt) =>
          attempt === 0
            ? "md-pdf-template-20260623T010203Z-first001"
            : "md-pdf-template-20260623T010203Z-second02",
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
      const plan = await planMdPdfTemplateCodexOutput({ runtime, state, signals });

      expect(plan.bundleId).toBe("md-pdf-template-20260623T010203Z-second02");
      expect(plan.outputDirectory).toBe(
        join(fixtureDir, "md-pdf-template-20260623T010203Z-second02"),
      );
      expect(plan.assets).toEqual([
        {
          bundlePath: "assets/cover.png",
          path: join(
            fixtureDir,
            "md-pdf-template-20260623T010203Z-second02",
            "assets",
            "cover.png",
          ),
          role: "cover-image",
          sourceBasename: "cover.png",
          sourcePath: join(fixtureDir, "cover.png"),
        },
      ]);
    });
  });

  test("fails when generated output path retries are exhausted", async () => {
    await withTempFixtureDir("md-pdf-template-codex-output-retry-exhausted", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      const bundleIdForAttempt = (attempt: number) =>
        `md-pdf-template-20260623T010203Z-collide${String(attempt).padStart(2, "0")}`;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await mkdir(join(fixtureDir, bundleIdForAttempt(attempt)), { recursive: true });
      }

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-23T01:02:03.000Z"),
      });
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: "cover.png",
        templateBundleIdFactory: (_now, attempt) => bundleIdForAttempt(attempt),
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      await expectCliError(() => planMdPdfTemplateCodexOutput({ runtime, state, signals }), {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
        messageIncludes: "Unable to generate a non-colliding Markdown PDF template directory",
      });
    });
  });

  test("uses the final generated output path retry attempt when earlier attempts collide", async () => {
    await withTempFixtureDir("md-pdf-template-codex-output-final-retry", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "cover.png"), minimalPng(1200, 800));
      const bundleIdForAttempt = (attempt: number) =>
        `md-pdf-template-20260623T010203Z-retry${String(attempt).padStart(3, "0")}`;
      for (let attempt = 0; attempt < 9; attempt += 1) {
        await mkdir(join(fixtureDir, bundleIdForAttempt(attempt)), { recursive: true });
      }

      const { runtime } = createActionTestRuntime({
        cwd: fixtureDir,
        now: () => new Date("2026-06-23T01:02:03.000Z"),
      });
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: "cover.png",
        templateBundleIdFactory: (_now, attempt) => bundleIdForAttempt(attempt),
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
      const plan = await planMdPdfTemplateCodexOutput({ runtime, state, signals });

      expect(plan.bundleId).toBe(bundleIdForAttempt(9));
      expect(plan.outputDirectory).toBe(join(fixtureDir, bundleIdForAttempt(9)));
    });
  });

  test("sanitizes planned cover asset filenames", async () => {
    await withTempFixtureDir("md-pdf-template-codex-asset-sanitize", async (fixtureDir) => {
      const coverImagePath = join(fixtureDir, "Cover Image @ 2026 !!.png");
      const outputPath = join(fixtureDir, "pdf-template");
      await writeFile(coverImagePath, minimalPng(1200, 800));

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: toRepoRelativePath(coverImagePath),
        output: toRepoRelativePath(outputPath),
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
      const plan = await planMdPdfTemplateCodexOutput({ runtime, state, signals });

      expect(plan.assets).toEqual([
        {
          bundlePath: "assets/Cover-Image-2026.png",
          path: join(outputPath, "assets", "Cover-Image-2026.png"),
          role: "cover-image",
          sourceBasename: "Cover Image @ 2026 !!.png",
          sourcePath: coverImagePath,
        },
      ]);
    });
  });

  test("falls back and truncates sanitized cover asset filenames", async () => {
    await withTempFixtureDir("md-pdf-template-codex-asset-sanitize-edges", async (fixtureDir) => {
      const punctuationPath = join(fixtureDir, "!!!.png");
      const longStem = "a".repeat(90);
      const longPath = join(fixtureDir, `${longStem}.png`);
      await writeFile(punctuationPath, minimalPng(1200, 800));
      await writeFile(longPath, minimalPng(1200, 800));

      const { runtime } = createActionTestRuntime();
      const punctuationState = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: toRepoRelativePath(punctuationPath),
        output: toRepoRelativePath(join(fixtureDir, "punctuation-template")),
      });
      const longState = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: toRepoRelativePath(longPath),
        output: toRepoRelativePath(join(fixtureDir, "long-template")),
      });
      const [punctuationSignals, longSignals] = await Promise.all([
        collectMdPdfTemplateCodexSignals(runtime, punctuationState),
        collectMdPdfTemplateCodexSignals(runtime, longState),
      ]);
      const [punctuationPlan, longPlan] = await Promise.all([
        planMdPdfTemplateCodexOutput({
          runtime,
          state: punctuationState,
          signals: punctuationSignals,
        }),
        planMdPdfTemplateCodexOutput({ runtime, state: longState, signals: longSignals }),
      ]);

      expect(punctuationPlan.assets[0]?.bundlePath).toBe("assets/cover.png");
      expect(longPlan.assets[0]?.bundlePath).toBe(`assets/${"a".repeat(80)}.png`);
    });
  });
});
