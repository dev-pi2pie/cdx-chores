import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
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
      const outputPath = join(fixtureDir, "template-output");

      const { runtime, stderr, stdout } = createActionTestRuntime();
      await actionMdPdfTemplateCodex(runtime, {
        output: toRepoRelativePath(outputPath),
        preset: "report",
      });

      expect(stdout.text).toContain("Signal mode: recipe-only");
      expect(stdout.text).toContain("Decision mode: deterministic");
      expect(stdout.text).toContain("Template family: document-layered");
      expect(stdout.text).toContain("Recipe preset: report (explicit-recipe)");
      expect(stdout.text).toContain("Template bundle: md-pdf-template-");
      expect(stdout.text).toContain("Template HTML: template.html");
      expect(stdout.text).toContain("Stylesheet: style.css");
      expect(stdout.text).toContain("Managed assets: 0");
      expect(stdout.text).toContain("Follow-up render: cdx-chores md to-pdf");
      expect(stderr.text).not.toContain("Requesting Codex Markdown PDF template recommendation");
      expect(stderr.text).toContain("Wrote Markdown PDF template bundle:");
      expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(".cdx-code-line");
    });
  });

  test("prints deterministic synthesis summary for dry runs without writing artifacts", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-dry-run", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "template-output");

      const { runtime, stdout } = createActionTestRuntime();

      await actionMdPdfTemplateCodex(runtime, {
        output: toRepoRelativePath(outputPath),
        preset: "report",
        dryRun: true,
      });

      expect(stdout.text).toContain("Signal mode: recipe-only");
      expect(stdout.text).toContain("Decision mode: deterministic");
      expect(stdout.text).toContain("Template family: document-layered");
      expect(stdout.text).toContain("Recipe preset: report (explicit-recipe)");
      expect(stdout.text).toContain("Follow-up render: cdx-chores md to-pdf");
      expect(stdout.text).toContain("Dry run only. No template bundle files were written.");
      expect(await pathExists(outputPath)).toBe(false);
    });
  });
});
