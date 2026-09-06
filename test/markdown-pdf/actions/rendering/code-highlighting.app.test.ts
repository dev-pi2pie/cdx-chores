import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../../../../src/cli/actions";
import type { MarkdownPdfProcessRunner } from "../../../../src/cli/markdown-pdf";
import { createPdfRunner } from "./render-support";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../../helpers/cli-test-utils";

describe("Markdown PDF rendering code highlighting", () => {
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
        '<html><body><pre><code class="language-js">const x = 1; // [!code ++]</code></pre></body></html>';
      await writeFile(inputPath, "# Report\n\n```js\nconst x = 1; // [!code ++]\n```\n", "utf8");
      await writeFile(
        profilePath,
        ["code:", "  highlight: true", "  transformerNotation: true", ""].join("\n"),
        "utf8",
      );

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
      expect(await readFile(htmlOutput, "utf8")).toContain("[!code ++]");
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });
});
