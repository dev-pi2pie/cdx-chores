import { describe, expect, test } from "bun:test";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { actionMdToPdf } from "../src/cli/actions";
import { CliError } from "../src/cli/errors";
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

  test("applies code highlighting before html output and PDF rendering", async () => {
    await withTempFixtureDir("md-to-pdf-code-highlight-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const htmlOutput = join(fixtureDir, "report.render.html");
      await writeFile(inputPath, "# Report\n\n```js\nconst x = 1;\n```\n", "utf8");

      const { runner } = createPdfRunner({
        html: '<html><body><pre><code class="language-js">const x = 1;</code></pre></body></html>',
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
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        htmlOutput: toRepoRelativePath(htmlOutput),
        codeHighlight: true,
        runner: capturingRunner,
      });

      const renderedHtml = await readFile(htmlOutput, "utf8");
      expect(renderedHtml).toContain("cdx-code--highlighted");
      expect(renderedHtml).toContain("shiki");
      expect(weasyprintInputs).toHaveLength(1);
      expect(weasyprintInputs[0]).toContain("cdx-code--highlighted");
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });

  test("applies profile-enabled code highlighting without the CLI flag", async () => {
    await withTempFixtureDir("md-to-pdf-code-highlight-profile-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      const htmlOutput = join(fixtureDir, "report.render.html");
      await writeFile(inputPath, "# Report\n\n```js\nconst x = 1;\n```\n", "utf8");
      await writeFile(profilePath, "code:\n  highlight: true\n", "utf8");

      const { runner } = createPdfRunner({
        html: '<html><body><pre><code class="language-js">const x = 1;</code></pre></body></html>',
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
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        htmlOutput: toRepoRelativePath(htmlOutput),
        runner: capturingRunner,
      });

      expect(await readFile(htmlOutput, "utf8")).toContain("cdx-code--highlighted");
      expect(weasyprintInputs).toHaveLength(1);
      expect(weasyprintInputs[0]).toContain("cdx-code--highlighted");
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });

  test("keeps html output plain when code highlighting is disabled by CLI", async () => {
    await withTempFixtureDir("md-to-pdf-code-highlight-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      const htmlOutput = join(fixtureDir, "report.render.html");
      const html =
        '<html><body><pre><code class="language-js">const x = 1;</code></pre></body></html>';
      await writeFile(inputPath, "# Report\n\n```js\nconst x = 1;\n```\n", "utf8");
      await writeFile(profilePath, "code:\n  highlight: true\n", "utf8");

      const { runner } = createPdfRunner({ html });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        htmlOutput: toRepoRelativePath(htmlOutput),
        codeHighlight: false,
        runner,
      });

      expect(await readFile(htmlOutput, "utf8")).toBe(html);
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
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

  test("leaves output artifacts untouched and cleans temp files when public action code transform fails", async () => {
    await withTempFixtureDir("md-to-pdf-code-highlight-transform-failure", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutput = join(fixtureDir, "report.render.html");
      await writeFile(inputPath, "# Report\n\n```js\nconst x = 1;\n```\n", "utf8");
      await writeFile(outputPath, "existing-pdf", "utf8");
      await writeFile(htmlOutput, "existing-html", "utf8");

      const { calls, runner } = createPdfRunner({
        html: '<html><body><pre><code class="language-js">const x = 1;</code></pre></body></html>',
      });
      let tempDir: string | undefined;
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        if (command === "pandoc" && !args.includes("--version")) {
          const outputPath = args[args.indexOf("--output") + 1];
          if (outputPath) {
            tempDir = dirname(outputPath);
          }
        }
        return runner(command, args, runnerOptions);
      };
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          htmlOutput: toRepoRelativePath(htmlOutput),
          overwrite: true,
          codeHighlight: true,
          runner: capturingRunner,
          codeHighlighter: async () => {
            throw new CliError("Failed to highlight Markdown PDF code blocks: forced failure", {
              code: "MARKDOWN_PDF_CODE_HIGHLIGHT_FAILED",
              exitCode: 1,
            });
          },
        }),
      ).rejects.toThrow("Failed to highlight Markdown PDF code blocks");

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
      expect(await readFile(outputPath, "utf8")).toBe("existing-pdf");
      expect(await readFile(htmlOutput, "utf8")).toBe("existing-html");
      expect(tempDir).toBeDefined();
      await expect(stat(tempDir ?? "")).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("keeps existing outputs untouched through the public action when post-transform validation fails", async () => {
    await withTempFixtureDir("md-to-pdf-action-post-transform-failure", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutput = join(fixtureDir, "report.render.html");
      await writeFile(inputPath, "# Report\n\n```js\nconst x = 1;\n```\n", "utf8");
      await writeFile(outputPath, "existing-pdf", "utf8");
      await writeFile(htmlOutput, "existing-html", "utf8");

      const { calls, runner } = createPdfRunner({
        html: [
          "<html><body>",
          '<img src="https://example.com/remote.png">',
          '<pre><code class="language-js">const x = 1;</code></pre>',
          "</body></html>",
        ].join(""),
      });
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          htmlOutput: toRepoRelativePath(htmlOutput),
          overwrite: true,
          codeHighlight: true,
          runner,
        }),
      ).rejects.toThrow("Remote assets are disabled");

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
      expect(await readFile(outputPath, "utf8")).toBe("existing-pdf");
      expect(await readFile(htmlOutput, "utf8")).toBe("existing-html");
    });
  });
});
