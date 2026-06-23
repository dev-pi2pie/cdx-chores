import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdPdfTemplateCodex } from "../../src/cli/actions/markdown";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { pathExists } from "./fixtures";

describe("cli action modules: md pdf-template codex action", () => {
  test("rejects low-signal runs before output planning without writing artifacts", async () => {
    await withTempFixtureDir("md-pdf-template-codex-low-signal", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "template-output");
      const reportPath = join(fixtureDir, "template-report.json");
      const { runtime, stdout } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdPdfTemplateCodex(runtime, {
            intent: "   ",
            output: toRepoRelativePath(outputPath),
            codexReportOutput: toRepoRelativePath(reportPath),
          }),
        {
          code: "LOW_SIGNAL",
          exitCode: 2,
          messageIncludes: "Not enough signal",
        },
      );

      expect(stdout.text).toBe("");
      expect(await pathExists(outputPath)).toBe(false);
      expect(await pathExists(reportPath)).toBe(false);
    });
  });

  test("synthesizes deterministic output before the write-bundle boundary", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-boundary", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime, stdout } = createActionTestRuntime();
      await expectCliError(
        () =>
          actionMdPdfTemplateCodex(runtime, {
            input: toRepoRelativePath(inputPath),
            intent: "dense report",
          }),
        {
          code: "NOT_IMPLEMENTED",
          exitCode: 1,
          messageIncludes: "bundle writing begins in Phase 6",
        },
      );
      expect(stdout.text).toContain("Signal mode: codex-assisted");
      expect(stdout.text).toContain("Template family: document-layered");
      expect(stdout.text).toContain("Recipe preset: article (renderer-default)");
      expect(stdout.text).toContain("Template bundle: md-pdf-template-");
      expect(stdout.text).toContain("Template HTML: template.html");
      expect(stdout.text).toContain("Stylesheet: style.css");
      expect(stdout.text).toContain("Managed assets: 0");
    });
  });

  test("prints deterministic synthesis summary for dry runs without writing artifacts", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-dry-run", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "template-output");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime, stdout } = createActionTestRuntime();

      await actionMdPdfTemplateCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "dense report",
        output: toRepoRelativePath(outputPath),
        dryRun: true,
      });

      expect(stdout.text).toContain("Signal mode: codex-assisted");
      expect(stdout.text).toContain("Template family: document-layered");
      expect(stdout.text).toContain("Recipe preset: article (renderer-default)");
      expect(stdout.text).toContain("Dry run only. No template bundle files were written.");
      expect(await pathExists(outputPath)).toBe(false);
    });
  });
});
