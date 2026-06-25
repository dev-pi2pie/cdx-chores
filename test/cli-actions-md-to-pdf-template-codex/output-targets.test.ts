import { describe, test } from "bun:test";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
  planMdPdfTemplateCodexOutput,
} from "../../src/cli/markdown-pdf/template-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng } from "./fixtures";

describe("cli action modules: md pdf-template codex output targets", () => {
  test("rejects planned recipe file symlink targets", async () => {
    await withTempFixtureDir("md-pdf-template-codex-planned-symlink", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-template");
      const targetPath = join(fixtureDir, "target.html");
      await mkdir(outputPath, { recursive: true });
      await writeFile(targetPath, "target\n", "utf8");
      await symlink(targetPath, join(outputPath, "template.html"));

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        output: toRepoRelativePath(outputPath),
        toc: true,
        overwrite: true,
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      await expectCliError(() => planMdPdfTemplateCodexOutput({ runtime, state, signals }), {
        code: "OUTPUT_SYMLINK",
        exitCode: 2,
        messageIncludes: "planned template.html is a symlink",
      });
    });
  });

  test("rejects planned report and asset directory targets", async () => {
    await withTempFixtureDir("md-pdf-template-codex-planned-directories", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-template");
      const reportPath = join(fixtureDir, "template-report.json");
      const coverImagePath = join(fixtureDir, "cover.png");
      await mkdir(outputPath, { recursive: true });
      await mkdir(reportPath, { recursive: true });
      await mkdir(join(outputPath, "assets", "cover.png"), { recursive: true });
      await writeFile(coverImagePath, minimalPng(1200, 800));

      const { runtime } = createActionTestRuntime();
      const reportState = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        output: toRepoRelativePath(outputPath),
        codexReportOutput: toRepoRelativePath(reportPath),
        toc: true,
        overwrite: true,
      });
      const reportSignals = await collectMdPdfTemplateCodexSignals(runtime, reportState);
      await expectCliError(
        () => planMdPdfTemplateCodexOutput({ runtime, state: reportState, signals: reportSignals }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--codex-report-output is a directory",
        },
      );

      const assetState = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: toRepoRelativePath(coverImagePath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
      });
      const assetSignals = await collectMdPdfTemplateCodexSignals(runtime, assetState);
      await expectCliError(
        () => planMdPdfTemplateCodexOutput({ runtime, state: assetState, signals: assetSignals }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "planned asset assets/cover.png is a directory",
        },
      );
    });
  });

  test("rejects planned style directory and report or asset symlink targets", async () => {
    await withTempFixtureDir("md-pdf-template-codex-planned-symlinks", async (fixtureDir) => {
      const styleOutputPath = join(fixtureDir, "style-template");
      const assetOutputPath = join(fixtureDir, "asset-template");
      const reportPath = join(fixtureDir, "template-report.json");
      const reportTargetPath = join(fixtureDir, "report-target.json");
      const coverImagePath = join(fixtureDir, "cover.png");
      const assetTargetPath = join(fixtureDir, "asset-target.png");
      await mkdir(styleOutputPath, { recursive: true });
      await mkdir(assetOutputPath, { recursive: true });
      await mkdir(join(styleOutputPath, "style.css"), { recursive: true });
      await writeFile(reportTargetPath, "report\n", "utf8");
      await symlink(reportTargetPath, reportPath);
      await writeFile(coverImagePath, minimalPng(1200, 800));
      await writeFile(assetTargetPath, minimalPng(1200, 800));
      await mkdir(join(assetOutputPath, "assets"), { recursive: true });
      await symlink(assetTargetPath, join(assetOutputPath, "assets", "cover.png"));

      const { runtime } = createActionTestRuntime();
      const styleState = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        output: toRepoRelativePath(styleOutputPath),
        toc: true,
        overwrite: true,
      });
      const styleSignals = await collectMdPdfTemplateCodexSignals(runtime, styleState);
      await expectCliError(
        () => planMdPdfTemplateCodexOutput({ runtime, state: styleState, signals: styleSignals }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "planned style.css is a directory",
        },
      );

      const reportState = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        output: toRepoRelativePath(join(fixtureDir, "report-template")),
        codexReportOutput: toRepoRelativePath(reportPath),
        toc: true,
        overwrite: true,
      });
      const reportSignals = await collectMdPdfTemplateCodexSignals(runtime, reportState);
      await expectCliError(
        () => planMdPdfTemplateCodexOutput({ runtime, state: reportState, signals: reportSignals }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "--codex-report-output is a symlink",
        },
      );

      const assetState = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: toRepoRelativePath(coverImagePath),
        output: toRepoRelativePath(assetOutputPath),
        overwrite: true,
      });
      const assetSignals = await collectMdPdfTemplateCodexSignals(runtime, assetState);
      await expectCliError(
        () => planMdPdfTemplateCodexOutput({ runtime, state: assetState, signals: assetSignals }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "planned asset assets/cover.png is a symlink",
        },
      );
    });
  });
});
