import { describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { actionMdPdfTemplateCodex, actionMdToPdf } from "../../src/cli/actions/markdown";
import type { MarkdownPdfTemplateCodexRunner } from "../../src/adapters/codex/markdown-pdf-template";
import { createPdfRunner } from "../cli-actions-md-to-pdf.helpers";
import { createActionTestRuntime } from "../helpers/cli-action-test-utils";
import { toRepoRelativePath, withTempFixtureDir } from "../helpers/cli-test-utils";
import { minimalJpeg, minimalPng, minimalWebpVp8x1200By800, pathExists } from "./fixtures";

function codexTemplateResponse(
  input: {
    coverEnabled?: boolean;
    cssBlocks?: Array<{ css: string; slot: string }>;
    decisionMode?: string;
    fallbackReason?: string;
    imageFit?: string;
    templateFamily?: string;
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
        image_fit: coverEnabled ? (input.imageFit ?? "cover") : "",
        layout: coverEnabled ? "contained-media" : "none",
        title_placement: coverEnabled ? "below-media" : "document-title",
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
        image_fit: "",
        layout: "none",
        title_placement: "document-title",
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
  const pdfPath = join(input.fixtureDir, "report.pdf");
  const { calls, runner } = createPdfRunner({
    html: "<html><body><main>Body.</main></body></html>",
  });
  await actionMdToPdf(input.runtime, {
    input: toRepoRelativePath(input.inputPath),
    output: toRepoRelativePath(pdfPath),
    template: toRepoRelativePath(join(input.outputPath, "template.html")),
    css: toRepoRelativePath(join(input.outputPath, "style.css")),
    runner,
  });

  const pandocRender = calls.find(
    (call) => call.command === "pandoc" && !call.args.includes("--version"),
  );
  expect(pandocRender?.args).toContain(join(input.outputPath, "template.html"));
  const weasyprintRender = calls.find(
    (call) => call.command === "weasyprint" && !call.args.includes("--info"),
  );
  expect(weasyprintRender?.args).toContain(join(input.outputPath, "style.css"));
  expect(await readFile(pdfPath, "utf8")).toContain("%PDF");
}

describe("cli action modules: md pdf-template codex integration", () => {
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
        files: Array<{ role: string }>;
      };
      expect(report.artifactType).toBe("markdown-pdf-codex-template-report");
      expect(report.files.map((file) => file.role)).toEqual([
        "template-html",
        "style-css",
        "diagnostic-report",
      ]);
    });
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

  test("writes requested reports for no-usable-template Codex decisions without recipe files", async () => {
    await withTempFixtureDir("md-pdf-template-codex-action-no-usable", async (fixtureDir) => {
      const inputPath = join(fixtureDir, "report.md");
      const outputPath = join(fixtureDir, "template-output");
      const reportPath = join(fixtureDir, "template-report.json");
      await writeFile(inputPath, "# Report\n", "utf8");

      const { runtime, stderr, stdout } = createActionTestRuntime();
      await actionMdPdfTemplateCodex(runtime, {
        input: toRepoRelativePath(inputPath),
        intent: "download a remote animated cover",
        output: toRepoRelativePath(outputPath),
        codexReportOutput: toRepoRelativePath(reportPath),
        codexRunner: stubCodexRunner(noUsableTemplateResponse()),
      });

      expect(stdout.text).toContain("Decision mode: no-usable-template");
      expect(stdout.text).toContain("Fallback reason: Unsupported template direction.");
      expect(stderr.text).toContain("Wrote Codex report:");
      expect(await pathExists(join(outputPath, "template.html"))).toBe(false);
      expect(await pathExists(join(outputPath, "style.css"))).toBe(false);
      const report = JSON.parse(await readFile(reportPath, "utf8")) as {
        decision: {
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

  test("generated cover template bundles can feed md to-pdf template and CSS options", async () => {
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
});
