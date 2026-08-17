import { describe, expect, test } from "bun:test";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  executePlannedMarkdownPdfRender,
  planMarkdownPdfRender,
  prepareMarkdownPdfRender,
} from "../src/cli/actions";
import type { MarkdownPdfProcessRunner } from "../src/cli/markdown-pdf";
import {
  MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID,
  MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME,
} from "../src/cli/markdown-pdf/profile";
import { createPdfRunner } from "./cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("Markdown PDF prepared render service", () => {
  test.each([
    {
      expected: false,
      label: "uses the normalized default when no Profile or override is present",
      override: undefined,
      profileEnabled: false,
      profileSource: undefined,
      source: "default",
    },
    {
      expected: true,
      label: "inherits enabled from the loaded Profile when the override is omitted",
      override: undefined,
      profileEnabled: true,
      profileSource: "pageNumbers:\n  enabled: true\n",
      source: "profile",
    },
    {
      expected: false,
      label: "uses an explicit disable over an enabled Profile",
      override: false,
      profileEnabled: true,
      profileSource: "pageNumbers:\n  enabled: true\n",
      source: "direct-override",
    },
    {
      expected: true,
      label: "uses an explicit enable over a disabled Profile",
      override: true,
      profileEnabled: false,
      profileSource: "pageNumbers:\n  enabled: false\n",
      source: "direct-override",
    },
  ])("$label", async ({ expected, override, profileEnabled, profileSource, source }) => {
    await withTempFixtureDir("md-to-pdf-page-number-precedence", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      if (profileSource) {
        await writeFile(profilePath, profileSource, "utf8");
      }
      const { runtime } = createActionTestRuntime();

      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        pageNumbers: override,
        profile: profileSource ? toRepoRelativePath(profilePath) : undefined,
      });

      expect(prepared.normalizedProfile.pageNumbers.enabled).toBe(profileEnabled);
      expect(prepared.pageNumberConfiguration).toMatchObject({
        effective: { enabled: expected },
        override,
        profileEnabled,
        source,
      });
      expect(prepared.pageNumberConfiguration.effective).not.toBe(
        prepared.normalizedProfile.pageNumbers,
      );
      expect(
        prepared.recipe.styleCss.includes(`counter(${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME})`),
      ).toBe(expected);
    });
  });

  test("uses the effective enablement for body-boundary compatibility without mutating Profile", async () => {
    await withTempFixtureDir("md-to-pdf-page-number-effective-body", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        profilePath,
        [
          "pageNumbers:",
          "  enabled: false",
          "  scope: body",
          "  countFrom: body",
          "  start: 3",
          "",
        ].join("\n"),
        "utf8",
      );
      const { runtime } = createActionTestRuntime();

      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        pageNumbers: true,
        profile: toRepoRelativePath(profilePath),
      });

      expect(prepared.normalizedProfile.pageNumbers).toMatchObject({
        countFrom: "body",
        enabled: false,
        scope: "body",
        start: 3,
      });
      expect(prepared.pageNumberConfiguration.effective).toMatchObject({
        countFrom: "body",
        enabled: true,
        scope: "body",
        start: 3,
      });
      expect(prepared.templateCompatibility.bodyBoundary).toBe("proven");
      expect(prepared.recipe.styleCss).toContain("@page body:nth(1 of body)");
    });
  });

  test("prepares a reviewable recipe and explicit role provenance without writing outputs", async () => {
    await withTempFixtureDir("md-to-pdf-prepared", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const templatePath = join(fixtureDir, "template.html");
      const cssPath = join(fixtureDir, "style.css");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "---\ntitle: Prepared report\n---\n# Prepared report\n", "utf8");
      await writeFile(profilePath, "page:\n  size: Letter\n", "utf8");
      await writeFile(templatePath, "<html><body>$body$</body></html>\n", "utf8");
      await writeFile(cssPath, "body { color: black; }\n", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        template: toRepoRelativePath(templatePath),
        css: toRepoRelativePath(cssPath),
      });

      expect(prepared.resolvedInputs).toEqual({
        profile: { path: profilePath, source: "explicit" },
        template: { path: templatePath, source: "explicit" },
        css: { path: cssPath, source: "explicit" },
      });
      expect(prepared.normalizedProfile.metadata.title).toBe("Prepared report");
      expect(prepared.titleSignals.frontmatterTitle.present).toBeTrue();
      expect(prepared.recipe.templateHtml).toContain("$body$");
      expect(prepared.options.pageSize).toBe("Letter");
      await expect(stat(outputPath)).rejects.toMatchObject({ code: "ENOENT" });
      expectNoOutput();
    });
  });

  test("rebinds output choices without changing the prepared recipe", async () => {
    await withTempFixtureDir("md-to-pdf-rebind", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const firstOutput = join(fixtureDir, "first.pdf");
      const secondOutput = join(fixtureDir, "second.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { runtime } = createActionTestRuntime();
      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
      });

      const firstPlan = await planMarkdownPdfRender(runtime, prepared, {
        output: toRepoRelativePath(firstOutput),
      });
      const secondPlan = await planMarkdownPdfRender(runtime, prepared, {
        output: toRepoRelativePath(secondOutput),
      });

      expect(firstPlan.prepared).toBe(prepared);
      expect(secondPlan.prepared).toBe(prepared);
      expect(firstPlan.outputPath).toBe(firstOutput);
      expect(secondPlan.outputPath).toBe(secondOutput);
      expect(firstPlan.prepared.recipe).toBe(secondPlan.prepared.recipe);
      await expect(stat(firstOutput)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(stat(secondOutput)).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("rejects invalid output binding without probing render dependencies", async () => {
    await withTempFixtureDir("md-to-pdf-bind", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { runtime } = createActionTestRuntime();
      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
      });
      const { calls, runner } = createPdfRunner({ html: "<html></html>" });

      await expectCliError(
        () =>
          planMarkdownPdfRender(runtime, prepared, {
            output: toRepoRelativePath(outputPath),
            htmlOutput: toRepoRelativePath(outputPath),
          }),
        { code: "INVALID_INPUT", exitCode: 2, messageIncludes: "must be different" },
      );

      expect(calls).toHaveLength(0);
      expect(runner).toBeFunction();
    });
  });

  test("executes one planned render through the injected dependency runner", async () => {
    await withTempFixtureDir("md-to-pdf-execute", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "accepted.pdf");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { runtime } = createActionTestRuntime();
      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
      });
      const plan = await planMarkdownPdfRender(runtime, prepared, {
        output: toRepoRelativePath(outputPath),
      });
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });

      await executePlannedMarkdownPdfRender(runtime, plan, { runner });

      expect(calls.map(({ command }) => command)).toEqual([
        "pandoc",
        "weasyprint",
        "pandoc",
        "weasyprint",
      ]);
      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
    });
  });

  test("finalizes the effective CLI override after highlighting and shares one HTML artifact", async () => {
    await withTempFixtureDir("md-to-pdf-prepared-page-number-finalize", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutputPath = join(fixtureDir, "report.html");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        profilePath,
        [
          "code:",
          "  highlight: true",
          "pageNumbers:",
          "  enabled: false",
          "  scope: body",
          "  countFrom: body",
          '  format: "{page} / {pages}"',
          "",
        ].join("\n"),
        "utf8",
      );
      const { runtime } = createActionTestRuntime();
      const prepared = await prepareMarkdownPdfRender(runtime, {
        input: toRepoRelativePath(inputPath),
        pageNumbers: true,
        profile: toRepoRelativePath(profilePath),
      });
      const plan = await planMarkdownPdfRender(runtime, prepared, {
        htmlOutput: toRepoRelativePath(htmlOutputPath),
        output: toRepoRelativePath(outputPath),
      });
      const { runner } = createPdfRunner({
        html: '<html><body><main class="document-body">Report</main></body></html>',
      });
      const weasyprintInputs: string[] = [];
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        if (command === "weasyprint" && !args.includes("--info")) {
          const htmlPath = args.at(-2);
          if (htmlPath) {
            weasyprintInputs.push(await readFile(htmlPath, "utf8"));
          }
        }
        return runner(command, args, runnerOptions);
      };
      const highlighterInputs: string[] = [];

      await executePlannedMarkdownPdfRender(runtime, plan, {
        codeHighlighter: async (html) => {
          highlighterInputs.push(html);
          return html.replace("Report", '<p data-highlighted="true">Report</p>');
        },
        runner: capturingRunner,
      });

      const htmlOutput = await readFile(htmlOutputPath, "utf8");
      expect(prepared.pageNumberConfiguration).toMatchObject({
        effective: { enabled: true, format: "{page} / {pages}" },
        override: true,
        profileEnabled: false,
        source: "direct-override",
      });
      expect(highlighterInputs).toHaveLength(1);
      expect(highlighterInputs[0]).not.toContain(MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID);
      expect(htmlOutput).toContain('data-highlighted="true"');
      expect(htmlOutput).toContain(`id="${MARKDOWN_PDF_LOGICAL_FINAL_TARGET_ID}"`);
      expect(weasyprintInputs).toEqual([htmlOutput]);
    });
  });
});
