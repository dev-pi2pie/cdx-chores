import { writeTextFileSafe } from "../../file-io";
import type { CliRuntime } from "../../types";
import { publicPathBasename, publicPathDisplay } from "../codex-path-display";
import { collectMdPdfProjectCodexUnsupportedDirections } from "./diagnostics";
import {
  sanitizeMdPdfProjectCodexReportText,
  sanitizeMdPdfProjectCodexReportTexts,
} from "./report-redaction";
import type {
  MarkdownPdfProjectCodexOutputPlan,
  MarkdownPdfProjectCodexPlannedAsset,
  MarkdownPdfProjectCodexPlannedFile,
  MdPdfProjectCodexSignalCollection,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";
import type { MdPdfProjectCodexProfilePhaseResult } from "./profile-phase";
import type { MdPdfProjectCodexTemplatePhaseResult } from "./template-phase";
import {
  MARKDOWN_PDF_PROJECT_CODEX_REPORT_ARTIFACT_TYPE,
  type MarkdownPdfProjectCodexReportArtifact,
  type MarkdownPdfProjectCodexReportFileRole,
  type MarkdownPdfProjectCodexReportManagedAsset,
} from "./types-report";
import type {
  MarkdownPdfProjectCodexValidationResult,
  MarkdownPdfProjectCodexValidationSummary,
} from "./validate-project";

function reportArtifactId(projectBundleId: string): string {
  return `${projectBundleId}-project-report`;
}

function plannedFile(
  role: MarkdownPdfProjectCodexReportFileRole,
  file: MarkdownPdfProjectCodexPlannedFile,
) {
  return {
    role,
    bundlePath: file.bundlePath,
    planned: true,
  };
}

type MarkdownPdfProjectCodexCoverImageAsset = Pick<
  MarkdownPdfProjectCodexPlannedAsset,
  "bundlePath" | "role" | "sourceBasename"
> & {
  role: "cover-image";
};

function coverImageAssetReport(input: {
  asset: MarkdownPdfProjectCodexCoverImageAsset;
  signals: MdPdfProjectCodexSignalCollection;
}): MarkdownPdfProjectCodexReportManagedAsset {
  const coverImage = input.signals.template.coverImage;
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

function inputCoverImageReport(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
}): MarkdownPdfProjectCodexReportManagedAsset | undefined {
  if (!input.state.coverImagePath) {
    return undefined;
  }
  const plannedAsset =
    input.outputPlan.assets.find((asset) => asset.role === "cover-image") ??
    ({
      bundlePath: "assets/cover",
      role: "cover-image",
      sourceBasename: publicPathBasename(input.state.coverImagePath),
    } satisfies Pick<
      MarkdownPdfProjectCodexPlannedAsset,
      "bundlePath" | "role" | "sourceBasename"
    >);
  return coverImageAssetReport({ asset: plannedAsset, signals: input.signals });
}

function documentSummary(
  signals: MdPdfProjectCodexSignalCollection,
): MarkdownPdfProjectCodexReportArtifact["signals"]["document"] {
  const document = signals.shared.document;
  return {
    available: document.available,
    headingCount: document.headings.total,
    maxHeadingDepth: document.headings.maxDepth,
    maxTableColumns: document.tables.maxColumns,
    localAssetCount: document.assets.localCount,
    remoteAssetCount: document.assets.remoteCount,
    dataUriAssetCount: document.assets.dataUriCount,
    scriptBuckets: document.scripts.buckets,
    textTruncated: document.scripts.truncated,
  };
}

function reportFiles(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  runtime: CliRuntime;
  validation: MarkdownPdfProjectCodexValidationSummary;
}): MarkdownPdfProjectCodexReportArtifact["files"] {
  const files: MarkdownPdfProjectCodexReportArtifact["files"] =
    input.validation.decisionMode === "no-usable-project"
      ? []
      : [
          plannedFile("profile", input.outputPlan.profile),
          plannedFile("template-html", input.outputPlan.templateHtml),
          plannedFile("style-css", input.outputPlan.styleCss),
          ...input.outputPlan.assets.map((asset) => plannedFile("managed-asset", asset)),
        ];

  if (input.outputPlan.report) {
    files.push(
      input.outputPlan.report.location === "in-bundle"
        ? plannedFile("project-report", input.outputPlan.report)
        : {
            role: "project-report",
            path:
              publicPathDisplay(input.runtime, input.outputPlan.report.path)?.display ??
              publicPathBasename(input.outputPlan.report.path),
            planned: true,
          },
    );
  }

  return files;
}

function sanitizeProjectFallbackReason(value: string | undefined): { fallbackReason?: string } {
  return value ? { fallbackReason: sanitizeMdPdfProjectCodexReportText(value) } : {};
}

function publicProjectReportWritePath(runtime: CliRuntime): (path: string) => string {
  return (path) => publicPathDisplay(runtime, path)?.display ?? publicPathBasename(path);
}

function sanitizePhaseSummary<T extends { fallbackReason?: string; warnings: string[] }>(
  phase: T,
): T {
  return {
    ...phase,
    ...sanitizeProjectFallbackReason(phase.fallbackReason),
    warnings: sanitizeMdPdfProjectCodexReportTexts(phase.warnings),
  };
}

function sanitizeValidationResults(
  results: readonly MarkdownPdfProjectCodexValidationResult[],
): MarkdownPdfProjectCodexValidationResult[] {
  return results.map((result) => ({
    ...result,
    ...(result.message ? { message: sanitizeMdPdfProjectCodexReportText(result.message) } : {}),
  }));
}

export function createMdPdfProjectCodexReportArtifact(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  runtime: CliRuntime;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
  validation: MarkdownPdfProjectCodexValidationSummary;
}): MarkdownPdfProjectCodexReportArtifact {
  const coverImage = inputCoverImageReport(input);
  return {
    artifactType: MARKDOWN_PDF_PROJECT_CODEX_REPORT_ARTIFACT_TYPE,
    version: 1,
    advisoryOnly: true,
    reportId: reportArtifactId(input.outputPlan.identity.projectBundleId),
    generatedAt: input.runtime.now().toISOString(),
    identities: {
      projectBundleId: input.outputPlan.identity.projectBundleId,
      profileId: input.outputPlan.identity.profileId,
      templateBundleId: input.outputPlan.identity.templateBundleId,
      createdAt: input.outputPlan.identity.createdAt,
    },
    project: {
      signalMode: input.signals.modes.project,
      decisionMode: input.validation.decisionMode,
      ...sanitizeProjectFallbackReason(input.validation.fallbackReason),
    },
    phases: {
      profile: sanitizePhaseSummary(input.profilePhase.phase),
      template: sanitizePhaseSummary(input.templatePhase.phase),
    },
    input: {
      ...(input.state.inputPath
        ? { markdown: publicPathDisplay(input.runtime, input.state.inputPath) }
        : {}),
      ...(input.state.intent
        ? { intent: sanitizeMdPdfProjectCodexReportText(input.state.intent) }
        : {}),
      fontHints: sanitizeMdPdfProjectCodexReportTexts(input.state.fontHints),
      ...(input.state.baseProfilePath
        ? { baseProfile: publicPathDisplay(input.runtime, input.state.baseProfilePath) }
        : {}),
      ...(coverImage ? { coverImage } : {}),
    },
    signals: {
      document: documentSummary(input.signals),
      templateOwnedDirections: {
        document: input.signals.template.ownedSignals.documentDirections,
        intent: input.signals.template.ownedSignals.intentDirections,
        requiresCodex: input.signals.template.ownedSignals.requiresCodex,
      },
    },
    unsupportedDirections: sanitizeMdPdfProjectCodexReportTexts(
      collectMdPdfProjectCodexUnsupportedDirections(input),
    ),
    files: reportFiles(input),
    managedAssets:
      input.validation.decisionMode === "no-usable-project"
        ? []
        : input.templatePhase.synthesis.managedAssets.flatMap((managedAsset) => {
            if (managedAsset.role !== "cover-image") {
              return [];
            }
            const plannedAsset = input.outputPlan.assets.find(
              (asset) =>
                asset.role === "cover-image" && asset.bundlePath === managedAsset.bundlePath,
            );
            return plannedAsset
              ? [coverImageAssetReport({ asset: plannedAsset, signals: input.signals })]
              : [];
          }),
    validationResults: sanitizeValidationResults(input.validation.results),
    ...(input.validation.renderCommand
      ? { followUpRenderCommand: input.validation.renderCommand }
      : {}),
  };
}

export function serializeMdPdfProjectCodexReportArtifact(
  report: MarkdownPdfProjectCodexReportArtifact,
): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export async function writeMdPdfProjectCodexReportArtifact(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  overwrite?: boolean;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  runtime: CliRuntime;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
  validation: MarkdownPdfProjectCodexValidationSummary;
}): Promise<void> {
  if (!input.outputPlan.report) {
    return;
  }
  await writeTextFileSafe(
    input.outputPlan.report.path,
    serializeMdPdfProjectCodexReportArtifact(createMdPdfProjectCodexReportArtifact(input)),
    {
      displayPath: publicProjectReportWritePath(input.runtime),
      label: "--codex-report-output",
      overwrite: input.overwrite,
      parentRootDirectory:
        input.outputPlan.report.location === "in-bundle"
          ? input.outputPlan.outputDirectory
          : input.runtime.cwd,
      sanitizeMessage: sanitizeMdPdfProjectCodexReportText,
    },
  );
}
