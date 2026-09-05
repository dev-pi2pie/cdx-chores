import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../../../../src/cli/actions";
import type { MarkdownPdfProcessRunner } from "../../../../src/cli/markdown-pdf";
import { MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME } from "../../../../src/cli/markdown-pdf/profile/page-number-format";
import { synthesizeMdPdfTemplateCodex } from "../../../../src/cli/markdown-pdf/template-codex";
import { createPdfRunner } from "./render-support";
import {
  createSynthesisOutputPlan,
  createSynthesisSignals,
} from "../template-codex/template-synthesis-fixtures";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../../../helpers/cli-test-utils";

describe("cli action modules: md to-pdf profile rendering", () => {
  test.each([
    {
      directOverride: true,
      label: "direct enable",
      profileSource: undefined,
    },
    {
      directOverride: undefined,
      label: "Profile enable",
      profileSource: "pageNumbers:\n  enabled: true\n  format: Page {page}\n",
    },
  ])("passes effective page-number CSS to the renderer for $label", async (scenario) => {
    await withTempFixtureDir("md-to-pdf-effective-page-number-render", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "report.pdf");
      const profilePath = join(fixtureDir, "profile.yml");
      const renderedStyles: string[] = [];
      await writeFile(inputPath, "# Report\n", "utf8");
      if (scenario.profileSource) {
        await writeFile(profilePath, scenario.profileSource, "utf8");
      }
      const { runner } = createPdfRunner({
        html: '<html><body><main class="document-body">Report</main></body></html>',
      });
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
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
        profile: scenario.profileSource ? toRepoRelativePath(profilePath) : undefined,
        pageNumbers: scenario.directOverride,
        runner: capturingRunner,
      });

      expect(renderedStyles).toHaveLength(1);
      expect(renderedStyles[0]).toContain(
        `counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 1;`,
      );
      expect(renderedStyles[0]).toContain(`counter(${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME})`);
      if (scenario.profileSource) {
        expect(renderedStyles[0]).toContain(
          `content: "Page " counter(${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME});`,
        );
      }
      expect(await readFile(outputPath, "utf8")).toContain("%PDF");
      expectNoStderr();
    });
  });

  test("loads cover and font profile settings into generated recipe files", async () => {
    await withTempFixtureDir("md-to-pdf-profile-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "mixed-report.md");
      const htmlOutput = join(fixtureDir, "mixed-report.render.html");
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      const renderedStyles: string[] = [];
      let renderedTemplate = "";
      let pandocInputMarkdown = "";
      await writeFile(
        inputPath,
        [
          "---",
          "title: Mixed Language Report",
          "subtitle: Runtime Notes",
          "author: Noname",
          "company: Example Co.",
          "date: 2026-08-15",
          "pdf:",
          "  content-langs:",
          "    - zh-Hant",
          "    - ja",
          "---",
          "# Report",
          "",
          "Latin text with [日本語]{lang=ja} and [繁體中文]{lang=zh-Hant}.",
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        profilePath,
        [
          "cover:",
          "  enabled: true",
          "  style: report",
          "fonts:",
          "  body:",
          '    default: "Source Serif 4"',
          '    zh-Hant: "Noto Serif TC"',
          '    ja: "Noto Serif JP"',
          "  code:",
          '    default: "JetBrains Mono"',
          '    symbols: "JetBrainsMono Nerd Font"',
          "",
        ].join("\n"),
        "utf8",
      );

      const { runner } = createPdfRunner({
        html: '<html><body><span lang="ja">日本語</span><span lang="zh-Hant">繁體中文</span></body></html>',
      });
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        if (command === "pandoc" && !args.includes("--version")) {
          const inputArg = args[0];
          if (inputArg) {
            pandocInputMarkdown = await readFile(inputArg, "utf8");
          }
          const templatePath = args[args.indexOf("--template") + 1];
          if (templatePath) {
            renderedTemplate = await readFile(templatePath, "utf8");
          }
        }
        if (command === "weasyprint" && !args.includes("--info")) {
          const commandStyles: string[] = [];
          const stylesheetIndexes = args
            .map((arg, index) => (arg === "--stylesheet" ? index : -1))
            .filter((index) => index >= 0);
          for (const index of stylesheetIndexes) {
            const stylesheetPath = args[index + 1];
            if (stylesheetPath) {
              const css = await readFile(stylesheetPath, "utf8");
              commandStyles.push(css);
              renderedStyles.push(css);
            }
          }
          const result = await runner(command, args, runnerOptions);
          return commandStyles.some((css) => css.includes("100vh"))
            ? {
                ...result,
                stderr: "WARNING: Ignored `min-height: 100vh`, invalid value.",
              }
            : result;
        }
        return runner(command, args, runnerOptions);
      };
      const { runtime, stdout, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        htmlOutput: toRepoRelativePath(htmlOutput),
        toc: true,
        runner: capturingRunner,
      });

      const combinedCss = renderedStyles.join("\n");
      const renderedHtml = await readFile(htmlOutput, "utf8");
      expect(pandocInputMarkdown).toContain("[日本語]{lang=ja}");
      expect(renderedHtml).toContain('<span lang="ja">日本語</span>');
      expect(renderedHtml).toContain('<span lang="zh-Hant">繁體中文</span>');
      expect(renderedTemplate).toContain('class="pdf-cover pdf-cover--report"');
      expect(renderedTemplate).toContain("Mixed Language Report");
      expect(renderedTemplate).toContain("Runtime Notes");
      expect(renderedTemplate.indexOf('class="pdf-cover pdf-cover--report"')).toBeLessThan(
        renderedTemplate.indexOf('<nav id="TOC" role="doc-toc">'),
      );
      expect(renderedTemplate.indexOf('<nav id="TOC" role="doc-toc">')).toBeLessThan(
        renderedTemplate.indexOf('<main class="document-body">'),
      );
      expect(renderedTemplate).not.toContain('class="document-title"');
      expect(renderedTemplate.match(/Example Co\./g)).toHaveLength(1);
      expect(renderedTemplate).toContain('<p class="pdf-cover__company">Example Co.</p>');
      expect(renderedTemplate).toContain('<p class="pdf-cover__meta">Noname | 2026-08-15</p>');
      expect(combinedCss).toContain("@page cover");
      const coverCss = combinedCss.slice(combinedCss.indexOf("@page cover"));
      expect(coverCss).toContain("@top-left {\n    content: none;");
      expect(coverCss).toContain("@bottom-center {\n    content: none;");
      expect(combinedCss).toContain(".pdf-cover--report .pdf-cover__content");
      expect(combinedCss).toContain("min-height: 297mm;");
      expect(combinedCss).not.toContain("\n  height: 297mm;");
      expect(combinedCss).not.toContain("100vh");
      expect(combinedCss).toContain(
        'font-family: "Source Serif 4", "Noto Serif TC", "Noto Serif JP", serif;',
      );
      expect(combinedCss).toContain(":lang(ja)");
      expect(combinedCss).toContain(
        'font-family: "JetBrains Mono", "JetBrainsMono Nerd Font", monospace;',
      );
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });

  test("passes Profile CSS before competing generated Template CSS", async () => {
    await withTempFixtureDir("md-to-pdf-profile-template-cascade", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "profile.yml");
      const templateCssPath = join(fixtureDir, "style.css");
      const renderedStyles: string[] = [];
      const synthesis = synthesizeMdPdfTemplateCodex({
        outputPlan: createSynthesisOutputPlan(),
        signals: createSynthesisSignals({ preset: "article" }),
      });
      await writeFile(inputPath, "# Report\n\nBody.\n", "utf8");
      await writeFile(
        profilePath,
        [
          "pdf:",
          "  content-langs:",
          "    - ja",
          "fonts:",
          "  body:",
          "    default: Profile Body",
          "    ja: Profile Japanese",
          "  heading:",
          "    default: Profile Heading",
          "  code:",
          "    default: Profile Code",
          "  pageChrome:",
          "    default: Profile Chrome",
          "header:",
          "  left: Profile header",
          "  style:",
          "    fontSize: 8.5pt",
          '    color: "#123456"',
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        templateCssPath,
        `${synthesis.styleCss}\n@page {\n  @top-left {\n    font-size: 12pt;\n    color: #abcdef;\n  }\n}\n`,
        "utf8",
      );

      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
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
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        css: toRepoRelativePath(templateCssPath),
        runner: capturingRunner,
      });

      expect(renderedStyles).toHaveLength(2);
      expect(renderedStyles[0]).toContain(
        'font-family: "Profile Body", "Profile Japanese", serif;',
      );
      expect(renderedStyles[0]).toContain(":lang(ja)");
      expect(renderedStyles[0]).toContain(
        'font-family: "Profile Japanese", "Profile Body", serif;',
      );
      expect(renderedStyles[0]).toContain('font-family: "Profile Heading", sans-serif;');
      expect(renderedStyles[0]).toContain('font-family: "Profile Code", monospace;');
      expect(renderedStyles[0]).toContain('@page {\n  font-family: "Profile Chrome", sans-serif;');
      expect(renderedStyles[0]).toContain(
        '@top-left {\n    content: "Profile header";\n    font-size: 8.5pt;\n    color: #123456;',
      );
      const profileCss = renderedStyles[0] ?? "";
      expect(profileCss.indexOf('font-family: "Profile Chrome", sans-serif;')).toBeGreaterThan(
        profileCss.indexOf("font-size: 8.5pt;"),
      );
      expect(renderedStyles[1]).toContain('--template-body-font: "Noto Serif", "Georgia", serif;');
      expect(renderedStyles[1]).toContain("font-size: 10.5pt;");
      expect(renderedStyles[1]).toContain("line-height: 1.5;");
      expect(renderedStyles[1]).toContain("font-family: var(--template-body-font);");
      expect(renderedStyles[1]).not.toContain("Profile Japanese");
      expect(renderedStyles[1]).not.toContain("Profile Chrome");
      expect(renderedStyles[1]).toContain("@top-left {\n    font-size: 12pt;\n    color: #abcdef;");
      expectNoStderr();
    });
  });

  test("replays profile preset and lets explicit CLI recipe flags override profile fields", async () => {
    await withTempFixtureDir("md-to-pdf-profile-preset-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "wide-report.md");
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      const renderedStyles: string[] = [];
      await writeFile(inputPath, "# Wide Report\n\n| A | B |\n| - | - |\n| 1 | 2 |\n", "utf8");
      await writeFile(
        profilePath,
        [
          "profile:",
          "  id: md-pdf-profile-20260615T081500Z-a1b2c3d4",
          "  source: codex",
          "  basedOn: wide-table",
          "  preset: wide-table",
          "  createdAt: 2026-06-15T08:15:00Z",
          "page:",
          "  orientation: portrait",
          "",
        ].join("\n"),
        "utf8",
      );

      const { runner } = createPdfRunner({ html: "<html><body>Wide Report</body></html>" });
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
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        orientation: "landscape",
        runner: capturingRunner,
      });

      const combinedCss = renderedStyles.join("\n");
      expect(combinedCss).toContain("size: A4 landscape");
      expect(combinedCss).toContain("margin: 12mm 12mm 12mm 12mm;");
      expect(combinedCss).toContain('font: 9.5pt/1.45 "Noto Sans", "Arial", sans-serif;');
      expect(combinedCss).toContain("table, pre, code");
      expectNoStderr();
    });
  });

  test("suppresses duplicate metadata title block for direct profile rendering by default", async () => {
    await withTempFixtureDir("md-to-pdf-profile-title-block-auto", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "cjk-font-smoke.md");
      const profilePath = join(fixtureDir, "profile.yml");
      let renderedTemplate = "";
      await writeFile(
        inputPath,
        ["---", "title: CJK Font Smoke", "---", "# CJK Font Smoke", "", "Body."].join("\n"),
        "utf8",
      );
      await writeFile(profilePath, "titleBlock:\n  metadataTitle: auto\n", "utf8");

      const { runner } = createPdfRunner({ html: "<html><body>CJK Font Smoke</body></html>" });
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        if (command === "pandoc" && !args.includes("--version")) {
          const templatePath = args[args.indexOf("--template") + 1];
          if (templatePath) {
            renderedTemplate = await readFile(templatePath, "utf8");
          }
        }
        return runner(command, args, runnerOptions);
      };
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        runner: capturingRunner,
      });

      expect(renderedTemplate).not.toContain('class="document-title"');
      expect(renderedTemplate).toContain("$body$");
      expectNoStderr();
    });
  });

  test("preserves duplicate-capable metadata title block when direct profile rendering requests show", async () => {
    await withTempFixtureDir("md-to-pdf-profile-title-block-show", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "cjk-font-smoke.md");
      const profilePath = join(fixtureDir, "profile.yml");
      let renderedTemplate = "";
      await writeFile(
        inputPath,
        ["---", "title: CJK Font Smoke", "---", "# CJK Font Smoke", "", "Body."].join("\n"),
        "utf8",
      );
      await writeFile(profilePath, "titleBlock:\n  metadataTitle: show\n", "utf8");

      const { runner } = createPdfRunner({ html: "<html><body>CJK Font Smoke</body></html>" });
      const capturingRunner: MarkdownPdfProcessRunner = async (command, args, runnerOptions) => {
        if (command === "pandoc" && !args.includes("--version")) {
          const templatePath = args[args.indexOf("--template") + 1];
          if (templatePath) {
            renderedTemplate = await readFile(templatePath, "utf8");
          }
        }
        return runner(command, args, runnerOptions);
      };
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        runner: capturingRunner,
      });

      expect(renderedTemplate).toContain('class="document-title"');
      expect(renderedTemplate).toContain('<h1 class="title">$title$</h1>');
      expectNoStderr();
    });
  });

  test("lets an explicit CLI preset override profile preset replay", async () => {
    await withTempFixtureDir("md-to-pdf-profile-cli-preset-action", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const profilePath = join(fixtureDir, "pdf-profile.yml");
      const renderedStyles: string[] = [];
      await writeFile(inputPath, "# Report\n\nBody.\n", "utf8");
      await writeFile(
        profilePath,
        [
          "profile:",
          "  id: md-pdf-profile-20260615T081500Z-a1b2c3d4",
          "  source: codex",
          "  basedOn: wide-table",
          "  preset: wide-table",
          "  createdAt: 2026-06-15T08:15:00Z",
          "",
        ].join("\n"),
        "utf8",
      );

      const { runner } = createPdfRunner({ html: "<html><body>Report</body></html>" });
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
      const { runtime, expectNoStderr } = createActionTestRuntime();

      await actionMdToPdf(runtime, {
        input: toRepoRelativePath(inputPath),
        profile: toRepoRelativePath(profilePath),
        preset: "reader",
        runner: capturingRunner,
      });

      const combinedCss = renderedStyles.join("\n");
      expect(combinedCss).toContain("margin: 20mm 22mm 20mm 22mm;");
      expect(combinedCss).toContain('font: 12pt/1.65 "Noto Serif", "Georgia", serif;');
      expect(combinedCss).not.toContain('font: 9.5pt/1.45 "Noto Sans", "Arial", sans-serif;');
      expectNoStderr();
    });
  });
});
