import { registerFixtureOutput } from "../../../../scripts/testing/fixtures/fixture-exports.ts";
import {
  outputPlan,
  synthesizeForPlan,
  signalsForPlan,
  commandStateForSignals,
  bundleWriteContext,
} from "./bundle-write-fixtures";
import { describe, expect, test } from "bun:test";
import { link, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_ARTIFACT_TYPE,
  validateMdPdfTemplateCodexSynthesis,
  writeMdPdfTemplateCodexBundle,
} from "../../../../src/cli/markdown-pdf/template-codex";
import { expectCliError } from "../../../helpers/cli-action-test-utils";
import {
  createCapturedRuntime,
  toRepoRelativePath,
  withTempFixtureDir,
} from "../../../helpers/cli-test-utils";
import { pathExists } from "../../support/path-fixtures";
import { minimalPng } from "./fixtures";

describe("cli action modules: md pdf-template codex bundle writes", () => {
  test("validates required template placeholders before writing", async () => {
    await withTempFixtureDir("md-pdf-template-codex-validate-placeholder", async (fixtureDir) => {
      const plan = outputPlan({ outputDirectory: join(fixtureDir, "bundle") });
      const synthesis = synthesizeForPlan(plan);

      await expectCliError(
        () =>
          writeMdPdfTemplateCodexBundle({
            outputPlan: plan,
            ...bundleWriteContext(plan),
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

  test("rejects unproven generated body hooks before any bundle write", async () => {
    await withTempFixtureDir("md-pdf-template-codex-validate-body-hook", async (fixtureDir) => {
      const cases = [
        {
          name: "missing-hook",
          mutate: (html: string) =>
            html.replace('class="document-body"', 'class="document-content"'),
        },
        {
          name: "duplicate-hook",
          mutate: (html: string) =>
            html.replace("$body$", '<section class="document-body">$body$</section>'),
        },
        {
          name: "unrelated-insertion",
          mutate: (html: string) =>
            html.replace(
              '<main class="document-body">',
              '<aside class="document-body"></aside><main>',
            ),
        },
      ] as const;

      for (const invalidCase of cases) {
        const plan = outputPlan({
          outputDirectory: join(fixtureDir, invalidCase.name),
        });
        const synthesis = synthesizeForPlan(plan);
        await expectCliError(
          () =>
            writeMdPdfTemplateCodexBundle({
              outputPlan: plan,
              ...bundleWriteContext(plan),
              synthesis: {
                ...synthesis,
                templateHtml: invalidCase.mutate(synthesis.templateHtml),
              },
            }),
          {
            code: "TEMPLATE_VALIDATION_FAILED",
            exitCode: 2,
            messageIncludes: invalidCase.name,
          },
        );
        expect(await pathExists(plan.templateHtml.path)).toBe(false);
        expect(await pathExists(plan.styleCss.path)).toBe(false);
      }
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

      expect(() =>
        validateMdPdfTemplateCodexSynthesis({
          outputPlan: plan,
          synthesis: {
            ...synthesis,
            styleCss: `${synthesis.styleCss}\n/* /workspace/private-cover.png */\n`,
          },
        }),
      ).toThrow("absolute local paths");

      expect(() =>
        validateMdPdfTemplateCodexSynthesis({
          outputPlan: plan,
          synthesis: {
            ...synthesis,
            styleCss: `${synthesis.styleCss}\nbody { background: url(foo.png); }\n`,
          },
        }),
      ).toThrow("unmanaged asset");
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
        ...bundleWriteContext(plan),
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

  test("rejects managed asset sources that are symlinks at the copy boundary", async () => {
    await withTempFixtureDir("md-pdf-template-codex-copy-symlink-source", async (fixtureDir) => {
      const coverImagePath = join(fixtureDir, "source-cover.png");
      const coverAliasPath = join(fixtureDir, "source-cover-alias.png");
      await writeFile(coverImagePath, minimalPng(1200, 800));
      await symlink(coverImagePath, coverAliasPath);
      const plan = outputPlan({
        coverImagePath: coverAliasPath,
        outputDirectory: join(fixtureDir, "bundle"),
      });

      await expectCliError(
        () =>
          writeMdPdfTemplateCodexBundle({
            outputPlan: plan,
            ...bundleWriteContext(plan),
            synthesis: synthesizeForPlan(plan),
          }),
        {
          code: "INVALID_INPUT",
          exitCode: 2,
          messageIncludes: "managed asset assets/cover.png source is a symlink",
        },
      );
      expect(await pathExists(join(plan.outputDirectory, "assets", "cover.png"))).toBe(false);
    });
  });

  test("rejects managed asset writes through symlinked parent directories", async () => {
    await withTempFixtureDir("md-pdf-template-codex-copy-symlink-parent", async (fixtureDir) => {
      const coverImagePath = join(fixtureDir, "source-cover.png");
      const outsideDir = join(fixtureDir, "outside");
      const outputDirectory = join(fixtureDir, "bundle");
      await writeFile(coverImagePath, minimalPng(1200, 800));
      await mkdir(outsideDir, { recursive: true });
      await mkdir(outputDirectory, { recursive: true });
      await symlink(outsideDir, join(outputDirectory, "assets"));
      const plan = outputPlan({
        coverImagePath,
        outputDirectory,
      });

      await expectCliError(
        () =>
          writeMdPdfTemplateCodexBundle({
            outputPlan: plan,
            ...bundleWriteContext(plan),
            overwrite: true,
            synthesis: synthesizeForPlan(plan),
          }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "parent directory is a symlink",
        },
      );
      expect(await pathExists(join(outsideDir, "cover.png"))).toBe(false);
    });
  });

  test("replaces hard-linked managed asset targets without clobbering the other link", async () => {
    await withTempFixtureDir("md-pdf-template-codex-write-hardlink-asset", async (fixtureDir) => {
      const coverImagePath = join(fixtureDir, "source-cover.png");
      const outsideAssetPath = join(fixtureDir, "outside-cover.png");
      const outputDirectory = join(fixtureDir, "bundle");
      await writeFile(coverImagePath, minimalPng(1200, 800));
      await writeFile(outsideAssetPath, "outside cover\n", "utf8");
      await mkdir(join(outputDirectory, "assets"), { recursive: true });
      await link(outsideAssetPath, join(outputDirectory, "assets", "cover.png"));
      const plan = outputPlan({
        coverImagePath,
        outputDirectory,
      });

      await writeMdPdfTemplateCodexBundle({
        outputPlan: plan,
        ...bundleWriteContext(plan),
        overwrite: true,
        synthesis: synthesizeForPlan(plan),
      });

      expect(await readFile(outsideAssetPath, "utf8")).toBe("outside cover\n");
      expect(
        Buffer.compare(
          await readFile(join(plan.outputDirectory, "assets", "cover.png")),
          minimalPng(1200, 800),
        ),
      ).toBe(0);
    });
  });

  test("rejects template writes through a symlinked output root at the final boundary", async () => {
    await withTempFixtureDir("md-pdf-template-codex-write-symlink-root", async (fixtureDir) => {
      const outsideDir = join(fixtureDir, "outside");
      const outputDirectory = join(fixtureDir, "bundle");
      await mkdir(outsideDir, { recursive: true });
      await symlink(outsideDir, outputDirectory);
      const plan = outputPlan({ outputDirectory });

      await expectCliError(
        () =>
          writeMdPdfTemplateCodexBundle({
            outputPlan: plan,
            ...bundleWriteContext(plan),
            overwrite: true,
            synthesis: synthesizeForPlan(plan),
          }),
        {
          code: "OUTPUT_SYMLINK",
          exitCode: 2,
          messageIncludes: "planned template.html parent directory is a symlink",
        },
      );
      expect(await pathExists(join(outsideDir, "template.html"))).toBe(false);
    });
  });

  test("replaces hard-linked template targets without clobbering the other link", async () => {
    await withTempFixtureDir("md-pdf-template-codex-write-hardlink-target", async (fixtureDir) => {
      const outputDirectory = join(fixtureDir, "bundle");
      const outsideTemplatePath = join(fixtureDir, "outside-template.html");
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(outsideTemplatePath, "outside template\n", "utf8");
      await link(outsideTemplatePath, join(outputDirectory, "template.html"));
      const plan = outputPlan({ outputDirectory });

      await writeMdPdfTemplateCodexBundle({
        outputPlan: plan,
        ...bundleWriteContext(plan),
        overwrite: true,
        synthesis: synthesizeForPlan(plan),
      });

      expect(await readFile(outsideTemplatePath, "utf8")).toBe("outside template\n");
      expect(await readFile(plan.templateHtml.path, "utf8")).toContain("$body$");
    });
  });

  test("replaces hard-linked report targets without clobbering the other link", async () => {
    await withTempFixtureDir("md-pdf-template-codex-write-hardlink-report", async (fixtureDir) => {
      const outsideReportPath = join(fixtureDir, "outside-report.json");
      const reportPath = join(fixtureDir, "report.json");
      await writeFile(outsideReportPath, '{"outside":true}\n', "utf8");
      await link(outsideReportPath, reportPath);
      const plan = outputPlan({
        outputDirectory: join(fixtureDir, "bundle"),
        reportPath,
      });

      await writeMdPdfTemplateCodexBundle({
        outputPlan: plan,
        ...bundleWriteContext(plan),
        overwrite: true,
        synthesis: synthesizeForPlan(plan),
      });

      expect(await readFile(outsideReportPath, "utf8")).toBe('{"outside":true}\n');
      const report = JSON.parse(await readFile(reportPath, "utf8")) as { artifactType: string };
      expect(report.artifactType).toBe(MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_ARTIFACT_TYPE);
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
            ...bundleWriteContext(plan),
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
        ...bundleWriteContext(plan),
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
        files: Array<{ path?: string; planned: boolean; role: string }>;
      };
      expect(report.artifactType).toBe(MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_ARTIFACT_TYPE);
      expect(report.decision.mode).toBe("no-usable-template");
      expect(report.files).toHaveLength(1);
      expect(report.files[0]).toMatchObject({
        planned: true,
        role: "diagnostic-report",
      });
      expect(report.files[0]?.path).toContain("report.json");
    });
  });

  test("writes rich diagnostic reports with redacted managed asset metadata", async () => {
    await withTempFixtureDir("md-pdf-template-codex-rich-report", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "source-report.md");
      const baseProfilePath = join(fixtureDir, "profile.yml");
      const coverImagePath = join(fixtureDir, "private-cover.png");
      const reportPath = join(fixtureDir, "report.json");
      await writeFile(inputPath, "# Source report\n", "utf8");
      await writeFile(baseProfilePath, "page:\n  size: Letter\n", "utf8");
      await writeFile(coverImagePath, minimalPng(1200, 800));
      const plan = outputPlan({
        coverImagePath,
        outputDirectory: join(fixtureDir, "bundle"),
        reportPath,
      });
      const signals = signalsForPlan(plan);
      const { runtime } = createCapturedRuntime({ displayPathStyle: "absolute" });

      await writeMdPdfTemplateCodexBundle({
        outputPlan: plan,
        runtime,
        signals,
        state: {
          ...commandStateForSignals(signals, {
            coverImagePath: plan.assets[0]?.sourcePath,
          }),
          inputPath,
          baseProfilePath,
        },
        synthesis: synthesizeForPlan(plan),
      });

      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        artifactType: string;
        reportId: string;
        templateBundleId: string;
        signalMode: string;
        managedAssets: Array<{
          bundlePath: string;
          source: { basename: string; redacted: boolean };
          dimensions: { width: number; height: number };
          format: string;
        }>;
        files: Array<{ path?: string; role: string }>;
        input: { markdown: { display: string; redacted: boolean } };
        baseProfile: { source: { display: string; redacted: boolean } };
        validationResults: Array<{ name: string; status: string }>;
        followUpRenderCommand: string;
      };
      expect(report.artifactType).toBe(MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_ARTIFACT_TYPE);
      expect(report.reportId).toBe(`${report.templateBundleId}-diagnostic-report`);
      expect(report.signalMode).toBe("deterministic");
      expect(report.managedAssets[0]).toMatchObject({
        bundlePath: "assets/cover.png",
        source: {
          basename: "private-cover.png",
          redacted: true,
        },
        dimensions: {
          width: 1200,
          height: 800,
        },
        format: "png",
        orientationBucket: "landscape",
        fitPressure: "normal",
      });
      expect(report.validationResults).toContainEqual({
        name: "static-template-validation",
        status: "passed",
      });
      expect(report.input.markdown).toMatchObject({
        display: toRepoRelativePath(inputPath),
        redacted: false,
      });
      expect(report.baseProfile.source).toMatchObject({
        display: toRepoRelativePath(baseProfilePath),
        redacted: false,
      });
      expect(report.files.find((file) => file.role === "diagnostic-report")?.path).toBe(
        toRepoRelativePath(reportPath),
      );
      expect(report.followUpRenderCommand).toContain("cdx-chores md to-pdf");
      expect(report.followUpRenderCommand).toContain(`--input '${toRepoRelativePath(inputPath)}'`);
      expect(report.followUpRenderCommand).toContain("--bundle '<template-bundle>'");
      expect(report.followUpRenderCommand).not.toContain("--template");
      expect(report.followUpRenderCommand).not.toContain("--css");
      expect(report.followUpRenderCommand).toContain("--output '<output.pdf>'");
      expect(report.followUpRenderCommand).not.toContain(fixtureDir);
      expect(report.followUpRenderCommand).not.toContain("private-cover.png");
      expect(JSON.stringify(report)).not.toContain(runtime.cwd);
    });
  });

  test("shell-quotes follow-up render command paths in diagnostic reports", async () => {
    await withTempFixtureDir("md-pdf-template-codex-quoted-followup", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "source report's draft.md");
      const reportPath = join(fixtureDir, "report.json");
      await writeFile(inputPath, "# Source report\n", "utf8");
      const plan = outputPlan({
        outputDirectory: join(fixtureDir, "bundle"),
        reportPath,
      });
      const signals = signalsForPlan(plan);
      registerFixtureOutput(fixtureDir, {
        source: plan.templateHtml.path,
        name: "template.html",
        kind: "generated",
        required: true,
      });
      registerFixtureOutput(fixtureDir, {
        source: plan.styleCss.path,
        name: "style.css",
        kind: "generated",
        required: true,
      });

      await writeMdPdfTemplateCodexBundle({
        outputPlan: plan,
        runtime: createCapturedRuntime().runtime,
        signals,
        state: {
          ...commandStateForSignals(signals),
          inputPath,
        },
        synthesis: synthesizeForPlan(plan),
      });

      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        followUpRenderCommand: string;
      };
      expect(report.followUpRenderCommand).toContain(
        `--input '${toRepoRelativePath(fixtureDir)}/source report`,
      );
      expect(report.followUpRenderCommand).toContain("'\\''s draft.md'");
      expect(report.followUpRenderCommand).toContain("--bundle '<template-bundle>'");
      expect(report.followUpRenderCommand).not.toContain("--template");
      expect(report.followUpRenderCommand).not.toContain("--css");
      expect(report.followUpRenderCommand).toContain("--output '<output.pdf>'");
    });
  });

  test("keeps the selected input alias in diagnostic report display and replay command", async () => {
    await withTempFixtureDir("md-pdf-template-codex-alias-followup", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "source-report.md");
      const inputAliasPath = join(fixtureDir, "source-report-alias.md");
      const reportPath = join(fixtureDir, "report.json");
      await writeFile(inputPath, "# Source report\n", "utf8");
      await symlink(inputPath, inputAliasPath);
      const plan = outputPlan({
        outputDirectory: join(fixtureDir, "bundle"),
        reportPath,
      });
      const signals = signalsForPlan(plan);

      await writeMdPdfTemplateCodexBundle({
        outputPlan: plan,
        runtime: createCapturedRuntime().runtime,
        signals,
        state: {
          ...commandStateForSignals(signals),
          inputPath: inputAliasPath,
        },
        synthesis: synthesizeForPlan(plan),
      });

      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        followUpRenderCommand: string;
        input: { markdown: { display: string } };
      };
      expect(report.input.markdown.display).toBe(toRepoRelativePath(inputAliasPath));
      expect(report.followUpRenderCommand).toContain(
        `--input '${toRepoRelativePath(inputAliasPath)}'`,
      );
      expect(report.followUpRenderCommand).not.toContain(toRepoRelativePath(inputPath));
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
              ...bundleWriteContext(plan),
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
