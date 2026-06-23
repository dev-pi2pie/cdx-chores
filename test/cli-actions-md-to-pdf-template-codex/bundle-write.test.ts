import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  synthesizeMdPdfTemplateCodex,
  validateMdPdfTemplateCodexSynthesis,
  writeMdPdfTemplateCodexBundle,
  type MarkdownPdfTemplateCodexOutputPlan,
  type MarkdownPdfTemplateCodexSynthesisResult,
} from "../../src/cli/markdown-pdf/template-codex";
import { expectCliError } from "../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalPng, pathExists } from "./fixtures";
import { createSynthesisSignals } from "./synthesis-fixtures";

function outputPlan(input: {
  coverImagePath?: string;
  outputDirectory: string;
  reportPath?: string;
}): MarkdownPdfTemplateCodexOutputPlan {
  return {
    bundleId: "md-pdf-template-20260623T000000Z-test",
    generatedOutputDirectory: true,
    outputDirectory: input.outputDirectory,
    templateHtml: {
      path: join(input.outputDirectory, "template.html"),
      bundlePath: "template.html",
    },
    styleCss: {
      path: join(input.outputDirectory, "style.css"),
      bundlePath: "style.css",
    },
    ...(input.reportPath
      ? {
          report: {
            path: input.reportPath,
            location: "external" as const,
          },
        }
      : {}),
    assets: input.coverImagePath
      ? [
          {
            role: "cover-image" as const,
            sourcePath: input.coverImagePath,
            sourceBasename: "source-cover.png",
            path: join(input.outputDirectory, "assets", "cover.png"),
            bundlePath: "assets/cover.png",
          },
        ]
      : [],
  };
}

function synthesizeForPlan(
  plan: MarkdownPdfTemplateCodexOutputPlan,
): MarkdownPdfTemplateCodexSynthesisResult {
  return synthesizeMdPdfTemplateCodex({
    outputPlan: plan,
    signals: createSynthesisSignals({
      coverImage: plan.assets.length > 0 ? {} : undefined,
      signalMode: "deterministic",
    }),
  });
}

describe("cli action modules: md pdf-template codex bundle writes", () => {
  test("validates required template placeholders before writing", async () => {
    await withTempFixtureDir("md-pdf-template-codex-validate-placeholder", async (fixtureDir) => {
      const plan = outputPlan({ outputDirectory: join(fixtureDir, "bundle") });
      const synthesis = synthesizeForPlan(plan);

      await expectCliError(
        () =>
          writeMdPdfTemplateCodexBundle({
            outputPlan: plan,
            synthesis: {
              ...synthesis,
              templateHtml: synthesis.templateHtml.replace("$body$", ""),
            },
          }),
        {
          code: "TEMPLATE_VALIDATION_FAILED",
          exitCode: 2,
          messageIncludes: "Pandoc body placeholder",
        },
      );
      expect(await pathExists(plan.templateHtml.path)).toBe(false);
    });
  });

  test("rejects remote URLs, absolute paths, and unmanaged asset references", async () => {
    await withTempFixtureDir("md-pdf-template-codex-validate-refs", async (fixtureDir) => {
      const plan = outputPlan({ outputDirectory: join(fixtureDir, "bundle") });
      const synthesis = synthesizeForPlan(plan);

      expect(() =>
        validateMdPdfTemplateCodexSynthesis({
          outputPlan: plan,
          synthesis: {
            ...synthesis,
            templateHtml: synthesis.templateHtml.replace(
              "$body$",
              '<img src="https://example.test/a.png">$body$',
            ),
          },
        }),
      ).toThrow("remote URLs");

      expect(() =>
        validateMdPdfTemplateCodexSynthesis({
          outputPlan: plan,
          synthesis: {
            ...synthesis,
            templateHtml: synthesis.templateHtml.replace(
              "$body$",
              '<img src="/Users/me/a.png">$body$',
            ),
          },
        }),
      ).toThrow("absolute local paths");

      expect(() =>
        validateMdPdfTemplateCodexSynthesis({
          outputPlan: plan,
          synthesis: {
            ...synthesis,
            templateHtml: synthesis.templateHtml.replace(
              "$body$",
              '<img src="assets/other.png">$body$',
            ),
          },
        }),
      ).toThrow("unmanaged asset");

      expect(() =>
        validateMdPdfTemplateCodexSynthesis({
          outputPlan: plan,
          synthesis: {
            ...synthesis,
            styleCss: `${synthesis.styleCss}\n/* /Users/me/private-cover.png */\n`,
          },
        }),
      ).toThrow("absolute local paths");
    });
  });

  test("copies planned cover assets into the bundle", async () => {
    await withTempFixtureDir("md-pdf-template-codex-copy-cover", async (fixtureDir) => {
      const coverImagePath = join(fixtureDir, "source-cover.png");
      await writeFile(coverImagePath, minimalPng(1200, 800));
      const plan = outputPlan({
        coverImagePath,
        outputDirectory: join(fixtureDir, "bundle"),
      });

      await writeMdPdfTemplateCodexBundle({
        outputPlan: plan,
        synthesis: synthesizeForPlan(plan),
      });

      expect(
        Buffer.compare(
          await readFile(join(plan.outputDirectory, "assets", "cover.png")),
          minimalPng(1200, 800),
        ),
      ).toBe(0);
      expect(await readFile(plan.templateHtml.path, "utf8")).toContain('src="assets/cover.png"');
    });
  });

  test("rejects planned write paths outside the output directory at the final boundary", async () => {
    await withTempFixtureDir("md-pdf-template-codex-write-boundary", async (fixtureDir) => {
      const plan = outputPlan({ outputDirectory: join(fixtureDir, "bundle") });
      const synthesis = synthesizeForPlan(plan);

      await expectCliError(
        () =>
          writeMdPdfTemplateCodexBundle({
            outputPlan: {
              ...plan,
              styleCss: {
                ...plan.styleCss,
                path: join(fixtureDir, "style.css"),
              },
            },
            synthesis,
          }),
        {
          code: "TEMPLATE_VALIDATION_FAILED",
          exitCode: 2,
          messageIncludes: "style.css must stay inside",
        },
      );
      expect(await pathExists(join(fixtureDir, "style.css"))).toBe(false);
    });
  });

  test("writes requested reports without recipe files for no-usable-template decisions", async () => {
    await withTempFixtureDir("md-pdf-template-codex-no-usable-report", async (fixtureDir) => {
      const reportPath = join(fixtureDir, "report.json");
      const plan = outputPlan({
        outputDirectory: join(fixtureDir, "bundle"),
        reportPath,
      });
      const synthesis = synthesizeForPlan(plan);

      await writeMdPdfTemplateCodexBundle({
        outputPlan: plan,
        synthesis: {
          ...synthesis,
          decisionMode: "no-usable-template",
          managedAssets: [],
          styleCss: "",
          templateHtml: "",
        },
      });

      expect(await pathExists(plan.templateHtml.path)).toBe(false);
      expect(await pathExists(plan.styleCss.path)).toBe(false);
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        artifactType: string;
        decision: { mode: string };
        files: unknown[];
      };
      expect(report.artifactType).toBe("markdown-pdf-template-codex-report");
      expect(report.decision.mode).toBe("no-usable-template");
      expect(report.files).toEqual([]);
    });
  });

  test("validates no-usable-template report paths before writing", async () => {
    await withTempFixtureDir(
      "md-pdf-template-codex-no-usable-report-boundary",
      async (fixtureDir) => {
        const plan = outputPlan({
          outputDirectory: join(fixtureDir, "bundle"),
          reportPath: join(fixtureDir, "report.json"),
        });
        const synthesis = synthesizeForPlan(plan);

        await expectCliError(
          () =>
            writeMdPdfTemplateCodexBundle({
              outputPlan: {
                ...plan,
                report: {
                  bundlePath: "../report.json",
                  location: "in-bundle",
                  path: join(fixtureDir, "report.json"),
                },
              },
              synthesis: {
                ...synthesis,
                decisionMode: "no-usable-template",
                managedAssets: [],
                styleCss: "",
                templateHtml: "",
              },
            }),
          {
            code: "TEMPLATE_VALIDATION_FAILED",
            exitCode: 2,
            messageIncludes: "template Codex report must use a bundle-relative path",
          },
        );
        expect(await pathExists(join(fixtureDir, "report.json"))).toBe(false);
      },
    );
  });
});
