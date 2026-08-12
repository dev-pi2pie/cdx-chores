import { describe, expect, test } from "bun:test";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../src/cli/actions";
import {
  assessMarkdownPdfTemplateCompatibility,
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING,
} from "../src/cli/markdown-pdf";
import { createPdfRunner } from "./cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

const BODY_DOCUMENT_PROFILE = `pageNumbers:
  enabled: true
  scope: body
  countFrom: document
`;

const BODY_ORIGIN_PROFILE = `pageNumbers:
  enabled: true
  scope: body
  countFrom: body
`;

async function expectMissing(path: string): Promise<void> {
  await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
}

describe("Markdown PDF selected-template compatibility", () => {
  test("accepts the built-in body contract for body-origin numbering", async () => {
    await withTempFixtureDir("md-pdf-template-compat-built-in", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, BODY_ORIGIN_PROFILE, "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        profile: toRepoRelativePath(profilePath),
        runner,
      });

      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(calls.some((call) => call.command === "pandoc")).toBe(true);
      expectNoStderr();
    });
  });

  test("inspects the explicitly selected Template actual HTML", async () => {
    await withTempFixtureDir("md-pdf-template-compat-explicit", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const templatePath = join(fixtureDir, "template.html");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, BODY_ORIGIN_PROFILE, "utf8");
      await writeFile(
        templatePath,
        '<html><body><main class="document-body">$body$</main></body></html>\n',
        "utf8",
      );
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        profile: toRepoRelativePath(profilePath),
        template: toRepoRelativePath(templatePath),
        runner,
      });

      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expectNoStderr();
    });
  });

  test("warns exactly once for document-origin body visibility on a legacy Template", async () => {
    await withTempFixtureDir("md-pdf-template-compat-legacy", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const templatePath = join(fixtureDir, "legacy.html");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, BODY_DOCUMENT_PROFILE, "utf8");
      await writeFile(templatePath, "<html><body><main>$body$</main></body></html>\n", "utf8");
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        profile: toRepoRelativePath(profilePath),
        template: toRepoRelativePath(templatePath),
        runner,
      });

      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(
        stderr.text.match(new RegExp(MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING, "g")),
      ).toHaveLength(1);
    });
  });

  test("rejects body-origin numbering before probes or output writes when an explicit Template is unproven", async () => {
    await withTempFixtureDir("md-pdf-template-compat-reject", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const templatePath = join(fixtureDir, "legacy.html");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutputPath = join(fixtureDir, "report.html");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, BODY_ORIGIN_PROFILE, "utf8");
      await writeFile(templatePath, "<html><body><main>$body$</main></body></html>\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            htmlOutput: toRepoRelativePath(htmlOutputPath),
            profile: toRepoRelativePath(profilePath),
            template: toRepoRelativePath(templatePath),
            runner,
          }),
        {
          code: "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED",
          exitCode: 2,
          messageIncludes: "countFrom: body requires exactly one .document-body",
        },
      );

      expect(calls).toHaveLength(0);
      await expectMissing(outputPath);
      await expectMissing(htmlOutputPath);
      expectNoOutput();
    });
  });

  test("rejects an unproven bundle-resolved Template before rendering", async () => {
    await withTempFixtureDir("md-pdf-template-compat-bundle", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "profile.yml"), BODY_ORIGIN_PROFILE, "utf8");
      await writeFile(join(bundleDirectory, "template.html"), "<main>$body$</main>\n", "utf8");
      await writeFile(join(bundleDirectory, "style.css"), "body { color: black; }\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          bundle: toRepoRelativePath(bundleDirectory),
          runner,
        }),
      ).rejects.toMatchObject({ code: "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED" });

      expect(calls).toHaveLength(0);
      await expectMissing(outputPath);
      expectNoOutput();
    });
  });

  test("does not require body proof for disabled numbering or document visibility", () => {
    expect(
      assessMarkdownPdfTemplateCompatibility({
        builtIn: false,
        profile: DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
        templateHtml: "<main>$body$</main>",
      }),
    ).toEqual({ bodyBoundary: "not-required", warnings: [] });

    expect(
      assessMarkdownPdfTemplateCompatibility({
        builtIn: false,
        profile: {
          ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
          pageNumbers: {
            ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
            enabled: true,
            scope: "document",
          },
        },
        templateHtml: "<main>$body$</main>",
      }),
    ).toEqual({ bodyBoundary: "not-required", warnings: [] });
  });

  test("rejects a managed Template that promises but violates the hook contract", () => {
    expect(() =>
      assessMarkdownPdfTemplateCompatibility({
        builtIn: false,
        profile: {
          ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
          pageNumbers: {
            ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
            enabled: true,
          },
        },
        templateHtml: [
          '<meta name="generator" content="cdx-chores md pdf-template codex">',
          "<main>$body$</main>",
        ].join("\n"),
      }),
    ).toThrow("selected managed Markdown PDF template requires exactly one .document-body");
  });
});
