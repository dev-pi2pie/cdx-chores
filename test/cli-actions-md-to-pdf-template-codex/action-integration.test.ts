import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdPdfTemplateCodex, actionMdToPdf } from "../../src/cli/actions/markdown";
import type { CodexProgressPresenter } from "../../src/cli/actions/codex-progress";
import { prepareMdPdfTemplateCodex } from "../../src/cli/actions/markdown/pdf-template-codex";
import type { MarkdownPdfTemplateCodexRunner } from "../../src/adapters/codex/markdown-pdf-template";
import type { MarkdownPdfProcessRunner } from "../../src/cli/markdown-pdf";
import {
  bindPreparedMdPdfTemplateCodexOutput,
  writePreparedMdPdfTemplateCodexBundle,
} from "../../src/cli/markdown-pdf/template-codex";
import { createPdfRunner } from "../cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime, expectCliError } from "../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalJpeg, minimalPng, minimalWebpVp8x1200By800, pathExists } from "./fixtures";

function codexTemplateResponse(
  input: {
    coverEnabled?: boolean;
    cssBlocks?: Array<{ css: string; slot: string }>;
    decisionMode?: string;
    fallbackReason?: string;
    fontDecisions?: Array<{
      family: string;
      key: string;
      role: string;
      source: string;
      template_level: boolean;
    }>;
    composition?: string;
    byline?: string;
    imageFit?: string;
    imageAnchor?: string;
    mediaAlign?: string;
    mediaScale?: string;
    templateFamily?: string;
    textAlign?: string;
    warnings?: string[];
  } = {},
): string {
  const coverEnabled = input.coverEnabled ?? false;
  return JSON.stringify({
    decision_mode: input.decisionMode ?? "adapted",
    template_family:
      input.templateFamily ?? (coverEnabled ? "cover-media-layered" : "document-layered"),
    recipe_preset: "article",
    slots: {
      recipe_preset: { preset: "article", source: "renderer-default" },
      cover: {
        enabled: coverEnabled,
        byline: input.byline ?? "none",
        composition: input.composition ?? "media-first-caption",
        image_fit: coverEnabled ? (input.imageFit ?? "cover") : "",
        image_anchor: input.imageAnchor ?? "center",
        media_align: input.mediaAlign ?? "center",
        media_scale: input.mediaScale ?? (coverEnabled ? "hero" : "balanced"),
        text_align: input.textAlign ?? "center",
        style: coverEnabled ? "media" : "none",
        orientation_bucket: coverEnabled ? "landscape" : "unknown",
        fit_pressure: coverEnabled ? "normal" : "unknown",
      },
      tables: { density: "standard", repeat_header: true, width: "content" },
      code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
      spacing: { density: "standard" },
      typography: { scale: "standard" },
      colors: { palette: "neutral" },
    },
    css_blocks: input.cssBlocks ?? [],
    font_decisions: input.fontDecisions ?? [],
    managed_assets: coverEnabled
      ? [{ bundle_path: "assets/cover.png", source_label: "cover.png" }]
      : [],
    warnings: input.warnings ?? [],
    unsupported_directions: [],
    fallback_reason: input.fallbackReason ?? "",
  });
}

function noUsableTemplateResponse(reason = "Unsupported template direction."): string {
  return JSON.stringify({
    decision_mode: "no-usable-template",
    template_family: "none",
    recipe_preset: "none",
    slots: {
      recipe_preset: { preset: "article", source: "renderer-default" },
      cover: {
        enabled: false,
        byline: "none",
        composition: "media-first-caption",
        image_fit: "",
        image_anchor: "center",
        media_align: "center",
        media_scale: "balanced",
        text_align: "center",
        style: "none",
        orientation_bucket: "unknown",
        fit_pressure: "unknown",
      },
      tables: { density: "standard", repeat_header: true, width: "content" },
      code: { style: "shiki-compatible", line_wrap: "wrap", preserve_selectors: true },
      spacing: { density: "standard" },
      typography: { scale: "standard" },
      colors: { palette: "neutral" },
    },
    css_blocks: [],
    font_decisions: [],
    managed_assets: [],
    warnings: [reason],
    unsupported_directions: [reason],
    fallback_reason: reason,
  });
}

function stubCodexRunner(response: string): MarkdownPdfTemplateCodexRunner {
  return async () => response;
}

async function expectTemplateBundleFeedsMdToPdf(input: {
  fixtureDir: string;
  inputPath: string;
  outputPath: string;
  runtime: ReturnType<typeof createActionTestRuntime>["runtime"];
}): Promise<void> {
  async function render(mode: "bundle" | "explicit") {
    const pdfPath = join(input.fixtureDir, `report-${mode}.pdf`);
    const { calls, runner } = createPdfRunner({
      html: "<html><body><main>Body.</main></body></html>",
    });
    let renderedTemplate = "";
    const capturingRunner: MarkdownPdfProcessRunner = async (command, args, options) => {
      if (command === "pandoc" && !args.includes("--version")) {
        const templatePath = args[args.indexOf("--template") + 1];
        if (templatePath) {
          renderedTemplate = await readFile(templatePath, "utf8");
        }
      }
      return runner(command, args, options);
    };
    await actionMdToPdf(input.runtime, {
      input: toRepoRelativePath(input.inputPath),
      output: toRepoRelativePath(pdfPath),
      ...(mode === "bundle"
        ? { bundle: toRepoRelativePath(input.outputPath) }
        : {
            template: toRepoRelativePath(join(input.outputPath, "template.html")),
            css: toRepoRelativePath(join(input.outputPath, "style.css")),
          }),
      runner: capturingRunner,
    });

    const pandocRender = calls.find(
      (call) => call.command === "pandoc" && !call.args.includes("--version"),
    );
    const templateArg = pandocRender?.args[pandocRender.args.indexOf("--template") + 1];
    expect(templateArg).toBeDefined();
    expect(templateArg).not.toBe(join(input.outputPath, "template.html"));
    const weasyprintRender = calls.find(
      (call) => call.command === "weasyprint" && !call.args.includes("--info"),
    );
    expect(weasyprintRender?.args).toContain(join(input.outputPath, "style.css"));
    return {
      pdf: await readFile(pdfPath, "utf8"),
      template: renderedTemplate,
    };
  }

  const bundleRender = await render("bundle");
  const explicitRender = await render("explicit");

  expect(bundleRender.pdf).toContain("%PDF");
  expect(bundleRender.pdf).toBe(explicitRender.pdf);
  expect(bundleRender.template).toBe(explicitRender.template);
}

describe("cli action modules: md pdf-template codex integration", () => {
  test("prepares once, rebinds the destination, and writes the accepted artifact", async () => {
    await withTempFixtureDir("md-pdf-template-codex-prepared-rebind", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const coverImagePath = join(fixtureDir, "cover.png");
      const initialOutputPath = join(fixtureDir, "initial-template-output");
      const reboundOutputPath = join(fixtureDir, "rebound-template-output");
      const acceptedCover = minimalPng(1200, 800);
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(coverImagePath, acceptedCover);

      let runnerCalls = 0;
      const { runtime } = createActionTestRuntime();
      const prepared = await prepareMdPdfTemplateCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "create a report cover",
        coverImage: toRepoRelativePath(coverImagePath),
        output: toRepoRelativePath(initialOutputPath),
        keepCodexReport: true,
        templateBundleIdFactory: () => "md-pdf-template-prepared-test",
        codexRunner: async () => {
          runnerCalls += 1;
          return codexTemplateResponse({ coverEnabled: true });
        },
      });
      const acceptedTemplate = prepared.synthesis.templateHtml;
      const acceptedStyle = prepared.synthesis.styleCss;
      const acceptedReport = JSON.stringify(prepared.reportArtifact);

      await writeFile(coverImagePath, minimalPng(640, 480));
      const rebound = bindPreparedMdPdfTemplateCodexOutput(prepared, {
        outputDirectory: reboundOutputPath,
      });
      await writePreparedMdPdfTemplateCodexBundle({ prepared: rebound, runtime });

      expect(runnerCalls).toBe(1);
      expect(rebound.bundleId).toBe("md-pdf-template-prepared-test");
      expect(rebound.outputPlan.bundleId).toBe(prepared.outputPlan.bundleId);
      expect(rebound.synthesis.templateHtml).toBe(acceptedTemplate);
      expect(rebound.synthesis.styleCss).toBe(acceptedStyle);
      expect(JSON.stringify(rebound.reportArtifact)).toBe(acceptedReport);
      expect(await pathExists(initialOutputPath)).toBe(false);
      expect(await readFile(join(reboundOutputPath, "template.html"), "utf8")).toBe(
        acceptedTemplate,
      );
      expect(await readFile(join(reboundOutputPath, "style.css"), "utf8")).toBe(acceptedStyle);
      expect(
        Buffer.compare(
          await readFile(join(reboundOutputPath, "assets", "cover.png")),
          acceptedCover,
        ),
      ).toBe(0);
      expect(
        JSON.stringify(
          JSON.parse(await readFile(join(reboundOutputPath, "template.codex-report.json"), "utf8")),
        ),
      ).toBe(acceptedReport);
    });
  });

  test("writes only requested diagnostic reports during dry runs", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-dry-run-report", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "template-output");
      const reportPath = join(fixtureDir, "template-report.json");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime, stdout } = createActionTestRuntime();

      await actionMdPdfTemplateCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "dense report",
        output: toRepoRelativePath(outputPath),
        codexReportOutput: toRepoRelativePath(reportPath),
        codexRunner: stubCodexRunner(codexTemplateResponse()),
        dryRun: true,
      });

      expect(stdout.text).toContain("Decision mode: adapted");
      expect(stdout.text).toContain(`Codex report: ${toRepoRelativePath(reportPath)}`);
      expect(stdout.text).toContain("Dry run only. No template bundle files were written.");
      expect(await pathExists(outputPath)).toBe(false);
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        artifactType: string;
        decision: {
          cover: Record<string, unknown>;
          layoutPolicy: {
            recipePreset: { status: string };
            tableLayoutSignal: { level: string };
          };
          titlePolicy: { metadataTitle: string; visibleMetadataTitle: boolean };
        };
        files: Array<{ role: string }>;
      };
      expect(report.artifactType).toBe("markdown-pdf-codex-template-report");
      expect(report.decision.cover).toMatchObject({
        enabled: false,
        byline: "none",
        composition: "media-first-caption",
      });
      expect(report.decision.cover).not.toHaveProperty("layout");
      expect(report.decision.cover).not.toHaveProperty("titlePlacement");
      expect(report.decision.layoutPolicy).toMatchObject({
        tableLayoutSignal: { level: "none" },
        recipePreset: { status: "not-needed" },
      });
      expect(report.decision.titlePolicy).toMatchObject({
        metadataTitle: "show",
        visibleMetadataTitle: true,
      });
      expect(report.files.map((file) => file.role)).toEqual([
        "template-html",
        "style-css",
        "diagnostic-report",
      ]);
    });
  });

  test("allows dry-run in-bundle reports in existing bundle directories", async () => {
    await withTempFixtureDir(
      "md-pdf-template-codex-action-dry-run-report-existing-bundle",
      async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const outputPath = join(fixtureDir, "template-output");
        const existingTemplate = "<html>existing</html>\n";
        const existingStyle = "body { color: red; }\n";
        await writeFile(inputPath, "# Report\n", "utf8");
        await mkdir(outputPath, { recursive: true });
        await writeFile(join(outputPath, "template.html"), existingTemplate, "utf8");
        await writeFile(join(outputPath, "style.css"), existingStyle, "utf8");

        const { runtime, stdout } = createActionTestRuntime();
        await actionMdPdfTemplateCodex(runtime, {
          input: toRepoRelativePath(inputPath),
          intent: "dense report",
          output: toRepoRelativePath(outputPath),
          keepCodexReport: true,
          codexRunner: stubCodexRunner(codexTemplateResponse()),
          dryRun: true,
        });

        expect(stdout.text).toContain("Dry run only. No template bundle files were written.");
        expect(await readFile(join(outputPath, "template.html"), "utf8")).toBe(existingTemplate);
        expect(await readFile(join(outputPath, "style.css"), "utf8")).toBe(existingStyle);
        expect(
          JSON.parse(await readFile(join(outputPath, "template.codex-report.json"), "utf8")),
        ).toMatchObject({
          decision: { mode: "adapted" },
        });
      },
    );
  });

  test("writes adapted Codex-assisted template bundles with bounded CSS", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-adapted", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "template-output");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime, stderr, stdout } = createActionTestRuntime();
      await actionMdPdfTemplateCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "make headings quieter",
        output: toRepoRelativePath(outputPath),
        codexRunner: stubCodexRunner(
          codexTemplateResponse({
            cssBlocks: [{ slot: "typography", css: "h1 { color: #234567; }" }],
          }),
        ),
      });

      expect(stdout.text).toContain("Signal mode: codex-assisted");
      expect(stdout.text).toContain("Decision mode: adapted");
      expect(stderr.text).toContain("Wrote Markdown PDF template bundle:");
      expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(
        "h1 { color: #234567; }",
      );
    });
  });

  test("writes accepted template font decisions into CSS and diagnostic reports", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-font-decision", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "template-output");
      const reportPath = join(fixtureDir, "template-report.json");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime } = createActionTestRuntime();
      await actionMdPdfTemplateCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        fontHint: ["Inter"],
        output: toRepoRelativePath(outputPath),
        codexReportOutput: toRepoRelativePath(reportPath),
        codexRunner: stubCodexRunner(
          codexTemplateResponse({
            fontDecisions: [
              {
                family: "Inter",
                key: "default",
                role: "heading",
                source: "font-hint",
                template_level: false,
              },
            ],
          }),
        ),
      });

      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(
        '--template-heading-font: "Inter", sans-serif;',
      );
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        decision: {
          fontDecisions: Array<{
            family: string;
            key: string;
            overridesProfileFont: boolean;
            profileOwned: boolean;
            role: string;
            status: string;
          }>;
        };
        input: { fontHints: string[] };
      };
      expect(report.input.fontHints).toEqual(["Inter"]);
      expect(report.decision.fontDecisions).toEqual([
        expect.objectContaining({
          family: "Inter",
          key: "default",
          overridesProfileFont: false,
          profileOwned: false,
          role: "heading",
          status: "applied",
        }),
      ]);
    });
  });

  test("routes cover image plus font hints through Codex-assisted synthesis", async () => {
    await withTempFixtureDir(
      "md-pdf-template-codex-action-cover-font-decision",
      async (fixtureDir) => {
        const coverImagePath = join(fixtureDir, "cover.png");
        const outputPath = join(fixtureDir, "template-output");
        await writeFile(coverImagePath, minimalPng(1200, 800));

        let codexCalled = false;
        const { runtime, stderr, stdout } = createActionTestRuntime();
        await actionMdPdfTemplateCodex(runtime, {
          coverImage: toRepoRelativePath(coverImagePath),
          fontHint: ["Inter"],
          output: toRepoRelativePath(outputPath),
          codexRunner: async () => {
            codexCalled = true;
            return codexTemplateResponse({
              coverEnabled: true,
              fontDecisions: [
                {
                  family: "Inter",
                  key: "default",
                  role: "heading",
                  source: "font-hint",
                  template_level: false,
                },
              ],
            });
          },
        });

        expect(codexCalled).toBe(true);
        expect(stdout.text).toContain("Signal mode: codex-assisted");
        expect(stdout.text).toContain("Decision mode: adapted");
        expect(stderr.text).toContain("Requesting Codex Markdown PDF template recommendation...");
        expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain(
          'src="assets/cover.png"',
        );
        expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(
          '--template-heading-font: "Inter", sans-serif;',
        );
      },
    );
  });

  test("prints non-TTY Codex progress for Codex-assisted decisions", async () => {
    await withTempFixtureDir(
      "md-pdf-template-codex-action-progress-non-tty",
      async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const outputPath = join(fixtureDir, "template-output");
        await writeFile(inputPath, "# Report\n", "utf8");

        const { runtime, stderr } = createActionTestRuntime();
        await actionMdPdfTemplateCodex(runtime, {
          input: toRepoRelativePath(inputPath),
          intent: "make headings quieter",
          output: toRepoRelativePath(outputPath),
          codexRunner: stubCodexRunner(codexTemplateResponse()),
        });

        expect(stderr.text).toContain("Requesting Codex Markdown PDF template recommendation...\n");
        expect(stderr.text).toContain("Wrote Markdown PDF template bundle:");
      },
    );
  });

  test("shows and clears TTY Codex progress on adapted template decisions", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-progress-done", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "template-output");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime, stderr, stdout } = createActionTestRuntime();
      (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
      await actionMdPdfTemplateCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "make headings quieter",
        output: toRepoRelativePath(outputPath),
        codexRunner: stubCodexRunner(codexTemplateResponse()),
      });

      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF template recommendation... -",
      );
      expect(stderr.text).toContain(
        "\r\u001b[2KRequesting Codex Markdown PDF template recommendation... done\n",
      );
      expect(stdout.text).toContain("Decision mode: adapted");
    });
  });

  test("uses an injected Codex progress presenter without direct progress output", async () => {
    await withTempFixtureDir(
      "md-pdf-template-codex-action-progress-injected",
      async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const outputPath = join(fixtureDir, "template-output");
        await writeFile(inputPath, "# Report\n", "utf8");
        const events: string[] = [];
        const codexProgressPresenter: CodexProgressPresenter = {
          start: (label) => events.push(`start:${label}`),
          update: (label) => events.push(`update:${label}`),
          stop: (status) => events.push(`stop:${status}`),
        };
        const { runtime, stderr } = createActionTestRuntime();

        await actionMdPdfTemplateCodex(runtime, {
          codexProgressPresenter,
          input: toRepoRelativePath(inputPath),
          intent: "make headings quieter",
          output: toRepoRelativePath(outputPath),
          codexRunner: stubCodexRunner(codexTemplateResponse()),
        });

        expect(events).toEqual([
          "start:Requesting Codex Markdown PDF template recommendation",
          "stop:done",
        ]);
        expect(stderr.text).not.toContain("Requesting Codex Markdown PDF template recommendation");
      },
    );
  });

  test("summarizes conservative fallback Codex-assisted decisions", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-fallback", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "template-output");
      const reportPath = join(fixtureDir, "template-report.json");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime, stderr, stdout } = createActionTestRuntime();
      await actionMdPdfTemplateCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "use a risky layout but stay conservative",
        output: toRepoRelativePath(outputPath),
        codexReportOutput: toRepoRelativePath(reportPath),
        codexRunner: stubCodexRunner(
          codexTemplateResponse({
            decisionMode: "conservative-fallback",
            fallbackReason: "Risky layout reduced to supported template slots.",
            warnings: ["Risky layout reduced to supported template slots."],
          }),
        ),
      });

      expect(stdout.text).toContain("Decision mode: conservative-fallback");
      expect(stdout.text).toContain(
        "Fallback reason: Risky layout reduced to supported template slots.",
      );
      expect(stderr.text).toContain("Wrote Markdown PDF template bundle:");
      expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain("$body$");
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(
        "/* cdx-chores md pdf-template codex",
      );
      await expectTemplateBundleFeedsMdToPdf({ fixtureDir, inputPath, outputPath, runtime });
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        decision: { fallbackReason: string; mode: string; warnings: string[] };
      };
      expect(report.decision).toMatchObject({
        mode: "conservative-fallback",
        fallbackReason: "Risky layout reduced to supported template slots.",
        warnings: ["Risky layout reduced to supported template slots."],
      });
    });
  });

  test("shows fallback TTY Codex progress for conservative fallback template decisions", async () => {
    await withTempFixtureDir(
      "md-pdf-template-codex-action-progress-fallback",
      async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const outputPath = join(fixtureDir, "template-output");
        await writeFile(inputPath, "# Report\n", "utf8");

        const { runtime, stderr, stdout } = createActionTestRuntime();
        (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
        await actionMdPdfTemplateCodex(runtime, {
          input: toRepoRelativePath(inputPath),
          intent: "use a risky layout but stay conservative",
          output: toRepoRelativePath(outputPath),
          codexRunner: stubCodexRunner(
            codexTemplateResponse({
              decisionMode: "conservative-fallback",
              fallbackReason: "Risky layout reduced to supported template slots.",
              warnings: ["Risky layout reduced to supported template slots."],
            }),
          ),
        });

        expect(stderr.text).toContain(
          "\r\u001b[2KRequesting Codex Markdown PDF template recommendation... fallback\n",
        );
        expect(stderr.text).not.toContain(
          "\r\u001b[2KRequesting Codex Markdown PDF template recommendation... error\n",
        );
        expect(stdout.text).toContain("Decision mode: conservative-fallback");
      },
    );
  });

  test("writes requested reports for no-usable-template Codex decisions without recipe files", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-no-usable", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const coverImagePath = join(fixtureDir, "cover.png");
      const outputPath = join(fixtureDir, "template-output");
      const reportPath = join(fixtureDir, "template-report.json");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(coverImagePath, minimalPng(1200, 800));

      const { runtime, stderr, stdout } = createActionTestRuntime();
      await expectCliError(
        () =>
          actionMdPdfTemplateCodex(runtime, {
            input: toRepoRelativePath(inputPath),
            intent: "download a remote animated cover",
            coverImage: toRepoRelativePath(coverImagePath),
            output: toRepoRelativePath(outputPath),
            codexReportOutput: toRepoRelativePath(reportPath),
            codexRunner: stubCodexRunner(noUsableTemplateResponse()),
          }),
        {
          code: "NO_USABLE_TEMPLATE",
          exitCode: 1,
          messageIncludes: "Unsupported template direction.",
        },
      );

      expect(stdout.text).toContain("Decision mode: no-usable-template");
      expect(stdout.text).toContain("Fallback reason: Unsupported template direction.");
      expect(stdout.text).not.toContain("Template family:");
      expect(stdout.text).not.toContain("Output directory:");
      expect(stdout.text).not.toContain("Template HTML:");
      expect(stdout.text).not.toContain("Stylesheet:");
      expect(stdout.text).not.toContain("Managed assets:");
      expect(stdout.text).not.toContain("Cover composition:");
      expect(stderr.text).toContain("Wrote Codex report:");
      expect(await pathExists(join(outputPath, "template.html"))).toBe(false);
      expect(await pathExists(join(outputPath, "style.css"))).toBe(false);
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        decision: {
          cover: { enabled: boolean };
          fallbackReason: string;
          mode: string;
          recipePreset?: string;
          templateFamily?: string;
        };
        files: Array<{ role: string }>;
        followUpRenderCommand?: string;
        managedAssets: unknown[];
        validationResults: Array<{ name: string; status: string }>;
      };
      expect(report.decision).toMatchObject({
        mode: "no-usable-template",
        fallbackReason: "Unsupported template direction.",
        cover: { enabled: false },
      });
      expect(report.decision.templateFamily).toBeUndefined();
      expect(report.decision.recipePreset).toBeUndefined();
      expect(report.files.map((file) => file.role)).toEqual(["diagnostic-report"]);
      expect(report.managedAssets).toEqual([]);
      expect(report.validationResults).toEqual([
        { name: "static-template-validation", status: "skipped" },
      ]);
      expect(report.followUpRenderCommand).toBeUndefined();
    });
  });

  test("allows no-usable in-bundle reports in existing bundle directories", async () => {
    await withTempFixtureDir(
      "md-pdf-template-codex-action-no-usable-report-existing-bundle",
      async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const outputPath = join(fixtureDir, "template-output");
        const existingTemplate = "<html>existing</html>\n";
        const existingStyle = "body { color: red; }\n";
        await writeFile(inputPath, "# Report\n", "utf8");
        await mkdir(outputPath, { recursive: true });
        await writeFile(join(outputPath, "template.html"), existingTemplate, "utf8");
        await writeFile(join(outputPath, "style.css"), existingStyle, "utf8");

        const { runtime, stderr, stdout } = createActionTestRuntime();
        await expectCliError(
          () =>
            actionMdPdfTemplateCodex(runtime, {
              input: toRepoRelativePath(inputPath),
              intent: "download a remote animated cover",
              output: toRepoRelativePath(outputPath),
              keepCodexReport: true,
              codexRunner: stubCodexRunner(noUsableTemplateResponse()),
            }),
          {
            code: "NO_USABLE_TEMPLATE",
            exitCode: 1,
            messageIncludes: "Unsupported template direction.",
          },
        );

        expect(stdout.text).toContain("Decision mode: no-usable-template");
        expect(stderr.text).toContain("Wrote Codex report:");
        expect(await readFile(join(outputPath, "template.html"), "utf8")).toBe(existingTemplate);
        expect(await readFile(join(outputPath, "style.css"), "utf8")).toBe(existingStyle);
        expect(
          JSON.parse(await readFile(join(outputPath, "template.codex-report.json"), "utf8")),
        ).toMatchObject({
          decision: { mode: "no-usable-template" },
          files: [{ role: "diagnostic-report" }],
        });
      },
    );
  });

  test("shows one error TTY Codex progress stop for no-usable template decisions", async () => {
    await withTempFixtureDir(
      "md-pdf-template-codex-action-progress-no-usable",
      async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const outputPath = join(fixtureDir, "template-output");
        await writeFile(inputPath, "# Report\n", "utf8");

        const { runtime, stderr, stdout } = createActionTestRuntime();
        (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
        await expectCliError(
          () =>
            actionMdPdfTemplateCodex(runtime, {
              input: toRepoRelativePath(inputPath),
              intent: "download a remote animated cover",
              output: toRepoRelativePath(outputPath),
              codexRunner: stubCodexRunner(noUsableTemplateResponse()),
            }),
          {
            code: "NO_USABLE_TEMPLATE",
            exitCode: 1,
            messageIncludes: "Unsupported template direction.",
          },
        );

        const errorStop =
          "\r\u001b[2KRequesting Codex Markdown PDF template recommendation... error\n";
        const errorStops = stderr.text.split(errorStop).length - 1;
        expect(errorStops).toBe(1);
        expect(stdout.text).toContain("Decision mode: no-usable-template");
      },
    );
  });

  test("shows error TTY Codex progress when the Codex runner is unavailable", async () => {
    await withTempFixtureDir(
      "md-pdf-template-codex-action-progress-runner-error",
      async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const outputPath = join(fixtureDir, "template-output");
        await writeFile(inputPath, "# Report\n", "utf8");

        const { runtime, stderr, stdout } = createActionTestRuntime();
        (runtime.stderr as NodeJS.WritableStream & { isTTY?: boolean }).isTTY = true;
        await expectCliError(
          () =>
            actionMdPdfTemplateCodex(runtime, {
              input: toRepoRelativePath(inputPath),
              intent: "make headings quieter",
              output: toRepoRelativePath(outputPath),
              codexRunner: async () => {
                throw new Error("network unavailable");
              },
            }),
          {
            code: "NO_USABLE_TEMPLATE",
            exitCode: 1,
            messageIncludes: "Codex template decision failed: unavailable.",
          },
        );

        expect(stderr.text).toContain(
          "\r\u001b[2KRequesting Codex Markdown PDF template recommendation... error\n",
        );
        expect(stdout.text).toContain("Decision mode: no-usable-template");
        expect(stdout.text).toContain(
          "Fallback reason: Codex template decision failed: unavailable.",
        );
      },
    );
  });

  test("keeps Codex-assisted cover fit bounded to slot CSS", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-cover-fit", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const coverImagePath = join(fixtureDir, "cover.png");
      const outputPath = join(fixtureDir, "template-output");
      await writeFile(inputPath, "# Report\n", "utf8");
      await writeFile(coverImagePath, minimalPng(4000, 1000));

      const { runtime } = createActionTestRuntime();
      await actionMdPdfTemplateCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        coverImage: toRepoRelativePath(coverImagePath),
        output: toRepoRelativePath(outputPath),
        codexRunner: stubCodexRunner(
          codexTemplateResponse({ coverEnabled: true, imageFit: "cover" }),
        ),
      });

      const styleCss = await readFile(join(outputPath, "style.css"), "utf8");
      expect(styleCss).toContain("object-fit: cover;");
      expect(styleCss).not.toMatch(
        /\b(?:width|height|max-height|max-width)\s*:\s*(?:4000|1000)(?:\b|[a-z%])/i,
      );
    });
  });

  test("writes deterministic cover bundles for supported image formats", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-cover-formats", async (fixtureDir) => {
      const cases = [
        { name: "png", bytes: minimalPng(1600, 900) },
        { name: "jpg", bytes: minimalJpeg(800, 2000) },
        { name: "webp", bytes: minimalWebpVp8x1200By800() },
      ];
      for (const item of cases) {
        const coverImagePath = join(fixtureDir, `cover.${item.name}`);
        const outputPath = join(fixtureDir, `template-${item.name}`);
        await writeFile(coverImagePath, item.bytes);

        const { runtime } = createActionTestRuntime();
        await actionMdPdfTemplateCodex(runtime, {
          coverImage: toRepoRelativePath(coverImagePath),
          output: toRepoRelativePath(outputPath),
        });

        expect(await pathExists(join(outputPath, "template.html"))).toBe(true);
        expect(await pathExists(join(outputPath, "style.css"))).toBe(true);
        expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain(
          `src="assets/cover.${item.name}"`,
        );
      }
    });
  });

  test("generated cover template bundles render equivalently through bundle and explicit inputs", async () => {
    await withTempFixtureDir("md-pdf-template-codex-render-compat", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const coverImagePath = join(fixtureDir, "cover.png");
      const outputPath = join(fixtureDir, "template-output");
      await writeFile(inputPath, "# Report\n\nBody.\n", "utf8");
      await writeFile(coverImagePath, minimalPng(1600, 900));

      const { runtime } = createActionTestRuntime();
      await actionMdPdfTemplateCodex(runtime, {
        coverImage: toRepoRelativePath(coverImagePath),
        output: toRepoRelativePath(outputPath),
      });

      expect(await readFile(join(outputPath, "template.html"), "utf8")).toContain(
        'src="assets/cover.png"',
      );
      expect(await readFile(join(outputPath, "style.css"), "utf8")).toContain(
        "object-fit: contain;",
      );
      await expectTemplateBundleFeedsMdToPdf({ fixtureDir, inputPath, outputPath, runtime });
    });
  });

  test("keeps page numbers profile-owned when rendering with template and CSS", async () => {
    await withTempFixtureDir(
      "md-pdf-template-codex-profile-page-number-compat",
      async (fixtureDir) => {
        const inputPath = join(fixtureDir, "report.md");
        const profilePath = join(fixtureDir, "profile.yml");
        const outputPath = join(fixtureDir, "template-output");
        const renderedStyles: string[] = [];
        await writeFile(inputPath, "# Report\n\nBody.\n", "utf8");
        await writeFile(
          profilePath,
          [
            "pageNumbers:",
            "  enabled: true",
            "  position: bottom-center",
            "  format: 'Page {page}'",
            "",
          ].join("\n"),
          "utf8",
        );

        const { runtime } = createActionTestRuntime();
        await actionMdPdfTemplateCodex(runtime, {
          input: toRepoRelativePath(inputPath),
          output: toRepoRelativePath(outputPath),
          codexRunner: stubCodexRunner(codexTemplateResponse({ coverEnabled: false })),
        });

        const templateCss = await readFile(join(outputPath, "style.css"), "utf8");
        expect(templateCss).not.toContain("counter(page)");
        expect(templateCss).not.toContain("@bottom-center");

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

        await actionMdToPdf(runtime, {
          input: toRepoRelativePath(inputPath),
          profile: toRepoRelativePath(profilePath),
          template: toRepoRelativePath(join(outputPath, "template.html")),
          css: toRepoRelativePath(join(outputPath, "style.css")),
          runner: capturingRunner,
        });

        const combinedCss = renderedStyles.join("\n");
        expect(combinedCss).toContain("@bottom-center");
        expect(combinedCss).toContain("counter(page)");
      },
    );
  });
});
