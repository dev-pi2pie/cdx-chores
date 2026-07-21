import { describe, expect, test } from "bun:test";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  executePlannedMarkdownPdfRender,
  planMarkdownPdfRender,
  prepareMarkdownPdfRender,
} from "../src/cli/actions";
import { createPdfRunner } from "./cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("Markdown PDF prepared render service", () => {
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
});
