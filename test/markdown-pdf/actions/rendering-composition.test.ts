import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { actionMdToPdf } from "../../../src/cli/actions";
import type { MarkdownPdfProcessRunner } from "../../../src/cli/markdown-pdf";
import { MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME } from "../../../src/cli/markdown-pdf/profile/page-number-format";
import { createPdfRunner, ok } from "../../cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime } from "../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../helpers/cli-test-utils";

describe("Markdown PDF rendering composition", () => {
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

      const { runner } = createPdfRunner({
        html: '<html><body><main class="document-body"></main></body></html>',
      });
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
      expect(combinedCss).toContain(
        `@bottom-center {\n    content: "Page " counter(${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME});`,
      );
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
      expect(pandocRender?.args[pandocRender.args.indexOf("--template") + 1]).not.toBe(
        customTemplate,
      );

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

  test("resolves existing template-local assets without moving the Markdown asset base", async () => {
    await withTempFixtureDir("md-to-pdf-template-local-assets", async (fixtureDir) => {
      const inputDir = join(fixtureDir, "docs");
      const templateDir = join(fixtureDir, "template-bundle");
      const inputPath = join(inputDir, "report.md");
      const customTemplate = join(templateDir, "template.html");
      const customCss = join(templateDir, "style.css");
      const templateAsset = join(templateDir, "assets", "cover.png");
      const templateAssetSmall = join(templateDir, "assets", "cover-small.png");
      const templateAssetComma = join(templateDir, "assets", "cover,v2.png");
      const templateAssetExtensionless = join(templateDir, "assets", "icon");
      const templateAssetExtensionless2x = join(templateDir, "assets", "icon@2x");
      const templateBackground = join(templateDir, "assets", "background.png");
      const templatePattern = join(templateDir, "assets", "pattern.png");
      const templateImport = join(templateDir, "assets", "print.css");
      const templateSvg = join(templateDir, "assets", "icon.svg");
      const markdownAsset = join(inputDir, "images", "body.png");
      await mkdir(dirname(inputPath), { recursive: true });
      await mkdir(dirname(templateAsset), { recursive: true });
      await mkdir(dirname(markdownAsset), { recursive: true });
      await writeFile(inputPath, "# Report\n\n![Body](images/body.png)\n", "utf8");
      await writeFile(
        customTemplate,
        [
          "<html><head>",
          '<style>@import url("assets/print.css") screen and (min-width: 900px); .hero { background-image: url("assets/background.png"); }</style>',
          "</head>",
          '<body style="background-image: url(assets/pattern.png)">',
          [
            '<img src="assets/cover.png"',
            ' srcset="data:image/png;base64,AAAA 1x, assets/cover-small.png 2x, assets/cover,v2.png 3x">',
          ].join(""),
          '<source srcset="assets/cover.png,assets/cover-small.png 2x">',
          '<source srcset="assets/icon 1x,assets/icon@2x 2x">',
          '<svg><use xlink:href="assets/icon.svg#logo"></use></svg>',
          "$body$",
          "</body></html>",
        ].join(""),
        "utf8",
      );
      await writeFile(customCss, "body { color: black; }\n", "utf8");
      await writeFile(templateAsset, "template-asset", "utf8");
      await writeFile(templateAssetSmall, "template-small-asset", "utf8");
      await writeFile(templateAssetComma, "template-comma-asset", "utf8");
      await writeFile(templateAssetExtensionless, "template-extensionless-asset", "utf8");
      await writeFile(templateAssetExtensionless2x, "template-extensionless-2x-asset", "utf8");
      await writeFile(templateBackground, "template-background", "utf8");
      await writeFile(templatePattern, "template-pattern", "utf8");
      await writeFile(templateImport, "body { color: black; }\n", "utf8");
      await writeFile(templateSvg, '<svg><symbol id="logo"></symbol></svg>', "utf8");
      await writeFile(markdownAsset, "markdown-asset", "utf8");

      const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
      let pandocTemplateHtml = "";
      let weasyprintHtml = "";
      let weasyprintBaseUrl = "";
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        calls.push({ command, args, cwd: runnerOptions?.cwd });
        if (command === "pandoc" && args.includes("--version")) {
          return ok("pandoc 3.1\n");
        }
        if (command === "weasyprint" && args.includes("--info")) {
          return ok("System: test\nWeasyPrint 68.0\n");
        }
        if (command === "pandoc") {
          const templatePath = args[args.indexOf("--template") + 1];
          const outputPath = args[args.indexOf("--output") + 1];
          if (!templatePath || !outputPath) {
            return { ok: false, code: 1, signal: null, stdout: "", stderr: "missing path" };
          }
          const rewrittenTemplate = await readFile(templatePath, "utf8");
          pandocTemplateHtml = rewrittenTemplate;
          await writeFile(
            outputPath,
            rewrittenTemplate.replace("$body$", '<img src="assets/cover.png" alt="Body">'),
            "utf8",
          );
          return ok();
        }
        if (command === "weasyprint" && !args.includes("--info")) {
          const baseUrlIndex = args.indexOf("--base-url");
          weasyprintBaseUrl = args[baseUrlIndex + 1] ?? "";
          const htmlPath = args.at(-2);
          if (htmlPath) {
            weasyprintHtml = await readFile(htmlPath, "utf8");
          }
          const outputPath = args.at(-1);
          if (outputPath) {
            await writeFile(outputPath, "%PDF-1.7\n", "utf8");
          }
          return ok();
        }
        return { ok: false, code: 1, signal: null, stdout: "", stderr: `unexpected ${command}` };
      };
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        template: toRepoRelativePath(customTemplate),
        css: toRepoRelativePath(customCss),
        runner: capturingRunner,
      });

      expect(weasyprintBaseUrl).toBe(inputDir);
      expect(weasyprintHtml).toContain(`src="${pathToFileURL(templateAsset).href}"`);
      expect(weasyprintHtml).toContain('src="assets/cover.png" alt="Body"');
      const pandocRender = calls.find(
        (call) => call.command === "pandoc" && !call.args.includes("--version"),
      );
      const templateRenderPath = pandocRender?.args[pandocRender.args.indexOf("--template") + 1];
      expect(templateRenderPath).toBeDefined();
      expect(templateRenderPath).not.toBe(customTemplate);
      expect(pandocTemplateHtml).toContain(`src="${pathToFileURL(templateAsset).href}"`);
      expect(pandocTemplateHtml).toContain(
        `@import url("${pathToFileURL(templateImport).href}") screen and (min-width: 900px);`,
      );
      expect(pandocTemplateHtml).toContain(
        `background-image: url("${pathToFileURL(templateBackground).href}")`,
      );
      expect(pandocTemplateHtml).toContain(
        `background-image: url(&quot;${pathToFileURL(templatePattern).href}&quot;)`,
      );
      expect(pandocTemplateHtml).toContain(
        [
          'srcset="data:image/png;base64,AAAA 1x,',
          `${pathToFileURL(templateAssetSmall).href} 2x,`,
          `${pathToFileURL(templateAssetComma).href} 3x"`,
        ].join(" "),
      );
      expect(pandocTemplateHtml).toContain(
        `srcset="${pathToFileURL(templateAsset).href}, ${pathToFileURL(templateAssetSmall).href} 2x"`,
      );
      expect(pandocTemplateHtml).toContain(
        `srcset="${pathToFileURL(templateAssetExtensionless).href} 1x, ${pathToFileURL(templateAssetExtensionless2x).href} 2x"`,
      );
      expect(pandocTemplateHtml).toContain(`xlink:href="${pathToFileURL(templateSvg).href}#logo"`);
      expectNoStderr();
    });
  });
});
