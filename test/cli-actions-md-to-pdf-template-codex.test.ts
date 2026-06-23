import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdPdfTemplateCodex } from "../src/cli/actions/markdown";
import { normalizeMdPdfTemplateCodexCommandState } from "../src/cli/markdown-pdf";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: md pdf-template codex", () => {
  test("normalizes inputs, hints, report output, and recipe flags", async () => {
    await withTempFixtureDir("md-pdf-template-codex-options", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const baseProfilePath = join(fixtureDir, "profile.yml");
      const coverImagePath = join(fixtureDir, "cover.png");
      const outputPath = join(fixtureDir, "pdf-template");
      const reportPath = join(fixtureDir, "template-codex-report.json");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(baseProfilePath, "page:\n  size: Letter\n", "utf8");
      await writeFile(coverImagePath, "not really an image yet\n", "utf8");

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "  client report  ",
        fontHint: ["  Inter  ", " ", "Noto Sans CJK"],
        baseProfile: toRepoRelativePath(baseProfilePath),
        coverImage: toRepoRelativePath(coverImagePath),
        output: toRepoRelativePath(outputPath),
        codexReportOutput: toRepoRelativePath(reportPath),
        preset: "report",
        pageSize: "Letter",
        toc: true,
        tocDepth: 2,
        overwrite: true,
      });

      expect(state.inputPath).toBe(inputPath);
      expect(state.intent).toBe("client report");
      expect(state.fontHints).toEqual(["Inter", "Noto Sans CJK"]);
      expect(state.baseProfilePath).toBe(baseProfilePath);
      expect(state.coverImagePath).toBe(coverImagePath);
      expect(state.outputPath).toBe(outputPath);
      expect(state.codexReportOutputPath).toBe(reportPath);
      expect(state.keepCodexReport).toBe(true);
      expect(state.overwrite).toBe(true);
      expect(state.recipeOptions.preset).toBe("report");
      expect(state.recipeOptions.pageSize).toBe("Letter");
      expect(state.recipeOptions.toc).toBe(true);
      expect(state.recipeOptions.tocDepth).toBe(2);
    });
  });

  test("allows positional input and --input when they resolve to the same file", async () => {
    await withTempFixtureDir("md-pdf-template-codex-same-input", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        positionalInput: toRepoRelativePath(inputPath),
        input: toRepoRelativePath(inputPath),
      });

      expect(state.inputPath).toBe(inputPath);
    });
  });

  test("rejects invalid base profiles during early validation", async () => {
    await withTempFixtureDir("md-pdf-template-codex-invalid-profile", async (fixtureDir) => {
      const baseProfilePath = join(fixtureDir, "profile.yml");
      await writeFile(baseProfilePath, "unknown: true\n", "utf8");

      const { runtime } = createActionTestRuntime();
      await expectCliError(
        () =>
          normalizeMdPdfTemplateCodexCommandState(runtime, {
            baseProfile: toRepoRelativePath(baseProfilePath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Unknown Markdown PDF profile key",
        },
      );
    });
  });

  test("rejects unsupported cover image formats during early validation", async () => {
    await withTempFixtureDir("md-pdf-template-codex-invalid-cover", async (fixtureDir) => {
      const coverImagePath = join(fixtureDir, "cover.gif");
      await writeFile(coverImagePath, "gif\n", "utf8");

      const { runtime } = createActionTestRuntime();
      await expectCliError(
        () =>
          normalizeMdPdfTemplateCodexCommandState(runtime, {
            coverImage: toRepoRelativePath(coverImagePath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Cover image must be a local PNG, JPEG, or WebP file.",
        },
      );
    });
  });

  test("validates command state before the Phase 2 boundary", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-boundary", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime();
      await expectCliError(
        () =>
          actionMdPdfTemplateCodex(runtime, {
            input: toRepoRelativePath(inputPath),
            intent: "dense report",
          }),
        {
          code: "NOT_IMPLEMENTED",
          exitCode: 1,
          messageIncludes: "signal collection begins in Phase 2",
        },
      );
    });
  });
});
