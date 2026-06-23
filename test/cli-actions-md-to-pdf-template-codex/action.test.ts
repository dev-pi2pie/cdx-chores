import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
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

  test("writes validated deterministic template bundles during normal execution", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-write", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "template-output");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime, stderr, stdout } = createActionTestRuntime();
      await actionMdPdfTemplateCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "dense report",
        output: toRepoRelativePath(outputPath),
      });

      expect(stdout.text).toContain("Signal mode: codex-assisted");
      expect(stdout.text).toContain("Decision mode: deterministic");
      expect(stdout.text).toContain("Template family: document-layered");
      expect(stdout.text).toContain("Recipe preset: article (renderer-default)");
      expect(stdout.text).toContain("Template bundle: md-pdf-template-");
      expect(stdout.text).toContain("Template HTML: template.html");
      expect(stdout.text).toContain("Stylesheet: style.css");
      expect(stdout.text).toContain("Managed assets: 0");
      expect(stdout.text).toContain("Follow-up render: cdx-chores md to-pdf");
      expect(stderr.text).toContain("Wrote Markdown PDF template bundle:");
      expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(".cdx-code-line");
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
      expect(stdout.text).toContain("Decision mode: deterministic");
      expect(stdout.text).toContain("Template family: document-layered");
      expect(stdout.text).toContain("Recipe preset: article (renderer-default)");
      expect(stdout.text).toContain("Follow-up render: cdx-chores md to-pdf");
      expect(stdout.text).toContain("Dry run only. No template bundle files were written.");
      expect(await pathExists(outputPath)).toBe(false);
    });
  });

  test("writes only requested diagnostic reports during dry runs", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-dry-run-report", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "template-output");
      const reportPath = join(fixtureDir, "template-report.json");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime, stdout } = createActionTestRuntime();

      await actionMdPdfTemplateCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "dense report",
        output: toRepoRelativePath(outputPath),
        codexReportOutput: toRepoRelativePath(reportPath),
        dryRun: true,
      });

      expect(stdout.text).toContain(`Codex report: ${toRepoRelativePath(reportPath)}`);
      expect(stdout.text).toContain("Dry run only. No template bundle files were written.");
      expect(await pathExists(outputPath)).toBe(false);
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        artifactType: string;
        files: Array<{ role: string }>;
      };
      expect(report.artifactType).toBe("markdown-pdf-codex-template-report");
      expect(report.files.map((file) => file.role)).toEqual([
        "template-html",
        "style-css",
        "diagnostic-report",
      ]);
    });
  });
});
