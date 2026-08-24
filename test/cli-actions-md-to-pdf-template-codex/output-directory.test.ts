import { describe, expect, test } from "bun:test";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  collectMdPdfTemplateCodexSignals,
  normalizeMdPdfTemplateCodexCommandState,
  planMdPdfTemplateCodexOutput,
} from "../../src/cli/markdown-pdf/template-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { pathExists } from "../markdown-pdf/support/path-fixtures";

describe("cli action modules: md pdf-template codex output directory", () => {
  test("rejects explicit non-empty output directories without overwrite", async () => {
    await withTempFixtureDir("md-pdf-template-codex-nonempty-output", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-template");
      await mkdir(outputPath, { recursive: true });
      await writeFile(join(outputPath, "unrelated.txt"), "keep me\n", "utf8");

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        output: toRepoRelativePath(outputPath),
        toc: true,
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      await expectCliError(() => planMdPdfTemplateCodexOutput({ runtime, state, signals }), {
        code: "OUTPUT_EXISTS",
        exitCode: 2,
        messageIncludes: "Template output directory is not empty",
      });
    });
  });

  test("rejects symlink output directories", async () => {
    await withTempFixtureDir("md-pdf-template-codex-output-symlink", async (fixtureDir) => {
      const realOutputPath = join(fixtureDir, "real-output");
      const outputPath = join(fixtureDir, "pdf-template");
      await mkdir(realOutputPath, { recursive: true });
      await symlink(realOutputPath, outputPath);

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        output: toRepoRelativePath(outputPath),
        toc: true,
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);

      await expectCliError(() => planMdPdfTemplateCodexOutput({ runtime, state, signals }), {
        code: "OUTPUT_SYMLINK",
        exitCode: 2,
        messageIncludes: "Template output directory is a symlink",
      });
    });
  });

  test("allows overwrite planning without deleting unrelated files", async () => {
    await withTempFixtureDir("md-pdf-template-codex-overwrite-preserve", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-template");
      const unrelatedPath = join(outputPath, "unrelated.txt");
      await mkdir(outputPath, { recursive: true });
      await writeFile(unrelatedPath, "keep me\n", "utf8");

      const { runtime } = createActionTestRuntime();
      const state = await normalizeMdPdfTemplateCodexCommandState(runtime, {
        output: toRepoRelativePath(outputPath),
        toc: true,
        overwrite: true,
      });
      const signals = await collectMdPdfTemplateCodexSignals(runtime, state);
      const plan = await planMdPdfTemplateCodexOutput({ runtime, state, signals });

      expect(plan.outputDirectory).toBe(outputPath);
      expect(await pathExists(unrelatedPath)).toBe(true);
      expect(await pathExists(join(outputPath, "template.html"))).toBe(false);
    });
  });
});
