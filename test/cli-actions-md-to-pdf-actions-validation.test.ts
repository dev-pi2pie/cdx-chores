import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../src/cli/actions";
import { createPdfRunner } from "./cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: md to-pdf validation", () => {
  test("rejects missing input before dependency execution", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const missing = join(fixtureDir, "missing.md");
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });

      await expectCliError(
        () => actionMdToPdf(runtime, { input: toRepoRelativePath(missing), runner }),
        {
          code: "FILE_NOT_FOUND",
          exitCode: 2,
          messageIncludes: "Input file not found:",
        },
      );

      expect(calls).toHaveLength(0);
      expectNoOutput();
    });
  });

  test("rejects invalid margin before dependency execution", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            margin: "1rem",
            runner,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--margin must be a CSS length",
        },
      );

      expect(calls).toHaveLength(0);
      expectNoOutput();
    });
  });

  test("rejects html output that resolves to the PDF output path", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            htmlOutput: toRepoRelativePath(outputPath),
            runner,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "--html-output must be different",
        },
      );

      expect(calls).toHaveLength(0);
      expectNoOutput();
    });
  });

  test("rejects missing custom template before dependency execution", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const templatePath = join(fixtureDir, "missing-template.html");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            template: toRepoRelativePath(templatePath),
            runner,
          }),
        {
          code: "FILE_NOT_FOUND",
          exitCode: 2,
          messageIncludes: "Template file not found",
        },
      );

      expect(calls).toHaveLength(0);
      expectNoOutput();
    });
  });

  test("rejects custom CSS directories before dependency execution", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const cssPath = join(fixtureDir, "styles");
      await writeFile(inputPath, "# Report\n", "utf8");
      await mkdir(cssPath);
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            css: toRepoRelativePath(cssPath),
            runner,
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "CSS path is not a file",
        },
      );

      expect(calls).toHaveLength(0);
      expectNoOutput();
    });
  });

  test("rejects missing profile files before dependency execution", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "missing-profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            profile: toRepoRelativePath(profilePath),
            runner,
          }),
        {
          code: "FILE_READ_ERROR",
          exitCode: 2,
          messageIncludes: "Failed to read file:",
        },
      );

      expect(calls).toHaveLength(0);
      expectNoOutput();
    });
  });

  test("rejects existing html output without overwrite", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const htmlOutput = join(fixtureDir, "report.render.html");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(htmlOutput, "existing", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            htmlOutput: toRepoRelativePath(htmlOutput),
            runner,
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Output file already exists",
        },
      );

      expect(calls).toHaveLength(0);
      expectNoOutput();
    });
  });

  test("reports pandoc renderer failures", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { runner } = createPdfRunner({
        html: "<html><body></body></html>",
        failPandoc: true,
      });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () => actionMdToPdf(runtime, { input: toRepoRelativePath(inputPath), runner }),
        {
          code: "PROCESS_FAILED",
          exitCode: 1,
          messageIncludes: "pandoc failed",
        },
      );

      expectNoOutput();
    });
  });

  test("reports weasyprint renderer failures", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { runner } = createPdfRunner({
        html: "<html><body></body></html>",
        failWeasyprint: true,
      });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () => actionMdToPdf(runtime, { input: toRepoRelativePath(inputPath), runner }),
        {
          code: "PROCESS_FAILED",
          exitCode: 1,
          messageIncludes: "weasyprint failed",
        },
      );

      expectNoOutput();
    });
  });
});
