import { describe, expect, test } from "bun:test";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf, prepareMarkdownPdfRender } from "../src/cli/actions";
import {
  assessMarkdownPdfTemplateCompatibility,
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING,
  type MarkdownPdfProcessRunner,
} from "../src/cli/markdown-pdf";
import { MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME } from "../src/cli/markdown-pdf/profile/page-number-format";
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
  test("regenerates built-in CSS from the proven body boundary", async () => {
    await withTempFixtureDir("md-pdf-template-compat-built-in-css", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, BODY_ORIGIN_PROFILE, "utf8");
      const { runtime } = createActionTestRuntime();

      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
      });

      expect(prepared.templateCompatibility.bodyBoundary).toBe("proven");
      expect(prepared.recipe.styleCss).toContain("@page body {");
      expect(prepared.recipe.styleCss).toContain("@page body:nth(1 of body) {");
      expect(prepared.recipe.styleCss).toContain(".document-body {\n  page: body;");
    });
  });

  test("regenerates selected-Template CSS from the legacy fallback", async () => {
    await withTempFixtureDir("md-pdf-template-compat-legacy-css", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const templatePath = join(fixtureDir, "legacy.html");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, BODY_DOCUMENT_PROFILE, "utf8");
      await writeFile(templatePath, "<main>$body$</main>\n", "utf8");
      const { runtime } = createActionTestRuntime();

      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        template: toRepoRelativePath(templatePath),
      });

      expect(prepared.templateCompatibility.bodyBoundary).toBe("legacy-document-origin-fallback");
      expect(prepared.recipe.styleCss).toContain(
        `counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 1;`,
      );
      expect(prepared.recipe.styleCss).not.toContain("counter-increment: page");
      expect(prepared.recipe.styleCss).toContain("@page toc {");
      expect(prepared.recipe.styleCss).not.toContain("@page body");
      expect(prepared.recipe.styleCss).not.toContain(".document-body {\n  page: body;");
    });
  });

  test("keeps arbitrary Template ownership while restoring ToC chrome and document numbering", async () => {
    await withTempFixtureDir("md-pdf-template-compat-toc-chrome", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const templatePath = join(fixtureDir, "custom-template.html");
      const outputPath = join(fixtureDir, "report.pdf");
      const customTemplate =
        '<html><body><article class="custom-document">$body$</article></body></html>\n';
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        profilePath,
        [
          "header:",
          "  left: Guide header",
          "  right: Replaced header",
          "footer:",
          "  left: Guide footer",
          "pageNumbers:",
          "  enabled: true",
          "  scope: document",
          "  countFrom: document",
          "  position: top-right",
          "  format: 'Page {page}'",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(templatePath, customTemplate, "utf8");
      const { calls, runner } = createPdfRunner({
        html: '<html><body><main class="document-body">Report</main></body></html>',
      });
      let selectedTemplate = "";
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        if (command === "pandoc" && !args.includes("--version")) {
          const selectedTemplatePath = args[args.indexOf("--template") + 1];
          if (selectedTemplatePath) {
            selectedTemplate = await readFile(selectedTemplatePath, "utf8");
          }
        }
        return runner(command, args, runnerOptions);
      };
      const { runtime, stderr } = createActionTestRuntime();
      const options = {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        template: toRepoRelativePath(templatePath),
        toc: true,
      } as const;

      const prepared = await prepareMarkdownPdfRender(runtime, options);
      const tocRuleStart = prepared.recipe.styleCss.indexOf("@page toc {");
      const tocCss = prepared.recipe.styleCss.slice(tocRuleStart);

      expect(prepared.resolvedInputs.template).toEqual({ path: templatePath, source: "explicit" });
      expect(prepared.templateCompatibility.bodyBoundary).toBe("not-required");
      expect(tocRuleStart).toBeGreaterThanOrEqual(0);
      expect(tocCss).toContain("@top-left {\n    content: none;");
      expect(tocCss).toContain('@top-left {\n    content: "Guide header";');
      expect(tocCss).toContain('@top-right {\n    content: "Page " counter(');
      expect(tocCss).toContain('@bottom-left {\n    content: "Guide footer";');
      expect(tocCss).not.toContain("Replaced header");
      expect(tocCss.indexOf("content: none;")).toBeLessThan(
        tocCss.indexOf('content: "Guide header";'),
      );

      await actionMdToPdf(runtime, {
        ...options,
        output: toRepoRelativePath(outputPath),
        runner: capturingRunner,
      });

      const pandocRender = calls.find(
        (call) => call.command === "pandoc" && !call.args.includes("--version"),
      );
      expect(pandocRender?.args).toContain("--toc");
      expect(selectedTemplate).toContain('<article class="custom-document">$body$</article>');
      expect(selectedTemplate).not.toContain('class="document-body"');
      expect(selectedTemplate).not.toContain('class="document-title"');
      expect(selectedTemplate.match(/\$body\$/g)).toHaveLength(1);
      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(stderr.text).toContain(
        "Page numbers at top-right replace configured header.right content for this render.",
      );
    });
  });

  test("accepts the built-in body contract for body-origin numbering", async () => {
    await withTempFixtureDir("md-pdf-template-compat-built-in", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, BODY_ORIGIN_PROFILE, "utf8");
      const { calls, runner } = createPdfRunner({
        html: '<html><body><main class="document-body">Report</main></body></html>',
      });
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
      const htmlOutputPath = join(fixtureDir, "report.html");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, `${BODY_ORIGIN_PROFILE}  format: "{pages}"\n`, "utf8");
      await writeFile(
        templatePath,
        '<html><body><main class="document-body">$body$</main></body></html>\n',
        "utf8",
      );
      const { runner } = createPdfRunner({
        html: '<html><body><main class="document-body">Report</main></body></html>',
      });
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        htmlOutput: toRepoRelativePath(htmlOutputPath),
        output: toRepoRelativePath(outputPath),
        profile: toRepoRelativePath(profilePath),
        template: toRepoRelativePath(templatePath),
        runner,
      });

      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(await readFile(htmlOutputPath, "utf8")).toContain(
        'id="cdx-markdown-pdf-logical-final"',
      );
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

  test("keeps compatibility warnings ahead of renderer warnings", async () => {
    await withTempFixtureDir("md-pdf-template-compat-warning-order", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const templatePath = join(fixtureDir, "legacy.html");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, BODY_DOCUMENT_PROFILE, "utf8");
      await writeFile(templatePath, "<html><body><main>$body$</main></body></html>\n", "utf8");
      const { runner } = createPdfRunner({
        html: "<html><body>Report</body></html>",
        weasyprintStderr: "renderer warning\n",
      });
      const { runtime, stderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        profile: toRepoRelativePath(profilePath),
        template: toRepoRelativePath(templatePath),
        runner,
      });

      expect(stderr.text).toBe(
        [
          "Markdown PDF render warnings:",
          `- ${MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING}`,
          "- renderer warning",
          "",
        ].join("\n"),
      );
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

  test.each([
    {
      label: "missing insertion",
      status: "missing-insertion",
      templateHtml: '<main class="document-body"></main>\n',
    },
    {
      label: "duplicate insertion",
      status: "duplicate-insertion",
      templateHtml: '<main class="document-body">$body$$body$</main>\n',
    },
    {
      label: "unrelated insertion",
      status: "unrelated-insertion",
      templateHtml: '<main class="document-body"></main><section>$body$</section>\n',
    },
  ])(
    "rejects a non-managed legacy Template with $label before probes or output writes",
    async ({ status, templateHtml }) => {
      await withTempFixtureDir("md-pdf-template-compat-malformed", async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const profilePath = join(fixtureDir, "profile.yml");
        const templatePath = join(fixtureDir, "legacy.html");
        const outputPath = join(fixtureDir, "report.pdf");
        const htmlOutputPath = join(fixtureDir, "report.html");
        await writeFile(inputPath, "# Report\n", "utf8");
        await writeFile(profilePath, BODY_DOCUMENT_PROFILE, "utf8");
        await writeFile(templatePath, templateHtml, "utf8");
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
            messageIncludes: `found ${status}`,
          },
        );

        expect(calls).toHaveLength(0);
        await expectMissing(outputPath);
        await expectMissing(htmlOutputPath);
        expectNoOutput();
      });
    },
  );

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

  test("uses legacy fallback for the bundle-resolved Template with one warning", async () => {
    await withTempFixtureDir("md-pdf-template-compat-bundle-legacy", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "profile.yml"), BODY_DOCUMENT_PROFILE, "utf8");
      await writeFile(join(bundleDirectory, "template.html"), "<main>$body$</main>\n", "utf8");
      await writeFile(join(bundleDirectory, "style.css"), "body { color: black; }\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stdout, stderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        runner,
      });

      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(stdout.text).toContain("- template: template.html");
      expect(calls.some((call) => call.command === "pandoc")).toBe(true);
      expect(
        stderr.text.match(new RegExp(MARKDOWN_PDF_LEGACY_BODY_VISIBILITY_WARNING, "g")),
      ).toHaveLength(1);
    });
  });

  test("does not require body proof for disabled numbering or document visibility", () => {
    expect(
      assessMarkdownPdfTemplateCompatibility({
        builtIn: false,
        profile: DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
        templateHtml: "<main>$body$</main>",
      }),
    ).toEqual({ bodyBoundary: "not-required" });

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
    ).toEqual({ bodyBoundary: "not-required" });
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

  test("does not treat generator marker text in ordinary content as a managed Template", () => {
    expect(
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
          '<p>&lt;meta name="generator" content="cdx-chores md pdf-template codex"&gt;</p>',
          "<main>$body$</main>",
        ].join("\n"),
      }),
    ).toMatchObject({ bodyBoundary: "legacy-document-origin-fallback" });
  });

  test("treats an actual Codex identity comment as a managed Template marker", () => {
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
          "<!-- cdx-chores md pdf-template codex | bundle=test | family=editorial-report -->",
          "<main>$body$</main>",
        ].join("\n"),
      }),
    ).toThrow("selected managed Markdown PDF template requires exactly one .document-body");
  });
});
