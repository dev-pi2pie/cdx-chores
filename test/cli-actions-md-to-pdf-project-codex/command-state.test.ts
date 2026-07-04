import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { normalizeMdPdfProjectCodexCommandState } from "../../src/cli/markdown-pdf/project-codex";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

describe("cli action modules: md pdf-project codex command state", () => {
  test("normalizes project command options without collecting signals", async () => {
    await withTempFixtureDir("md-pdf-project-codex-options", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        baseProfile: "base.yml",
        codexReportOutput: "project-report.json",
        coverImage: "cover.png",
        dryRun: true,
        fontHint: ["  ", " prefer Noto Serif CJK TC "],
        input: "report.md",
        intent: "  client report with cover  ",
        output: "pdf-project",
        overwrite: true,
      });

      expect(state).toEqual({
        baseProfilePath: join(fixtureDir, "base.yml"),
        codexReportOutputPath: join(fixtureDir, "project-report.json"),
        coverImagePath: join(fixtureDir, "cover.png"),
        dryRun: true,
        fontHints: ["prefer Noto Serif CJK TC"],
        inputPath: join(fixtureDir, "report.md"),
        intent: "client report with cover",
        keepCodexReport: true,
        outputDirectory: join(fixtureDir, "pdf-project"),
        overwrite: true,
      });
    });
  });

  test("allows positional and explicit input paths that resolve to the same file", async () => {
    await withTempFixtureDir("md-pdf-project-codex-same-input", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "report.md"), "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      const state = await normalizeMdPdfProjectCodexCommandState(runtime, {
        input: "./report.md",
        positionalInput: "report.md",
      });

      expect(state.inputPath).toBe(join(fixtureDir, "report.md"));
    });
  });

  test("rejects conflicting positional and explicit inputs", async () => {
    await withTempFixtureDir("md-pdf-project-codex-conflicting-inputs", async (fixtureDir) => {
      await writeFile(join(fixtureDir, "one.md"), "# One\n", "utf8");
      await writeFile(join(fixtureDir, "two.md"), "# Two\n", "utf8");

      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          normalizeMdPdfProjectCodexCommandState(runtime, {
            input: "two.md",
            positionalInput: "one.md",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "Positional input and --input",
        },
      );
    });
  });

  test("rejects non-json explicit report paths", async () => {
    await withTempFixtureDir("md-pdf-project-codex-report-path", async (fixtureDir) => {
      const { runtime } = createActionTestRuntime({ cwd: fixtureDir });
      await expectCliError(
        () =>
          normalizeMdPdfProjectCodexCommandState(runtime, {
            codexReportOutput: "project-report.yml",
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "report path must end with .json",
        },
      );
    });
  });
});
