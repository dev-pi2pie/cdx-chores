import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../src/cli/actions";
import type { MarkdownPdfProcessRunner } from "../src/cli/markdown-pdf";
import { createPdfRunner } from "./cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: md to-pdf rendering", () => {
  test("renders derived PDF output and optional HTML output with injected process runner", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const imageDir = join(fixtureDir, "images");
      const htmlOutput = join(fixtureDir, "report.render.html");
      await mkdir(imageDir, { recursive: true });
      await writeFile(join(imageDir, "chart.png"), "fake", "utf8");
      await writeFile(inputPath, "# Report\n\n![Chart](./images/chart.png)\n", "utf8");

      const html = '<html><body><img src="./images/chart.png"></body></html>';
      const { calls, runner } = createPdfRunner({
        html,
        weasyprintStderr: "WARNING: missing image metadata\n",
      });
      const { runtime, stdout, stderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        htmlOutput: toRepoRelativePath(htmlOutput),
        runner,
      });

      const outputPath = join(fixtureDir, "report.pdf");
      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(await readFile(htmlOutput, "utf8")).toBe(html);
      expect(stdout.text).toContain("Wrote PDF:");
      expect(stderr.text).toContain("Markdown PDF render warnings:");
      expect(stderr.text).toContain("WARNING: missing image metadata");

      const weasyprintRender = calls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      expect(weasyprintRender?.args).toContain("--base-url");
      expect(weasyprintRender?.args[weasyprintRender.args.indexOf("--base-url") + 1]).toBe(
        fixtureDir,
      );
    });
  });

  test("loads a YAML profile and applies profile page chrome CSS", async () => {
    await withTempFixtureDir("md-to-pdf-profile-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      const renderedStyles: string[] = [];
      await writeFile(
        inputPath,
        "---\ntitle: Quarterly Report\nauthor: Frontmatter Author\n---\n# Report\n",
        "utf8",
      );
      await writeFile(
        profilePath,
        [
          "page:",
          "  size: Letter",
          "  margin: 12mm",
          "metadata:",
          "  company: Example Co.",
          "header:",
          '  left: "{company}"',
          '  right: "{title}"',
          "pageNumbers:",
          "  enabled: true",
          '  format: "Page {page}"',
          "",
        ].join("\n"),
        "utf8",
      );

      const { runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        if (command === "weasyprint" && !args.includes("--info")) {
          const stylesheetIndexes = args
            .map((arg, index) => (arg === "--stylesheet" ? index : -1))
            .filter((index) => index >= 0);
          for (const index of stylesheetIndexes) {
            const stylesheetPath = args[index + 1];
            if (stylesheetPath) {
              renderedStyles.push(await readFile(stylesheetPath, "utf8"));
            }
          }
        }
        return runner(command, args, runnerOptions);
      };
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        meta: ["author=Noname"],
        runner: capturingRunner,
      });

      const combinedCss = renderedStyles.join("\n");
      expect(combinedCss).toContain("size: Letter portrait");
      expect(combinedCss).toContain("margin: 12mm 12mm 12mm 12mm");
      expect(combinedCss).toContain('@top-left {\n    content: "Example Co.";');
      expect(combinedCss).toContain('@top-right {\n    content: "Quarterly Report";');
      expect(combinedCss).toContain('@bottom-center {\n    content: "Page " counter(page);');
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });

  test("applies default CSS before custom CSS", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customCss = join(fixtureDir, "custom.css");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(customCss, "body { color: black; }\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        css: toRepoRelativePath(customCss),
        runner,
      });

      const weasyprintRender = calls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      const stylesheetIndexes = weasyprintRender?.args
        .map((arg, index) => (arg === "--stylesheet" ? index : -1))
        .filter((index) => index >= 0);
      expect(stylesheetIndexes).toHaveLength(2);
      expect(weasyprintRender?.args[(stylesheetIndexes?.at(-1) ?? 0) + 1]).toBe(customCss);
    });
  });

  test("supports custom template and disabling default CSS", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customTemplate = join(fixtureDir, "template.html");
      const customCss = join(fixtureDir, "custom.css");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(customTemplate, "<html><body>$body$</body></html>", "utf8");
      await writeFile(customCss, "body { color: black; }\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        template: toRepoRelativePath(customTemplate),
        css: toRepoRelativePath(customCss),
        noDefaultCss: true,
        runner,
      });

      const pandocRender = calls.find(
        (call) => call.command === "pandoc" && !call.args.includes("--version"),
      );
      expect(pandocRender?.args[pandocRender.args.indexOf("--template") + 1]).toBe(customTemplate);

      const weasyprintRender = calls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      const stylesheetArgs = weasyprintRender?.args.filter((arg) => arg === "--stylesheet");
      expect(stylesheetArgs).toHaveLength(1);
      expect(weasyprintRender?.args[weasyprintRender.args.indexOf("--stylesheet") + 1]).toBe(
        customCss,
      );
    });
  });

  test("overwrites existing html output when overwrite is enabled", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutput = join(fixtureDir, "report.render.html");
      const renderedHtml = "<html><body><p>new</p></body></html>";
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(outputPath, "existing-pdf", "utf8");
      await writeFile(htmlOutput, "existing", "utf8");
      const { runner } = createPdfRunner({ html: renderedHtml });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        htmlOutput: toRepoRelativePath(htmlOutput),
        overwrite: true,
        runner,
      });

      expect(await readFile(htmlOutput, "utf8")).toBe(renderedHtml);
      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });
});
