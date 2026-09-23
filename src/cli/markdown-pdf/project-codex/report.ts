import { isDeepStrictEqual } from "node:util";

import { writeTextFileSafe } from "../../file-io";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import { publicPathBasename, publicPathDisplay } from "../codex-path-display";
import {
  createMarkdownPdfCodexReportPageInformation,
  validateMarkdownPdfCodexReportPageInformation,
} from "../codex-report/page-information";
import type { MarkdownPdfPageInformationSlotResolution } from "../profile-codex/page-information-materialization";
import { collectMdPdfProjectCodexUnsupportedDirections } from "./diagnostics";
import { createMdPdfProjectCodexHandoffProjection } from "./handoff-projection";
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
  projectRolesPlanned?: boolean;
  runtime: CliRuntime;
  validation: MarkdownPdfProjectCodexValidationSummary;
}): MarkdownPdfProjectCodexReportArtifact["files"] {
  const files: MarkdownPdfProjectCodexReportArtifact["files"] =
    input.validation.decisionMode === "no-usable-project" || input.projectRolesPlanned === false
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
  projectArtifactsWritten?: boolean;
  projectRolesPlanned?: boolean;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  runtime: CliRuntime;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
  validation: MarkdownPdfProjectCodexValidationSummary;
  slotResolution?: MarkdownPdfPageInformationSlotResolution;
  modelCallAttempted?: boolean;
}): MarkdownPdfProjectCodexReportArtifact {
  const coverImage = inputCoverImageReport(input);
  const handoff = createMdPdfProjectCodexHandoffProjection(input);
  const pageInformation = createMarkdownPdfCodexReportPageInformation({
    pageInformation: input.signals.profile.pageInformation,
    finalProfile: input.profilePhase.finalProfile,
    slotResolution: input.slotResolution,
    modelCallAttempted:
      input.modelCallAttempted ??
      Boolean(input.profilePhase.codexResult || input.templatePhase.codexResult),
  });
  return {
    artifactType: MARKDOWN_PDF_PROJECT_CODEX_REPORT_ARTIFACT_TYPE,
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
        document: sanitizeMdPdfProjectCodexReportTexts(
          input.signals.template.ownedSignals.documentDirections,
        ),
        intent: sanitizeMdPdfProjectCodexReportTexts(
          input.signals.template.ownedSignals.intentDirections,
        ),
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
    ...(pageInformation ? { pageInformation } : {}),
    ...(handoff.render.usability === "unavailable"
      ? {}
      : { followUpRenderCommand: handoff.render.command }),
    handoff,
  };
}

export function serializeMdPdfProjectCodexReportArtifact(
  report: MarkdownPdfProjectCodexReportArtifact,
): string {
  const projected = report.pageInformation ? projectPageInformationReport(report) : report;
  return `${JSON.stringify(projected, null, 2)}\n`;
}

/** Persist only named fields when explicit page information may appear in model prose. */
function projectPageInformationReport(
  report: MarkdownPdfProjectCodexReportArtifact,
): MarkdownPdfProjectCodexReportArtifact {
  validateMarkdownPdfCodexReportPageInformation(report.pageInformation);
  const publicPath = (path: { display: string; basename: string; redacted: boolean }) => ({
    display: path.display,
    basename: path.basename,
    redacted: path.redacted,
  });
  const managedAsset = (
    asset: MarkdownPdfProjectCodexReportManagedAsset,
  ): MarkdownPdfProjectCodexReportManagedAsset => ({
    role: asset.role,
    bundlePath: asset.bundlePath,
    source: publicPath(asset.source),
    ...(asset.format ? { format: asset.format } : {}),
    ...(asset.dimensions
      ? { dimensions: { width: asset.dimensions.width, height: asset.dimensions.height } }
      : {}),
    ...(asset.aspectRatio !== undefined ? { aspectRatio: asset.aspectRatio } : {}),
    orientationBucket: asset.orientationBucket,
    fitPressure: asset.fitPressure,
    ...(asset.metadataStatus ? { metadataStatus: asset.metadataStatus } : {}),
  });
  const renderCommand = (command: {
    executable: "cdx-chores";
    args: string[];
    display: string;
  }) => ({
    executable: command.executable,
    args: [...command.args],
    display: command.display,
  });
  return {
    artifactType: report.artifactType,
    advisoryOnly: report.advisoryOnly,
    reportId: report.reportId,
    generatedAt: report.generatedAt,
    identities: {
      projectBundleId: report.identities.projectBundleId,
      profileId: report.identities.profileId,
      templateBundleId: report.identities.templateBundleId,
      createdAt: report.identities.createdAt,
    },
    project: {
      signalMode: report.project.signalMode,
      decisionMode: report.project.decisionMode,
    },
    phases: {
      profile: {
        phase: report.phases.profile.phase,
        signalMode: report.phases.profile.signalMode,
        decisionMode: report.phases.profile.decisionMode,
        warnings: [],
      },
      template: {
        phase: report.phases.template.phase,
        signalMode: report.phases.template.signalMode,
        decisionMode: report.phases.template.decisionMode,
        warnings: [],
      },
    },
    input: {
      ...(report.input.markdown ? { markdown: publicPath(report.input.markdown) } : {}),
      ...(report.input.intent ? { intent: report.input.intent } : {}),
      fontHints: [...report.input.fontHints],
      ...(report.input.baseProfile ? { baseProfile: publicPath(report.input.baseProfile) } : {}),
      ...(report.input.coverImage ? { coverImage: managedAsset(report.input.coverImage) } : {}),
    },
    signals: {
      document: {
        available: report.signals.document.available,
        headingCount: report.signals.document.headingCount,
        maxHeadingDepth: report.signals.document.maxHeadingDepth,
        maxTableColumns: report.signals.document.maxTableColumns,
        localAssetCount: report.signals.document.localAssetCount,
        remoteAssetCount: report.signals.document.remoteAssetCount,
        dataUriAssetCount: report.signals.document.dataUriAssetCount,
        scriptBuckets: { ...report.signals.document.scriptBuckets },
        textTruncated: report.signals.document.textTruncated,
      },
      templateOwnedDirections: {
        document: [...report.signals.templateOwnedDirections.document],
        intent: [...report.signals.templateOwnedDirections.intent],
        requiresCodex: report.signals.templateOwnedDirections.requiresCodex,
      },
    },
    unsupportedDirections: [],
    files: report.files.map((file) => ({
      role: file.role,
      ...(file.bundlePath ? { bundlePath: file.bundlePath } : {}),
      ...(file.path ? { path: file.path } : {}),
      planned: file.planned,
    })),
    managedAssets: report.managedAssets.map(managedAsset),
    validationResults: report.validationResults.map(({ name, status }) => ({ name, status })),
    pageInformation: report.pageInformation,
    diagnosticConditionIds: [
      ...new Set(report.handoff.diagnostics.map((item) => item.conditionId)),
    ],
    ...(report.followUpRenderCommand
      ? { followUpRenderCommand: renderCommand(report.followUpRenderCommand) }
      : {}),
    handoff: {
      profile: {
        id: report.handoff.profile.id,
        bundlePath: report.handoff.profile.bundlePath,
      },
      artifacts: { availability: report.handoff.artifacts.availability },
      render:
        report.handoff.render.usability === "unavailable"
          ? { usability: "unavailable" }
          : {
              usability: report.handoff.render.usability,
              command: renderCommand(report.handoff.render.command),
            },
      diagnostics: [],
      capabilityRequirements: report.handoff.capabilityRequirements.map((requirement) => ({
        capabilityId: requirement.capabilityId,
        requestedBy: [...requirement.requestedBy],
        minimumVersion: requirement.minimumVersion,
      })),
    },
  };
}

export async function writeMdPdfProjectCodexReportArtifact(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  overwrite?: boolean;
  projectArtifactsWritten?: boolean;
  projectRolesPlanned?: boolean;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  reportArtifact?: MarkdownPdfProjectCodexReportArtifact;
  runtime: CliRuntime;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
  validation: MarkdownPdfProjectCodexValidationSummary;
  slotResolution?: MarkdownPdfPageInformationSlotResolution;
  modelCallAttempted?: boolean;
}): Promise<void> {
  if (!input.outputPlan.report) {
    return;
  }
  const reportArtifact = input.reportArtifact ?? createMdPdfProjectCodexReportArtifact(input);
  validateMarkdownPdfCodexReportPageInformation(reportArtifact.pageInformation);
  const expectedPageInformation = createMarkdownPdfCodexReportPageInformation({
    pageInformation: input.signals.profile.pageInformation,
    finalProfile: input.profilePhase.finalProfile,
    slotResolution: input.slotResolution,
    modelCallAttempted: reportArtifact.pageInformation?.modelResultDetails === "omitted",
  });
  const actual = reportArtifact.pageInformation;
  if (
    Boolean(expectedPageInformation) !== Boolean(actual) ||
    (expectedPageInformation &&
      (!isDeepStrictEqual(
        actual?.pageNumbers.requested,
        expectedPageInformation.pageNumbers.requested,
      ) ||
        !isDeepStrictEqual(actual?.pageNumbers.final, expectedPageInformation.pageNumbers.final) ||
        !isDeepStrictEqual(
          actual?.repeatingContent.requested,
          expectedPageInformation.repeatingContent.requested,
        ) ||
        !isDeepStrictEqual(
          actual?.repeatingContent.final?.storedPositions,
          expectedPageInformation.repeatingContent.final?.storedPositions,
        ) ||
        actual?.repeatingContent.final?.reservedNumberPosition !==
          expectedPageInformation.repeatingContent.final?.reservedNumberPosition ||
        (input.slotResolution &&
          actual?.repeatingContent.final?.reservedSlotOutcome !==
            expectedPageInformation.repeatingContent.final?.reservedSlotOutcome) ||
        (input.modelCallAttempted !== undefined &&
          actual?.modelResultDetails !== (input.modelCallAttempted ? "omitted" : "not-requested"))))
  ) {
    throw new CliError(
      "Project report page-information metadata does not match the prepared Profile.",
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
  const { followUpRenderCommand: _followUpRenderCommand, ...reportWithoutRenderCommand } =
    reportArtifact;
  const handoff = createMdPdfProjectCodexHandoffProjection(input);
  const files =
    input.projectRolesPlanned === false
      ? reportArtifact.files.filter((file) => file.role === "project-report")
      : reportArtifact.files;
  await writeTextFileSafe(
    input.outputPlan.report.path,
    serializeMdPdfProjectCodexReportArtifact({
      ...reportWithoutRenderCommand,
      ...(handoff.render.usability === "unavailable"
        ? {}
        : { followUpRenderCommand: handoff.render.command }),
      files,
      handoff,
    }),
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
