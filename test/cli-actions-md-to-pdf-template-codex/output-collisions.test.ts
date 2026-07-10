import { describe, test } from "bun:test";
import { link, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
  planMdPdfTemplateCodexOutput,
} from "../../src/cli/markdown-pdf/template-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng } from "./fixtures";

describe("cli action modules: md pdf-template codex output collisions", () => {
  test("rejects explicit report path collisions with input files", async () => {
    await withTempFixtureDir("md-pdf-template-codex-report-collision", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.json");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        input: toRepoRelativePath(inputPath),
        codexReportOutput: toRepoRelativePath(inputPath),
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      await expectCliError(() => planMdPdfTemplateCodexOutput({ runtime, state, signals }), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "--codex-report-output cannot be the same path as Markdown input",
      });
    });
  });

  test("rejects cover asset source and target collisions", async () => {
    await withTempFixtureDir("md-pdf-template-codex-asset-collision", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-template");
      const assetPath = join(outputPath, "assets", "cover.png");
      await mkdir(join(outputPath, "assets"), { recursive: true });
      await writeFile(assetPath, minimalPng(1200, 800));

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        coverImage: toRepoRelativePath(assetPath),
        output: toRepoRelativePath(outputPath),
        overwrite: true,
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      await expectCliError(() => planMdPdfTemplateCodexOutput({ runtime, state, signals }), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "planned asset assets/cover.png cannot be the same path as --cover-image",
      });
    });
  });

  test("rejects generated recipe file collisions with source files", async () => {
    await withTempFixtureDir(
      "md-pdf-template-codex-recipe-source-collision",
      async (fixtureDir) => {
        const outputPath = join(fixtureDir, "pdf-template");
        const baseProfilePath = join(fixtureDir, "profile.yml");
        const plannedStylePath = join(outputPath, "style.css");
        await mkdir(outputPath, { recursive: true });
        await writeFile(baseProfilePath, "page:\n  size: Letter\n", "utf8");
        await link(baseProfilePath, plannedStylePath);

        const { runtime } = createActionTestRuntime();
        const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
          baseProfile: toRepoRelativePath(baseProfilePath),
          output: toRepoRelativePath(outputPath),
          overwrite: true,
        });
        const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

        await expectCliError(() => planMdPdfTemplateCodexOutput({ runtime, state, signals }), {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "planned style.css cannot be the same file as --base-profile",
        });
      },
    );
  });
});
