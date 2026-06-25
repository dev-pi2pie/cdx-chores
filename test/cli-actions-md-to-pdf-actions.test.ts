import { describe, expect, test } from "bun:test";
import { mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { actionMdToPdf } from "../src/cli/actions";
import { CliError } from "../src/cli/errors";
import type { MarkdownPdfProcessRunner } from "../src/cli/markdown-pdf";
import { createPdfRunner, ok } from "./cli-actions-md-to-pdf.helpers";
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

  test("rejects missing custom template assets before rendering", async () => {
    await withTempFixtureDir("md-to-pdf-template-missing-asset", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customTemplate = join(fixtureDir, "template", "template.html");
      await mkdir(dirname(customTemplate), { recursive: true });
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customTemplate,
        '<html><body><img src="assets/missing.png">$body$</body></html>',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          template: toRepoRelativePath(customTemplate),
          runner,
        }),
      ).rejects.toThrow("Template asset path does not exist");

      expect(
        calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
      ).toBe(false);
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
    });
  });

  test("rejects custom template asset traversal before rendering", async () => {
    await withTempFixtureDir("md-to-pdf-template-asset-traversal", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customTemplate = join(fixtureDir, "template", "template.html");
      const outsideAsset = join(fixtureDir, "outside.png");
      await mkdir(dirname(customTemplate), { recursive: true });
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(outsideAsset, "outside", "utf8");
      await writeFile(
        customTemplate,
        '<html><body><img src="../outside.png">$body$</body></html>',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          template: toRepoRelativePath(customTemplate),
          runner,
        }),
      ).rejects.toThrow("Template asset path must stay inside");

      expect(
        calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
      ).toBe(false);
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
    });
  });

  test("rejects custom template absolute local asset references before rendering", async () => {
    const scenarios = [
      { label: "root-relative", reference: "/private/cover.png" },
      { label: "windows-absolute", reference: "C:\\private\\cover.png" },
      { label: "file-url", reference: "file:///private/cover.png" },
    ] as const;

    for (const scenario of scenarios) {
      await withTempFixtureDir(
        `md-to-pdf-template-absolute-asset-${scenario.label}`,
        async (fixtureDir) => {
          const inputPath = join(fixtureDir, "report.md");
          const customTemplate = join(fixtureDir, "template", "template.html");
          await mkdir(dirname(customTemplate), { recursive: true });
          await writeFile(inputPath, "# Report\n", "utf8");
          await writeFile(
            customTemplate,
            `<html><body><img src="${scenario.reference}">$body$</body></html>`,
            "utf8",
          );
          const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
          const { runtime } = createActionTestRuntime();

          await expect(
            actionMdToPdf(runtime, {
              input: toRepoRelativePath(inputPath),
              template: toRepoRelativePath(customTemplate),
              runner,
            }),
          ).rejects.toThrow("Template asset path must");

          expect(
            calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
          ).toBe(false);
          expect(
            calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
          ).toBe(false);
        },
      );
    }
  });

  test("rejects custom template asset references with Pandoc variables before rendering", async () => {
    await withTempFixtureDir("md-to-pdf-template-asset-variable", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const customTemplate = join(fixtureDir, "template", "template.html");
      await mkdir(dirname(customTemplate), { recursive: true });
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(
        customTemplate,
        '<html><body><img src="$if(cover)$assets/cover.png$endif$">$body$</body></html>',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          template: toRepoRelativePath(customTemplate),
          runner,
        }),
      ).rejects.toThrow("Template asset path must not contain Pandoc template variables");

      expect(
        calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
      ).toBe(false);
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
    });
  });

  test("rejects custom template asset symlink escapes before rendering", async () => {
    await withTempFixtureDir("md-to-pdf-template-asset-symlink", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const templateDir = join(fixtureDir, "template");
      const customTemplate = join(templateDir, "template.html");
      const linkAsset = join(templateDir, "assets", "cover.png");
      const outsideAsset = join(fixtureDir, "outside.png");
      await mkdir(dirname(linkAsset), { recursive: true });
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(outsideAsset, "outside", "utf8");
      await symlink(outsideAsset, linkAsset);
      await writeFile(
        customTemplate,
        '<html><body><img src="assets/cover.png">$body$</body></html>',
        "utf8",
      );
      const { calls, runner } = createPdfRunner({ html: "<html><body></body></html>" });
      const { runtime } = createActionTestRuntime();

      await expect(
        actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          template: toRepoRelativePath(customTemplate),
          runner,
        }),
      ).rejects.toThrow("Template asset path must stay inside");

      expect(
        calls.some((call) => call.command === "pandoc" && !call.args.includes("--version")),
      ).toBe(false);
      expect(
        calls.some((call) => call.command === "weasyprint" && !call.args.includes("--info")),
      ).toBe(false);
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
