import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { actionMdPdfProfileInit, actionMdPdfTemplateInit, actionMdToPdf } from "../src/cli/actions";
import {
  createMarkdownPdfRecipe,
  normalizeMarkdownPdfProfile,
  normalizeMarkdownPdfOptions,
  readMarkdownPdfProfileFile,
  type MarkdownPdfProcessRunner,
} from "../src/cli/markdown-pdf";
import type { ExecCommandResult } from "../src/cli/process";
import { createActionTestRuntime, expectCliError } from "./helpers/cli-action-test-utils";
import { runCli, toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

function ok(stdout = "", stderr = ""): ExecCommandResult {
  return {
    ok: true,
    code: 0,
    signal: null,
    stdout,
    stderr,
  };
}

function failing(stderr: string): ExecCommandResult {
  return {
    ok: false,
    code: 1,
    signal: null,
    stdout: "",
    stderr,
  };
}

function createPdfRunner(options: {
  html: string;
  weasyprintStderr?: string;
  failPandoc?: boolean;
  failWeasyprint?: boolean;
}) {
  const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const runner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
    calls.push({ command, args, cwd: runnerOptions?.cwd });

    if (command === "pandoc" && args.includes("--version")) {
      return ok("pandoc 3.1\n");
    }
    if (command === "weasyprint" && args.includes("--info")) {
      return ok("System: test\nWeasyPrint 68.0\n");
    }
    if (command === "pandoc") {
      if (options.failPandoc) {
        return failing("pandoc render failed");
      }
      const outputIndex = args.indexOf("--output");
      const htmlOutput = args[outputIndex + 1];
      if (!htmlOutput) {
        return failing("missing output");
      }
      await mkdir(dirname(htmlOutput), { recursive: true });
      await writeFile(htmlOutput, options.html, "utf8");
      return ok();
    }
    if (command === "weasyprint") {
      if (options.failWeasyprint) {
        return failing("render failed");
      }
      const outputPath = args.at(-1);
      if (!outputPath) {
        return failing("missing pdf output");
      }
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, "%PDF-1.7\n", "utf8");
      return ok("", options.weasyprintStderr);
    }

    return failing(`unexpected command: ${command}`);
  };

  return { calls, runner };
}

function createRemoteInlineCssHtml(): string {
  return [
    "<html><head>",
    '<style>@import url("https://example.com/print.css");</style>',
    "</head><body>",
    '<div style="background-image: url(https://example.com/banner.png)">Report</div>',
    "</body></html>",
  ].join("");
}

describe("markdown PDF option normalization", () => {
  test("normalizes default article options", () => {
    const options = normalizeMarkdownPdfOptions();

    expect(options).toMatchObject({
      preset: "article",
      pageSize: "A4",
      orientation: "portrait",
      toc: false,
      tocDepth: 3,
      tocPageBreak: "auto",
      allowRemoteAssets: false,
    });
    expect(options.margins).toEqual({
      top: "18mm",
      right: "18mm",
      bottom: "18mm",
      left: "18mm",
    });
  });

  test("applies wide-table preset defaults and margin overrides", () => {
    const options = normalizeMarkdownPdfOptions({
      preset: "wide-table",
      marginX: "14mm",
      marginTop: "1in",
    });

    expect(options.orientation).toBe("landscape");
    expect(options.margins).toEqual({
      top: "1in",
      right: "14mm",
      bottom: "12mm",
      left: "14mm",
    });
  });

  test("rejects arbitrary CSS margin expressions", () => {
    expect(() => normalizeMarkdownPdfOptions({ margin: "calc(1cm + 2mm)" })).toThrow(
      "--margin must be a CSS length",
    );
  });

  test("rejects invalid ToC depth", () => {
    expect(() => normalizeMarkdownPdfOptions({ tocDepth: 0 })).toThrow(
      "ToC depth must be an integer from 1 to 6",
    );
  });
});

describe("markdown PDF profile normalization", () => {
  test("merges profile metadata, frontmatter metadata, and CLI metadata overrides", () => {
    const result = normalizeMarkdownPdfProfile({
      profile: {
        page: {
          size: "Letter",
          margin: "12mm",
        },
        metadata: {
          company: "Example Co.",
          author: "Profile Author",
        },
        header: {
          left: "{company}",
          right: "{title}",
        },
        pageNumbers: {
          enabled: true,
        },
      },
      frontmatter: {
        title: "Quarterly Report",
        author: "Frontmatter Author",
      },
      meta: ["author=Noname"],
    });

    expect(result.recipeOptions).toMatchObject({
      pageSize: "Letter",
      margin: "12mm",
    });
    expect(result.profile.metadata).toMatchObject({
      company: "Example Co.",
      title: "Quarterly Report",
      author: "Noname",
    });
    expect(result.profile.header.left).toBe("{company}");
    expect(result.profile.pageNumbers).toMatchObject({
      enabled: true,
      position: "bottom-center",
      format: "{page}",
      scope: "body",
    });
  });

  test("rejects unknown profile keys", async () => {
    await withTempFixtureDir("md-pdf-profile-parse", async (fixtureDir) => {
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(profilePath, "page:\n  unexpected: true\n", "utf8");

      await expectCliError(() => readMarkdownPdfProfileFile(profilePath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Unknown Markdown PDF profile key: profile.page.unexpected",
      });
    });
  });

  test("loads JSON profiles and rejects top-level unknown keys", async () => {
    await withTempFixtureDir("md-pdf-profile-parse", async (fixtureDir) => {
      const jsonProfilePath = join(fixtureDir, "pdf-profile.json");
      const invalidProfilePath = join(fixtureDir, "invalid-profile.json");
      await writeFile(
        jsonProfilePath,
        JSON.stringify({
          page: {
            size: "Letter",
          },
          pageNumbers: {
            enabled: true,
          },
        }),
        "utf8",
      );
      await writeFile(invalidProfilePath, JSON.stringify({ unknown: true }), "utf8");

      const profile = await readMarkdownPdfProfileFile(jsonProfilePath);
      expect(profile.page).toEqual({ size: "Letter" });

      await expectCliError(() => readMarkdownPdfProfileFile(invalidProfilePath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Unknown Markdown PDF profile key: profile.unknown",
      });
    });
  });

  test("rejects malformed profile content and non-object roots", async () => {
    await withTempFixtureDir("md-pdf-profile-parse", async (fixtureDir) => {
      const malformedJsonPath = join(fixtureDir, "malformed.json");
      const arrayYamlPath = join(fixtureDir, "array.yml");
      await writeFile(malformedJsonPath, "{", "utf8");
      await writeFile(arrayYamlPath, "- page\n", "utf8");

      await expectCliError(() => readMarkdownPdfProfileFile(malformedJsonPath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Failed to parse Markdown PDF profile JSON",
      });
      await expectCliError(() => readMarkdownPdfProfileFile(arrayYamlPath), {
        code: "INVALID_INPUT",
        exitCode: 2,
        messageIncludes: "Markdown PDF profile must be a plain object",
      });
    });
  });
});

describe("markdown PDF recipe generation", () => {
  test("generates report ToC page break CSS by default", () => {
    const recipe = createMarkdownPdfRecipe(
      normalizeMarkdownPdfOptions({ preset: "report", toc: true }),
    );

    expect(recipe.templateHtml).toContain("$body$");
    expect(recipe.templateHtml).toContain("$toc$");
    expect(recipe.styleCss).toContain("size: A4 portrait");
    expect(recipe.styleCss).toContain("break-after: page");
  });

  test("honors explicit no ToC page break", () => {
    const recipe = createMarkdownPdfRecipe(
      normalizeMarkdownPdfOptions({ preset: "report", toc: true, tocPageBreak: "none" }),
    );

    expect(recipe.styleCss).not.toContain("break-after: page");
  });

  test("generates profile page chrome and page numbers", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        metadata: {
          company: "Example Co.",
          title: "Quarterly Report",
        },
        header: {
          left: "{company}",
          right: "{title}",
        },
        footer: {
          left: "{author}",
        },
        pageNumbers: {
          enabled: true,
          format: "Page {page}",
        },
      },
      frontmatter: {
        author: "Noname",
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions({ toc: true }), {
      profile: normalizedProfile.profile,
    });

    expect(recipe.styleCss).toContain('@top-left {\n    content: "Example Co.";');
    expect(recipe.styleCss).toContain('@top-right {\n    content: "Quarterly Report";');
    expect(recipe.styleCss).toContain('@bottom-left {\n    content: "Noname";');
    expect(recipe.styleCss).toContain('@bottom-center {\n    content: "Page " counter(page);');
    expect(recipe.styleCss).toContain("@page toc");
    expect(recipe.styleCss).not.toContain("counter(pages)");
  });

  test("keeps page numbers disabled by default", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {},
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
    });

    expect(recipe.styleCss).not.toContain("counter(page)");
    expect(recipe.styleCss).not.toContain("@bottom-center");
  });

  test("honors explicit page-number positions", () => {
    const normalizedProfile = normalizeMarkdownPdfProfile({
      profile: {
        pageNumbers: {
          enabled: true,
          position: "top-right",
          format: "{page}",
        },
      },
    });
    const recipe = createMarkdownPdfRecipe(normalizeMarkdownPdfOptions(), {
      profile: normalizedProfile.profile,
    });

    expect(recipe.styleCss).toContain("@top-right {\n    content: counter(page);");
    expect(recipe.styleCss).not.toContain("@bottom-center");
  });
});

describe("cli action modules: md to-pdf", () => {
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

  test("blocks remote CSS assets by default", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customCss = join(fixtureDir, "remote.css");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customCss,
        '@import "https://example.com/print.css";\n.logo { background: url("https://example.com/logo.png"); }\n',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      const error = await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            css: toRepoRelativePath(customCss),
            runner,
          }),
        {
          code: "REMOTE_ASSET_BLOCKED",
          exitCode: 2,
          messageIncludes: "https://example.com/print.css",
        },
      );

      expect(error.message).toContain("https://example.com/logo.png");
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
      expectNoOutput();
    });
  });

  test("blocks remote assets in inline HTML CSS by default", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: createRemoteInlineCssHtml() });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      const error = await expectCliError(
        () => actionMdToPdf(runtime, { input: toRepoRelativePath(inputPath), runner }),
        {
          code: "REMOTE_ASSET_BLOCKED",
          exitCode: 2,
          messageIncludes: "https://example.com/print.css",
        },
      );

      expect(error.message).toContain("https://example.com/banner.png");
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
      expectNoOutput();
    });
  });

  test("allows remote assets in inline HTML CSS with explicit opt in", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n", "utf8");
      const { calls, runner } = createPdfRunner({ html: createRemoteInlineCssHtml() });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        allowRemoteAssets: true,
        runner,
      });

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(true);
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });

  test("allows remote CSS assets with explicit opt in", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customCss = join(fixtureDir, "remote.css");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customCss,
        '@import "https://example.com/print.css";\n.logo { background: url("https://example.com/logo.png"); }\n',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        css: toRepoRelativePath(customCss),
        allowRemoteAssets: true,
        runner,
      });

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(true);
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });

  test("blocks non-local asset schemes by default", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customCss = join(fixtureDir, "remote.css");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customCss,
        '.remote { background: url("ftp://example.com/logo.png"); }\n.protocol { background: url("//example.com/banner.png"); }\n',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      const error = await expectCliError(
        () =>
          actionMdToPdf(runtime, {
            input: toRepoRelativePath(inputPath),
            css: toRepoRelativePath(customCss),
            runner,
          }),
        {
          code: "REMOTE_ASSET_BLOCKED",
          exitCode: 2,
          messageIncludes: "ftp://example.com/logo.png",
        },
      );

      expect(error.message).toContain("//example.com/banner.png");
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
      expectNoOutput();
    });
  });

  test("allows local file and data asset URLs by default", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customCss = join(fixtureDir, "local.css");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customCss,
        '.data { background: url("data:image/png;base64,AAAA"); }\n.file { background: url("file:///tmp/logo.png"); }\n',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({
        html: '<html><body><img src="file:///tmp/chart.png"></body></html>',
      });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        css: toRepoRelativePath(customCss),
        runner,
      });

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(true);
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
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

  test("blocks remote image assets by default", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n\n![Remote](https://example.com/chart.png)\n", "utf8");
      const { calls, runner } = createPdfRunner({
        html: '<html><body><img src="https://example.com/chart.png"></body></html>',
      });
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () => actionMdToPdf(runtime, { input: toRepoRelativePath(inputPath), runner }),
        {
          code: "REMOTE_ASSET_BLOCKED",
          exitCode: 2,
          messageIncludes: "Remote assets are disabled by default",
        },
      );

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
      expectNoOutput();
    });
  });

  test("allows remote image assets with explicit opt in", async () => {
    await withTempFixtureDir("md-to-pdf-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      await writeFile(inputPath, "# Report\n\n![Remote](https://example.com/chart.png)\n", "utf8");
      const { calls, runner } = createPdfRunner({
        html: '<html><body><img src="https://example.com/chart.png"></body></html>',
      });
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        allowRemoteAssets: true,
        runner,
      });

      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(true);
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });
});

describe("cli action modules: md pdf-template init", () => {
  test("writes default template files", async () => {
    await withTempFixtureDir("md-pdf-template-action", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdPdfTemplateInit(runtime, {
        output: toRepoRelativePath(outputDir),
        preset: "reader",
      });

      expect(await readFile(join(outputDir, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputDir, "style.css"), "utf8")).toContain("size: A4 portrait");
      expect(stdout.text).toContain("Wrote Markdown PDF template:");
      expectNoStderr();
    });
  });

  test("refuses a non-empty template directory without overwrite", async () => {
    await withTempFixtureDir("md-pdf-template-action", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      await mkdir(outputDir, { recursive: true });
      await writeFile(join(outputDir, "template.html"), "old", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () => actionMdPdfTemplateInit(runtime, { output: toRepoRelativePath(outputDir) }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Template output directory is not empty",
        },
      );

      expectNoOutput();
    });
  });

  test("overwrites existing recipe files with overwrite", async () => {
    await withTempFixtureDir("md-pdf-template-action", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      await mkdir(outputDir, { recursive: true });
      await writeFile(join(outputDir, "template.html"), "old", "utf8");
      await writeFile(join(outputDir, "style.css"), "old", "utf8");
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdPdfTemplateInit(runtime, {
        output: toRepoRelativePath(outputDir),
        overwrite: true,
      });

      expect(await readFile(join(outputDir, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputDir, "style.css"), "utf8")).toContain("@page");
      expectNoStderr();
    });
  });
});

describe("cli action modules: md pdf-profile init", () => {
  test("writes a default YAML profile file", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.yml");
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdPdfProfileInit(runtime, {
        output: toRepoRelativePath(outputPath),
      });

      const profile = await readFile(outputPath, "utf8");
      expect(profile).toContain("page:");
      expect(profile).toContain("pageNumbers:");
      expect(profile).toContain("enabled: false");
      expect(stdout.text).toContain("Wrote Markdown PDF profile:");
      expectNoStderr();
    });
  });

  test("writes a JSON profile file with preset-derived values", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.json");
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdPdfProfileInit(runtime, {
        output: toRepoRelativePath(outputPath),
        preset: "wide-table",
      });

      const profile = JSON.parse(await readFile(outputPath, "utf8")) as {
        page: { orientation: string; marginTop: string };
      };
      expect(profile.page.orientation).toBe("landscape");
      expect(profile.page.marginTop).toBe("12mm");
      expectNoStderr();
    });
  });

  test("rejects unknown profile extensions", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.txt");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdPdfProfileInit(runtime, {
            output: toRepoRelativePath(outputPath),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "must end with .yml, .yaml, or .json",
        },
      );

      expectNoOutput();
    });
  });

  test("refuses an existing profile file without overwrite", async () => {
    await withTempFixtureDir("md-pdf-profile-action", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(outputPath, "existing", "utf8");
      const { runtime, expectNoOutput } = createActionTestRuntime();

      await expectCliError(
        () =>
          actionMdPdfProfileInit(runtime, {
            output: toRepoRelativePath(outputPath),
          }),
        {
          code: "OUTPUT_EXISTS",
          exitCode: 2,
          messageIncludes: "Output file already exists",
        },
      );

      expectNoOutput();
    });
  });
});

describe("cli command: md to-pdf", () => {
  test("forwards --profile to the action layer", async () => {
    await withTempFixtureDir("md-to-pdf-cli", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(profilePath, "unknown: true\n", "utf8");

      const result = runCli([
        "md",
        "to-pdf",
        "--input",
        toRepoRelativePath(inputPath),
        "--profile",
        toRepoRelativePath(profilePath),
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Unknown Markdown PDF profile key: profile.unknown");
    });
  });
});

describe("cli command: md pdf-template init", () => {
  test("writes a template recipe from the command layer", async () => {
    await withTempFixtureDir("md-pdf-template-cli", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      const result = runCli([
        "md",
        "pdf-template",
        "init",
        "--output",
        toRepoRelativePath(outputDir),
        "--preset",
        "report",
        "--toc",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Wrote Markdown PDF template:");
      expect(await readFile(join(outputDir, "style.css"), "utf8")).toContain("break-after: page");
    });
  });

  test("rejects invalid margin at the command layer", async () => {
    await withTempFixtureDir("md-pdf-template-cli", async (fixtureDir) => {
      const outputDir = join(fixtureDir, "pdf-template");
      const result = runCli([
        "md",
        "pdf-template",
        "init",
        "--output",
        toRepoRelativePath(outputDir),
        "--margin",
        "1rem",
      ]);

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("--margin must be a CSS length");
    });
  });
});

describe("cli command: md pdf-profile init", () => {
  test("writes a profile file from the command layer", async () => {
    await withTempFixtureDir("md-pdf-profile-cli", async (fixtureDir) => {
      const outputPath = join(fixtureDir, "pdf-profile.yml");
      const result = runCli([
        "md",
        "pdf-profile",
        "init",
        "--output",
        toRepoRelativePath(outputPath),
        "--preset",
        "report",
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Wrote Markdown PDF profile:");
      expect(await readFile(outputPath, "utf8")).toContain("pageNumbers:");
    });
  });
});
