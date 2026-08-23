import { describe, expect, test } from "bun:test";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { actionMdToPdf } from "../../../src/cli/actions";
import type { MarkdownPdfProcessRunner } from "../../../src/cli/markdown-pdf";
import { createPdfRunner } from "../../cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime, expectCliError } from "../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";

const ANSI_PATTERN = new RegExp(String.raw`\u001B\[[0-9;]*m`, "g");
const ANSI_START = `${String.fromCharCode(27)}[`;

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("Markdown PDF render bundle action integration", () => {
  test.each([
    {
      label: "profile-only",
      files: [["profile.yml", "page:\n  size: A4\n"]],
      expectedLines: ["- profile: profile.yml"],
    },
    {
      label: "template-only",
      files: [["template.html", "<html><body>$body$</body></html>\n"]],
      expectedLines: ["- template: template.html"],
    },
    {
      label: "stylesheet-only",
      files: [["style.css", "body { color: black; }\n"]],
      expectedLines: ["- css: style.css"],
    },
    {
      label: "partial",
      files: [
        ["template.html", "<html><body>$body$</body></html>\n"],
        ["style.css", "body { color: black; }\n"],
      ],
      expectedLines: ["- template: template.html", "- css: style.css"],
    },
    {
      label: "complete",
      files: [
        ["profile.yml", "page:\n  size: A4\n"],
        ["template.html", "<html><body>$body$</body></html>\n"],
        ["style.css", "body { color: black; }\n"],
        ["project.codex-report.json", "not-json\n"],
      ],
      expectedLines: ["- profile: profile.yml", "- template: template.html", "- css: style.css"],
    },
  ])("renders a $label bundle through the existing pipeline", async ({ files, expectedLines }) => {
    await withTempFixtureDir("md-pdf-render-bundle-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      for (const [filename, content] of files) {
        await writeFile(join(bundleDirectory, filename), content, "utf8");
      }
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        runner,
      });

      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expect(stdout.text).toContain("Resolved Markdown PDF bundle:");
      for (const line of expectedLines) {
        expect(stdout.text).toContain(line);
      }
      expect(stdout.text).toContain("Wrote PDF:");
      expect(
        calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
      ).toBe(true);
      expectNoStderr();
    });
  });

  test("uses explicit paths to resolve bundle conflicts and reports their provenance", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-explicit", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      const explicitTemplate = join(fixtureDir, "selected.html");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "compact.html"), "$body$\n", "utf8");
      await writeFile(join(bundleDirectory, "detailed.html"), "$body$\n", "utf8");
      await writeFile(join(bundleDirectory, "style.css"), "body {}\n", "utf8");
      await writeFile(explicitTemplate, "<html><body>$body$</body></html>\n", "utf8");
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        template: toRepoRelativePath(explicitTemplate),
        runner,
      });

      expect(stdout.text).toContain(
        `- template: ${toRepoRelativePath(explicitTemplate)} (explicit)`,
      );
      expect(stdout.text).toContain("- css: style.css");
      expectNoStderr();
    });
  });

  test("rejects unresolved conflicts before dependency probes or output writes", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-conflict", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutputPath = join(fixtureDir, "report.html");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "compact.html"), "$body$\n", "utf8");
      await writeFile(join(bundleDirectory, "detailed.html"), "$body$\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            htmlOutput: toRepoRelativePath(htmlOutputPath),
            bundle: toRepoRelativePath(bundleDirectory),
            runner,
          }),
        {
          code: "MARKDOWN_PDF_BUNDLE_AMBIGUOUS",
          exitCode: 2,
          messageIncludes: "Select one with --template <path>",
        },
      );

      expect(calls).toHaveLength(0);
      expect(await pathExists(outputPath)).toBe(false);
      expect(await pathExists(htmlOutputPath)).toBe(false);
      expectNoOutput();
    });
  });

  test("does not print a summary or probe dependencies when a selected profile is invalid", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-invalid", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutputPath = join(fixtureDir, "report.html");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "profile.yml"), "page: true\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          htmlOutput: toRepoRelativePath(htmlOutputPath),
          bundle: toRepoRelativePath(bundleDirectory),
          runner,
        }),
      ).rejects.toThrow("profile.page must be a plain object");

      expect(calls).toHaveLength(0);
      expect(await pathExists(outputPath)).toBe(false);
      expect(await pathExists(htmlOutputPath)).toBe(false);
      expectNoOutput();
    });
  });

  test("prints one stable warning for ignored files without creating a false conflict", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-ignored", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "profile.yml"), "page: {}\n", "utf8");
      await writeFile(join(bundleDirectory, "z-data.json"), '{"rows":[]}\n', "utf8");
      await writeFile(join(bundleDirectory, "a-broken.yml"), ":\n", "utf8");
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, stderr } = createActionTestRuntime();
      (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        runner,
      });

      expect(await pathExists(outputPath)).toBe(true);
      expect(stderr.text).toStartWith(
        "\u001b[1m\u001b[33mWarning:\u001b[39m\u001b[22m ignored unclassified YAML or JSON bundle files:\n",
      );
      expect(stderr.text.replace(ANSI_PATTERN, "")).toBe(
        [
          "Warning: ignored unclassified YAML or JSON bundle files:",
          "- a-broken.yml",
          "- z-data.json",
          "",
        ].join("\n"),
      );
      expect(stderr.text.split("\n")[1]).not.toContain(ANSI_START);
      expect(stderr.text.split("\n")[2]).not.toContain(ANSI_START);

      const plainOutputPath = join(fixtureDir, "report-plain.pdf");
      const plainRuntime = createActionTestRuntime();
      const { runner: plainRunner } = createPdfRunner({
        html: "<html><body>Plain report</body></html>",
      });
      await actionMdToPdf(plainRuntime.runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(plainOutputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        runner: plainRunner,
      });
      expect(plainRuntime.stderr.text).toBe(
        [
          "Warning: ignored unclassified YAML or JSON bundle files:",
          "- a-broken.yml",
          "- z-data.json",
          "",
        ].join("\n"),
      );
      expect(plainRuntime.stderr.text).not.toContain(ANSI_START);
    });
  });

  test("keeps an explicitly selected in-bundle empty profile compatible without a warning", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-explicit-empty", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      const explicitProfilePath = join(bundleDirectory, "empty-profile.json");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(explicitProfilePath, "{}\n", "utf8");
      await writeFile(join(bundleDirectory, "template.html"), "$body$\n", "utf8");
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        profile: toRepoRelativePath(explicitProfilePath),
        runner,
      });

      expect(await pathExists(outputPath)).toBe(true);
      expectNoStderr();
    });
  });

  test("lets an explicit profile bypass invalid bundle profile admission", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-explicit-bypass", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const explicitProfilePath = join(fixtureDir, "selected-profile.yml");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(explicitProfilePath, "page: {}\n", "utf8");
      await writeFile(join(bundleDirectory, "broken-profile.yml"), "page: true\n", "utf8");
      await writeFile(join(bundleDirectory, "template.html"), "$body$\n", "utf8");
      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        profile: toRepoRelativePath(explicitProfilePath),
        runner,
      });

      expect(await pathExists(outputPath)).toBe(true);
      expectNoStderr();
    });
  });

  if (process.platform !== "win32") {
    test("does not read unused bundle profiles after an explicit profile resolves the role", async () => {
      await withTempFixtureDir(
        "md-pdf-render-bundle-action-unreadable-profile",
        async (fixtureDir) => {
          const inputPath = join(fixtureDir, "report.md");
          const outputPath = join(fixtureDir, "report.pdf");
          const explicitProfilePath = join(fixtureDir, "selected-profile.yml");
          const bundleDirectory = join(fixtureDir, "bundle");
          const unusedProfilePath = join(bundleDirectory, "unused-profile.yml");
          await mkdir(bundleDirectory);
          await writeFile(inputPath, "# Report\n", "utf8");
          await writeFile(explicitProfilePath, "page: {}\n", "utf8");
          await writeFile(unusedProfilePath, "page: {}\n", "utf8");
          await writeFile(join(bundleDirectory, "template.html"), "$body$\n", "utf8");
          await chmod(unusedProfilePath, 0o000);
          const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
          const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

          try {
            await actionMdToPdf(runtime, {
              input: toRepoRelativePath(inputPath),
              output: toRepoRelativePath(outputPath),
              bundle: toRepoRelativePath(bundleDirectory),
              profile: toRepoRelativePath(explicitProfilePath),
              runner,
            });
          } finally {
            await chmod(unusedProfilePath, 0o600);
          }

          expect(await pathExists(outputPath)).toBe(true);
          expect(stdout.text).toContain("- profile:");
          expect(stdout.text).toContain("(explicit)");
          expect(stdout.text).toContain("- template: template.html");
          expect(stdout.text).not.toContain("unused-profile.yml");
          expectNoStderr();
        },
      );
    });
  }

  test("keeps unclassified-only failures side-effect free and emits no separate warning", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-unclassified", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutputPath = join(fixtureDir, "report.html");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(join(bundleDirectory, "data.json"), '{"rows":[]}\n', "utf8");
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            output: toRepoRelativePath(outputPath),
            htmlOutput: toRepoRelativePath(htmlOutputPath),
            bundle: toRepoRelativePath(bundleDirectory),
            runner,
          }),
        {
          code: "MARKDOWN_PDF_BUNDLE_EMPTY",
          exitCode: 2,
          messageIncludes: "- data.json",
        },
      );

      expect(calls).toHaveLength(0);
      expect(await pathExists(outputPath)).toBe(false);
      expect(await pathExists(htmlOutputPath)).toBe(false);
      expectNoOutput();
    });
  });

  test("preserves profile overrides, CSS order, and template-relative managed assets", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-complete", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const bundleDirectory = join(fixtureDir, "bundle");
      const templatePath = join(bundleDirectory, "template.html");
      const cssPath = join(bundleDirectory, "style.css");
      const coverPath = join(bundleDirectory, "assets", "cover.png");
      await mkdir(join(bundleDirectory, "assets"), { recursive: true });
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        join(bundleDirectory, "profile.yml"),
        "page:\n  orientation: portrait\n",
        "utf8",
      );
      await writeFile(
        templatePath,
        '<html><body><img src="assets/cover.png">$body$</body></html>\n',
        "utf8",
      );
      await writeFile(cssPath, ".bundle-style { color: black; }\n", "utf8");
      await writeFile(coverPath, "cover", "utf8");
      const renderedStyles: string[] = [];
      let rewrittenTemplate = "";
      const { calls, runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        if (command === "pandoc" && !args.includes("--version")) {
          const selectedTemplate = args[args.indexOf("--template") + 1];
          if (selectedTemplate) {
            rewrittenTemplate = await readFile(selectedTemplate, "utf8");
          }
        }
        if (command === "weasyprint" && !args.includes("--info")) {
          const stylesheetIndexes = args
            .map((argument, index) => (argument === "--stylesheet" ? index : -1))
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
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        bundle: toRepoRelativePath(bundleDirectory),
        orientation: "landscape",
        runner: capturingRunner,
      });

      expect(rewrittenTemplate).toContain(`src="${pathToFileURL(coverPath).href}"`);
      expect(renderedStyles.join("\n")).toContain("size: A4 landscape");
      expect(renderedStyles.at(-1)).toContain(".bundle-style");
      const weasyprintCall = calls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      expect(weasyprintCall?.args).toContain(cssPath);
      expectNoStderr();
    });
  });

  test("preserves no-default-css and code-highlight overrides for bundle inputs", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-action-overrides", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutput = join(fixtureDir, "report.html");
      const bundleDirectory = join(fixtureDir, "bundle");
      const cssPath = join(bundleDirectory, "style.css");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n\n```js\nconst x = 1; // [!code ++]\n```\n", "utf8");
      await writeFile(
        join(bundleDirectory, "profile.yml"),
        "code:\n  highlight: true\n  transformerNotation: true\n",
        "utf8",
      );
      await writeFile(cssPath, ".bundle-style { color: black; }\n", "utf8");
      const html =
        '<html><body><pre><code class="language-js">const x = 1; // [!code ++]</code></pre></body></html>';
      const { calls, runner } = createPdfRunner({ html });
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        htmlOutput: toRepoRelativePath(htmlOutput),
        bundle: toRepoRelativePath(bundleDirectory),
        noDefaultCss: true,
        codeHighlight: false,
        runner,
      });

      expect(await readFile(htmlOutput, "utf8")).toBe(html);
      const weasyprintCall = calls.find(
        (call) => call.command === "weasyprint" && !call.args.includes("--info"),
      );
      expect(weasyprintCall?.args.filter((argument) => argument === "--stylesheet")).toHaveLength(
        1,
      );
      expect(weasyprintCall?.args).toContain(cssPath);
      expectNoStderr();
    });
  });

  test("finalizes logical page totals for a bundle-resolved Project profile and Template", async () => {
    await withTempFixtureDir("md-pdf-render-bundle-logical-total", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const htmlOutput = join(fixtureDir, "report.html");
      const bundleDirectory = join(fixtureDir, "bundle");
      await mkdir(bundleDirectory);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        join(bundleDirectory, "profile.yml"),
        [
          "pageNumbers:",
          "  enabled: true",
          "  scope: body",
          "  countFrom: body",
          '  format: "{page} / {pages}"',
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        join(bundleDirectory, "template.html"),
        '<html><body><main class="document-body">$body$</main></body></html>\n',
        "utf8",
      );
      await writeFile(join(bundleDirectory, "style.css"), "body { color: black; }\n", "utf8");
      const { runner } = createPdfRunner({
        html: '<html><body><main class="document-body">Report</main></body></html>',
      });
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        bundle: toRepoRelativePath(bundleDirectory),
        htmlOutput: toRepoRelativePath(htmlOutput),
        input: toRepoRelativePath(inputPath),
        output: toRepoRelativePath(outputPath),
        runner,
      });

      expect(await readFile(htmlOutput, "utf8")).toContain('id="cdx-markdown-pdf-logical-final"');
      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expectNoStderr();
    });
  });
});
