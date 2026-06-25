import { basename, relative } from "node:path";

import { writeTextFileSafe } from "../../file-io";
import type { CliRuntime } from "../../types";
import type {
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexPlannedAsset,
  MarkdownPdfTemplateCodexPlannedFile,
  MarkdownPdfTemplateCodexSynthesisResult,
  MdPdfTemplateCodexSignalCollection,
  NormalizedMdPdfTemplateCodexCommandState,
} from "./types";

export const MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_ARTIFACT_TYPE =
  "markdown-pdf-codex-template-report";

type MdPdfTemplateCodexReportFileRole =
  | "template-html"
  | "style-css"
  | "managed-asset"
  | "diagnostic-report";

interface MdPdfTemplateCodexReportPathDisplay {
  display: string;
  basename: string;
  redacted: boolean;
}

interface MdPdfTemplateCodexReportManagedAsset {
  role: MarkdownPdfTemplateCodexPlannedAsset["role"];
  bundlePath: string;
  source: MdPdfTemplateCodexReportPathDisplay;
  format?: NonNullable<MdPdfTemplateCodexSignalCollection["coverImage"]["format"]>;
  dimensions?: MdPdfTemplateCodexSignalCollection["coverImage"]["dimensions"];
  aspectRatio?: number;
  orientationBucket: MdPdfTemplateCodexSignalCollection["coverImage"]["orientationBucket"];
  fitPressure: MdPdfTemplateCodexSignalCollection["coverImage"]["fitPressure"];
  metadataStatus?: MdPdfTemplateCodexSignalCollection["coverImage"]["metadataStatus"];
}

export interface MdPdfTemplateCodexReportArtifact {
  artifactType: typeof MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_ARTIFACT_TYPE;
  version: 1;
  advisoryOnly: true;
  reportId: string;
  templateBundleId: string;
  generatedAt: string;
  signalMode: MdPdfTemplateCodexSignalCollection["signalMode"];
  decision: {
    mode: MarkdownPdfTemplateCodexSynthesisResult["decisionMode"];
    templateFamily?: MarkdownPdfTemplateCodexSynthesisResult["templateFamily"];
    recipePreset?: string;
    recipePresetSource?: string;
    fallbackReason?: string;
    warnings: string[];
    unsupportedDirections: string[];
    cover: Omit<
      MarkdownPdfTemplateCodexSynthesisResult["slots"]["cover"],
      "layout" | "titlePlacement"
    >;
    fontDecisions: MarkdownPdfTemplateCodexSynthesisResult["fontDecisions"];
    layoutPolicy: MdPdfTemplateCodexSignalCollection["recipe"]["layoutPolicy"];
    titlePolicy: MarkdownPdfTemplateCodexSynthesisResult["titlePolicy"];
  };
  input: {
    markdown?: MdPdfTemplateCodexReportPathDisplay;
    intent?: string;
    fontHints: string[];
  };
  baseProfile: MdPdfTemplateCodexSignalCollection["baseProfile"] & {
    source?: MdPdfTemplateCodexReportPathDisplay;
  };
  recipe: {
    explicitFields: string[];
    baseProfileFields: string[];
    effectivePreset: string;
    effectivePageSize: string;
    effectiveOrientation: string;
    tocEnabled: boolean;
    tocDepth: number;
    tocPageBreak: string;
  };
  managedAssets: MdPdfTemplateCodexReportManagedAsset[];
  files: Array<{
    role: MdPdfTemplateCodexReportFileRole;
    bundlePath?: string;
    path?: string;
    planned: boolean;
  }>;
  validationResults: Array<{
    name: string;
    status: "passed" | "skipped";
  }>;
  followUpRenderCommand?: string;
}

function pathInsideCwd(runtime: CliRuntime, path: string): boolean {
  const repoRelative = relative(runtime.cwd, path);
  return repoRelative === "" || (!repoRelative.startsWith("..") && !repoRelative.startsWith("/"));
}

function redactedPathDisplay(
  runtime: CliRuntime,
  path: string | undefined,
): MdPdfTemplateCodexReportPathDisplay | undefined {
  if (!path) {
    return undefined;
  }
  const insideCwd = pathInsideCwd(runtime, path);
  const relativePath = relative(runtime.cwd, path);
  return {
    display: insideCwd ? (relativePath.length > 0 ? relativePath : ".") : basename(path),
    basename: basename(path),
    redacted: !insideCwd,
  };
}

function reportArtifactId(bundleId: string): string {
  return `${bundleId}-diagnostic-report`;
}

function coverDecisionReport(
  cover: MarkdownPdfTemplateCodexSynthesisResult["slots"]["cover"],
): Omit<MarkdownPdfTemplateCodexSynthesisResult["slots"]["cover"], "layout" | "titlePlacement"> {
  return {
    enabled: cover.enabled,
    byline: cover.byline,
    composition: cover.composition,
    imageFit: cover.imageFit,
    imageAnchor: cover.imageAnchor,
    mediaAlign: cover.mediaAlign,
    mediaScale: cover.mediaScale,
    textAlign: cover.textAlign,
    style: cover.style,
    orientationBucket: cover.orientationBucket,
    fitPressure: cover.fitPressure,
  };
}

function recipeSummary(
  signals: MdPdfTemplateCodexSignalCollection,
): MdPdfTemplateCodexReportArtifact["recipe"] {
  const options = signals.recipe.effectiveOptions;
  return {
    explicitFields: signals.recipe.explicitFields,
    baseProfileFields: signals.recipe.baseProfileFields,
    effectivePreset: options.preset,
    effectivePageSize: options.pageSize,
    effectiveOrientation: options.orientation,
    tocEnabled: options.toc,
    tocDepth: options.tocDepth,
    tocPageBreak: options.tocPageBreak,
  };
}

function managedAssetReport(input: {
  asset: MarkdownPdfTemplateCodexPlannedAsset;
  signals: MdPdfTemplateCodexSignalCollection;
}): MdPdfTemplateCodexReportManagedAsset {
  const coverImage = input.signals.coverImage;
  return {
    role: input.asset.role,
    bundlePath: input.asset.bundlePath,
    source: {
      display: input.asset.sourceBasename,
      basename: input.asset.sourceBasename,
      redacted: true,
    },
    ...(coverImage.format ? { format: coverImage.format } : {}),
    ...(coverImage.dimensions ? { dimensions: coverImage.dimensions } : {}),
    ...(coverImage.aspectRatio ? { aspectRatio: coverImage.aspectRatio } : {}),
    orientationBucket: coverImage.orientationBucket,
    fitPressure: coverImage.fitPressure,
    ...(coverImage.metadataStatus ? { metadataStatus: coverImage.metadataStatus } : {}),
  };
}

function plannedFile(
  role: MdPdfTemplateCodexReportFileRole,
  file: MarkdownPdfTemplateCodexPlannedFile,
) {
  return {
    role,
    bundlePath: file.bundlePath,
    planned: true,
  };
}

function reportFiles(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  runtime: CliRuntime;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): MdPdfTemplateCodexReportArtifact["files"] {
  const files: MdPdfTemplateCodexReportArtifact["files"] =
    input.synthesis.decisionMode === "no-usable-template"
      ? []
      : [
          plannedFile("template-html", input.outputPlan.templateHtml),
          plannedFile("style-css", input.outputPlan.styleCss),
          ...input.outputPlan.assets.map((asset) => plannedFile("managed-asset", asset)),
        ];
  if (input.outputPlan.report) {
    files.push(
      input.outputPlan.report.location === "in-bundle"
        ? plannedFile("diagnostic-report", input.outputPlan.report)
        : {
            role: "diagnostic-report",
            path:
              redactedPathDisplay(input.runtime, input.outputPlan.report.path)?.display ??
              basename(input.outputPlan.report.path),
            planned: true,
          },
    );
  }
  return files;
}

function followUpRenderCommand(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  runtime: CliRuntime;
  state: NormalizedMdPdfTemplateCodexCommandState;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): string | undefined {
  if (input.synthesis.decisionMode === "no-usable-template") {
    return undefined;
  }
  const inputPath = input.state.inputPath
    ? (redactedPathDisplay(input.runtime, input.state.inputPath)?.display ?? "<input.md>")
    : "<input.md>";
  const templatePath = `<template-bundle>/${input.outputPlan.templateHtml.bundlePath}`;
  const cssPath = `<template-bundle>/${input.outputPlan.styleCss.bundlePath}`;
  return `cdx-chores md to-pdf --input ${inputPath} --template ${templatePath} --css ${cssPath} --output <output.pdf>`;
}

export function createMdPdfTemplateCodexReportArtifact(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  runtime: CliRuntime;
  signals: MdPdfTemplateCodexSignalCollection;
  state: NormalizedMdPdfTemplateCodexCommandState;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): MdPdfTemplateCodexReportArtifact {
  return {
    artifactType: MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_ARTIFACT_TYPE,
    version: 1,
    advisoryOnly: true,
    reportId: reportArtifactId(input.outputPlan.bundleId),
    templateBundleId: input.outputPlan.bundleId,
    generatedAt: input.runtime.now().toISOString(),
    signalMode: input.signals.signalMode,
    decision: {
      mode: input.synthesis.decisionMode,
      ...(input.synthesis.decisionMode !== "no-usable-template"
        ? {
            templateFamily: input.synthesis.templateFamily,
            recipePreset: input.synthesis.slots.recipePreset.preset,
            recipePresetSource: input.synthesis.slots.recipePreset.source,
          }
        : {}),
      ...(input.synthesis.fallbackReason ? { fallbackReason: input.synthesis.fallbackReason } : {}),
      warnings: input.synthesis.warnings ?? [],
      unsupportedDirections: input.synthesis.unsupportedDirections ?? [],
      cover: coverDecisionReport(input.synthesis.slots.cover),
      fontDecisions: input.synthesis.fontDecisions,
      layoutPolicy: input.signals.recipe.layoutPolicy,
      titlePolicy: input.synthesis.titlePolicy,
    },
    input: {
      ...(input.state.inputPath
        ? { markdown: redactedPathDisplay(input.runtime, input.state.inputPath) }
        : {}),
      ...(input.state.intent ? { intent: input.state.intent } : {}),
      fontHints: input.state.fontHints,
    },
    baseProfile: {
      ...input.signals.baseProfile,
      ...(input.state.baseProfilePath
        ? { source: redactedPathDisplay(input.runtime, input.state.baseProfilePath) }
        : {}),
    },
    recipe: recipeSummary(input.signals),
    managedAssets: input.outputPlan.assets.map((asset) =>
      managedAssetReport({ asset, signals: input.signals }),
    ),
    files: reportFiles(input),
    validationResults: [
      {
        name: "static-template-validation",
        status: input.synthesis.decisionMode === "no-usable-template" ? "skipped" : "passed",
      },
    ],
    ...(followUpRenderCommand(input)
      ? { followUpRenderCommand: followUpRenderCommand(input) }
      : {}),
  };
}

export function serializeMdPdfTemplateCodexReportArtifact(
  report: MdPdfTemplateCodexReportArtifact,
): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export async function writeMdPdfTemplateCodexReportArtifact(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  overwrite?: boolean;
  runtime: CliRuntime;
  signals: MdPdfTemplateCodexSignalCollection;
  state: NormalizedMdPdfTemplateCodexCommandState;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): Promise<void> {
  if (!input.outputPlan.report) {
    return;
  }
  await writeTextFileSafe(
    input.outputPlan.report.path,
    serializeMdPdfTemplateCodexReportArtifact(createMdPdfTemplateCodexReportArtifact(input)),
    { overwrite: input.overwrite },
  );
}
