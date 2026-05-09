import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdToPdf } from "../src/cli/actions";
import type { MarkdownPdfProcessRunner } from "../src/cli/markdown-pdf";
import { createPdfRunner } from "./cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime } from "./helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "./helpers/cli-test-utils";

describe("cli action modules: md to-pdf profile rendering", () => {
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
          '    zh-Hant: "Noto Serif CJK TC"',
          '    ja: "Noto Serif CJK JP"',
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
        htmlOutput: toRepoRelativePath(htmlOutput),
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
      expect(combinedCss).toContain("@page cover");
      expect(combinedCss).toContain(".pdf-cover--report .pdf-cover__content");
      expect(combinedCss).toContain(
        'font-family: "Source Serif 4", "Noto Serif CJK TC", "Noto Serif CJK JP", serif;',
      );
      expect(combinedCss).toContain(":lang(ja)");
      expect(combinedCss).toContain(
        'font-family: "JetBrains Mono", "JetBrainsMono Nerd Font", monospace;',
      );
      expect(stdout.text).toContain("Wrote PDF:");
      expectNoStderr();
    });
  });
});
