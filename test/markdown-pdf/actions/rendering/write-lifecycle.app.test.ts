import { describe, expect, test } from "bun:test";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { actionMdToPdf } from "../../../../src/cli/actions";
import { CliError } from "../../../../src/cli/errors";
import type { MarkdownPdfProcessRunner } from "../../../../src/cli/markdown-pdf";
import { createPdfRunner } from "./render-support";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../../helpers/cli-test-utils";

describe("Markdown PDF rendering write lifecycle", () => {
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
