import { expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  executePlannedMarkdownPdfRender,
  planMarkdownPdfRender,
  prepareMarkdownPdfRender,
} from "../../../../src/cli/actions";
import {
  prepareMdPdfProjectCodex,
  rebindMdPdfProjectCodexPreparedArtifact,
  writePreparedMdPdfProjectCodexBundle,
} from "../../../../src/cli/markdown-pdf/project-codex";
import { MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME } from "../../../../src/cli/markdown-pdf/profile/page-number-format";
import type {
  MarkdownPdfProcessRunner,
  MarkdownPdfRendererCapabilityRequest,
} from "../../../../src/cli/markdown-pdf";
import { ok } from "../render-support";
import { createActionTestRuntime } from "../../../helpers/cli-action-test-utils";
import { withTempFixtureDir } from "../../../helpers/cli-test-utils";

const PROJECT_PROFILE = [
  "header:",
  "  center: Existing page chrome",
  "pageNumbers:",
  "  enabled: true",
  "  scope: body",
  "  countFrom: body",
  "  start: 0",
  "  increment: 2",
  "  position: top-center",
  '  format: "Page {page} of {pages} (PDF {pdfPage} of {pdfPages})"',
  "",
].join("\n");

const EXPECTED_CAPABILITY_REQUESTS = [
  { capabilityId: "pageNumbers.start", requestedBy: ["pageNumbers.start"] },
  { capabilityId: "pageNumbers.increment", requestedBy: ["pageNumbers.increment"] },
  {
    capabilityId: "pageNumbers.countFrom.body",
    requestedBy: ["pageNumbers.countFrom"],
  },
  { capabilityId: "pageNumbers.logicalFinal", requestedBy: ["pageNumbers.format"] },
  { capabilityId: "pageNumbers.physicalCurrent", requestedBy: ["pageNumbers.format"] },
  { capabilityId: "pageNumbers.physicalTotal", requestedBy: ["pageNumbers.format"] },
] satisfies MarkdownPdfRendererCapabilityRequest[];

function adaptedProfileResponse(): string {
  return JSON.stringify({
    decision_mode: "adapted",
    selected_candidate_id: "base-profile",
    accepted_patches: [],
    accepted_font_patches: [],
    reasoning: "Keep the reusable page-number configuration.",
    warnings: [],
    fallback_reason: "",
    unmatched_directions: [],
  });
}

function adaptedTemplateResponse(): string {
  return JSON.stringify({
    decision_mode: "adapted",
    template_family: "document-layered",
    recipe_preset: "article",
    slots: {
      recipe_preset: { preset: "article", source: "renderer-default" },
      cover: {
        enabled: false,
        byline: "none",
        composition: "text-first",
        image_fit: "cover",
        image_anchor: "center",
        media_align: "center",
        media_scale: "standard",
        text_align: "left",
        style: "none",
        orientation_bucket: "unknown",
        fit_pressure: "normal",
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
    warnings: [],
    unsupported_directions: [],
    fallback_reason: "",
  });
}

interface CapturedRender {
  html: string[];
  stylesheets: string[][];
}

function capturingPdfRunner(captured: CapturedRender): MarkdownPdfProcessRunner {
  return async (command, args) => {
    if (command === "pandoc" && args.includes("--version")) {
      return ok("pandoc 3.1\n");
    }
    if (command === "weasyprint" && args.includes("--info")) {
      return ok("WeasyPrint version 68.0\n");
    }
    if (command === "pandoc") {
      const inputPath = args[0];
      const templatePath = args[args.indexOf("--template") + 1];
      const outputPath = args[args.indexOf("--output") + 1];
      if (!inputPath || !templatePath || !outputPath) {
        throw new Error("expected complete mocked Pandoc inputs");
      }
      const templateHtml = await readFile(templatePath, "utf8");
      const markdown = await readFile(inputPath, "utf8");
      await writeFile(
        outputPath,
        templateHtml.replaceAll("$body$", `<main data-mocked-pandoc>${markdown}</main>`),
        "utf8",
      );
      return ok();
    }
    if (command === "weasyprint") {
      const htmlPath = args.at(-2);
      const outputPath = args.at(-1);
      if (!htmlPath || !outputPath) {
        throw new Error("expected complete mocked WeasyPrint inputs");
      }
      const preparedHtml = await readFile(htmlPath, "utf8");
      captured.html.push(preparedHtml);

      const stylesheets: string[] = [];
      for (let index = 0; index < args.length; index += 1) {
        if (args[index] === "--stylesheet" && args[index + 1]) {
          stylesheets.push(await readFile(args[index + 1]!, "utf8"));
        }
      }
      captured.stylesheets.push(stylesheets);
      await writeFile(
        outputPath,
        `%PDF-1.7\n${JSON.stringify({ html: preparedHtml, stylesheets })}\n`,
        "utf8",
      );
      return ok();
    }
    throw new Error(`unexpected mocked renderer command: ${command}`);
  };
}

test("canonical Project bundle and explicit roles produce an equivalent render handoff", async () => {
  await withTempFixtureDir("md-pdf-project-handoff-equivalence", async (fixtureDir) => {
    await writeFile(join(fixtureDir, "report.md"), "# Report\n\nPrepared body.\n", "utf8");
    await writeFile(join(fixtureDir, "base.yml"), PROJECT_PROFILE, "utf8");
    const { runtime } = createActionTestRuntime({
      cwd: fixtureDir,
      now: () => new Date("2026-08-13T01:02:03.000Z"),
    });

    const preparedProject = await prepareMdPdfProjectCodex(runtime, {
      baseProfile: "base.yml",
      dryRun: true,
      input: "report.md",
      output: "planned-project",
      identityUidFactory: () => "ba5e900d",
      profileCodexRunner: async () => adaptedProfileResponse(),
      templateCodexRunner: async () => adaptedTemplateResponse(),
    });
    const writtenProject = await rebindMdPdfProjectCodexPreparedArtifact({
      prepared: preparedProject,
      runtime,
      outputDirectory: "project",
      dryRun: false,
      report: { kind: "with-artifact" },
    });
    await writePreparedMdPdfProjectCodexBundle(runtime, writtenProject);

    const bundlePrepared = await prepareMarkdownPdfRender(runtime, {
      input: "report.md",
      bundle: "project",
    });
    const explicitPrepared = await prepareMarkdownPdfRender(runtime, {
      input: "report.md",
      profile: "project/profile.yml",
      template: "project/template.html",
      css: "project/style.css",
    });

    expect(bundlePrepared.normalizedProfile).toEqual(explicitPrepared.normalizedProfile);
    expect(bundlePrepared.pageNumberConfiguration).toEqual(
      explicitPrepared.pageNumberConfiguration,
    );
    expect(bundlePrepared.diagnostics).toEqual(explicitPrepared.diagnostics);
    expect(bundlePrepared.rendererCapabilityRequests).toEqual(
      explicitPrepared.rendererCapabilityRequests,
    );
    expect(bundlePrepared.templateCompatibility).toEqual(explicitPrepared.templateCompatibility);
    expect(bundlePrepared.recipe.styleCss).toBe(explicitPrepared.recipe.styleCss);
    expect(bundlePrepared.recipe.templateHtml).toBe(explicitPrepared.recipe.templateHtml);
    expect(bundlePrepared.pageNumberConfiguration.effective).toMatchObject({
      countFrom: "body",
      enabled: true,
      increment: 2,
      scope: "body",
      start: 0,
    });
    expect(bundlePrepared.diagnostics.conditions.map(({ conditionId }) => conditionId)).toEqual([
      "MARKDOWN_PDF_PAGE_NUMBER_SLOT_OCCUPIED",
    ]);
    expect(
      bundlePrepared.rendererCapabilityRequests.map(({ capabilityId, requestedBy }) => ({
        capabilityId,
        requestedBy,
      })),
    ).toEqual(EXPECTED_CAPABILITY_REQUESTS);
    expect(
      writtenProject.binding.validation.capabilityRequirements.map(
        ({ capabilityId, requestedBy }) => ({ capabilityId, requestedBy }),
      ),
    ).toEqual(EXPECTED_CAPABILITY_REQUESTS);
    expect(bundlePrepared.templateCompatibility).toMatchObject({ bodyBoundary: "proven" });
    expect(bundlePrepared.recipe.styleCss).toContain("@page body:nth(1 of body)");
    expect(bundlePrepared.recipe.styleCss).toContain(
      `counter-increment: ${MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME} 2;`,
    );

    const bundleCapture: CapturedRender = { html: [], stylesheets: [] };
    const explicitCapture: CapturedRender = { html: [], stylesheets: [] };
    const bundlePlan = await planMarkdownPdfRender(runtime, bundlePrepared, {
      output: "bundle.pdf",
      htmlOutput: "bundle.html",
    });
    const explicitPlan = await planMarkdownPdfRender(runtime, explicitPrepared, {
      output: "explicit.pdf",
      htmlOutput: "explicit.html",
    });
    const bundleResult = await executePlannedMarkdownPdfRender(runtime, bundlePlan, {
      runner: capturingPdfRunner(bundleCapture),
    });
    const explicitResult = await executePlannedMarkdownPdfRender(runtime, explicitPlan, {
      runner: capturingPdfRunner(explicitCapture),
    });

    expect(bundleCapture).toEqual(explicitCapture);
    expect(await readFile(join(fixtureDir, "bundle.html"), "utf8")).toBe(
      await readFile(join(fixtureDir, "explicit.html"), "utf8"),
    );
    expect(await readFile(join(fixtureDir, "bundle.pdf"), "utf8")).toBe(
      await readFile(join(fixtureDir, "explicit.pdf"), "utf8"),
    );
    expect(bundleResult.diagnostics).toEqual(explicitResult.diagnostics);
    expect(bundleResult.rendererCapabilities).toEqual(explicitResult.rendererCapabilities);
    expect(bundleResult.warnings).toEqual(explicitResult.warnings);

    const serializedReport = await readFile(
      join(fixtureDir, "project", "project.codex-report.json"),
      "utf8",
    );
    const report = JSON.parse(serializedReport) as {
      handoff: {
        artifacts: { availability: string };
        capabilityRequirements: Array<{
          capabilityId: string;
          minimumVersion: string;
          requestedBy: string[];
        }>;
        diagnostics: typeof bundlePrepared.diagnostics.conditions;
        render: {
          usability: string;
          command?: { executable: string; args: string[]; display: string };
        };
      };
    };
    expect(report.handoff).toMatchObject({
      artifacts: { availability: "written" },
      render: {
        usability: "usable",
        command: {
          executable: "cdx-chores",
          args: [
            "md",
            "to-pdf",
            "--input",
            "report.md",
            "--bundle",
            "project",
            "--output",
            "<output.pdf>",
          ],
        },
      },
    });
    expect(report.handoff.render.command?.display).toBe(
      "cdx-chores 'md' 'to-pdf' '--input' 'report.md' '--bundle' 'project' '--output' '<output.pdf>'",
    );
    expect(report.handoff.diagnostics).toEqual(bundlePrepared.diagnostics.conditions);
    expect(report.handoff.capabilityRequirements).toEqual(
      writtenProject.binding.validation.capabilityRequirements,
    );
    expect(
      report.handoff.capabilityRequirements.map(({ capabilityId, requestedBy }) => ({
        capabilityId,
        requestedBy,
      })),
    ).toEqual(EXPECTED_CAPABILITY_REQUESTS);
    expect(serializedReport).not.toContain(fixtureDir);
    expect(JSON.stringify(report)).not.toContain(fixtureDir);
  });
});
