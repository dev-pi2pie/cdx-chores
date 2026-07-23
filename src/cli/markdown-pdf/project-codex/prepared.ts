import { extname, join } from "node:path";

import { assertNonEmpty } from "../../actions/shared";
import {
  createCodexProgressSession,
  type DirectCodexProgressStatus,
} from "../../actions/codex-progress";
import { CliError } from "../../errors";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import type { MarkdownPdfCodexReportBinding } from "../codex-report-binding";
import { collectMdPdfProjectCodexSignals } from "./signals";
import {
  MARKDOWN_PDF_PROJECT_CODEX_REPORT_BUNDLE_PATH,
  planMdPdfProjectCodexOutput,
  validateMdPdfProjectCodexOutputWritability,
  type MdPdfProjectCodexOutputWriteMode,
} from "./output-plan";
import { normalizeMdPdfProjectCodexCommandState } from "./options";
import {
  runMdPdfProjectCodexProfilePhase,
  type MdPdfProjectCodexProfilePhaseResult,
} from "./profile-phase";
import { createMdPdfProjectCodexReportArtifact } from "./report";
import {
  runMdPdfProjectCodexTemplatePhase,
  type MdPdfProjectCodexTemplatePhaseResult,
} from "./template-phase";
import type {
  MarkdownPdfProjectCodexIdentity,
  MarkdownPdfProjectCodexOutputPlan,
  MarkdownPdfProjectCodexPlannedAsset,
  MarkdownPdfProjectCodexPlannedFile,
  MarkdownPdfProjectCodexPlannedReport,
  MarkdownPdfProjectCodexReportArtifact,
  MdPdfProjectCodexOptions,
  MdPdfProjectCodexSignalCollection,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";
import {
  validateMdPdfProjectCodexProject,
  type MarkdownPdfProjectCodexValidationSummary,
} from "./validate-project";
import {
  snapshotMdPdfProjectCodexManagedAssets,
  writeMdPdfProjectCodexBundle,
  writeMdPdfProjectCodexReportIfRequested,
  type MarkdownPdfProjectCodexManagedAssetContent,
} from "./write-project";

export interface MarkdownPdfProjectCodexPreparedLayout {
  profile: Pick<MarkdownPdfProjectCodexPlannedFile, "bundlePath">;
  templateHtml: Pick<MarkdownPdfProjectCodexPlannedFile, "bundlePath">;
  styleCss: Pick<MarkdownPdfProjectCodexPlannedFile, "bundlePath">;
  report?: { location: "in-bundle"; bundlePath: string } | { location: "external" };
  assets: Array<
    Pick<
      MarkdownPdfProjectCodexPlannedAsset,
      "bundlePath" | "role" | "sourceBasename" | "sourcePath"
    >
  >;
}

export type MdPdfProjectCodexAcceptedTemplatePhase = Omit<
  MdPdfProjectCodexTemplatePhaseResult,
  "outputPlan"
>;

export interface MarkdownPdfProjectCodexPreparedBinding {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  reportArtifact: MarkdownPdfProjectCodexReportArtifact;
  state: NormalizedMdPdfProjectCodexCommandState;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
  validation: MarkdownPdfProjectCodexValidationSummary;
}

export interface MarkdownPdfProjectCodexPreparedArtifact {
  identity: MarkdownPdfProjectCodexIdentity;
  layout: MarkdownPdfProjectCodexPreparedLayout;
  managedAssetContents: readonly MarkdownPdfProjectCodexManagedAssetContent[];
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  signals: MdPdfProjectCodexSignalCollection;
  templatePhase: MdPdfProjectCodexAcceptedTemplatePhase;
  binding: MarkdownPdfProjectCodexPreparedBinding;
}

function initialWriteMode(input: {
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
}): MdPdfProjectCodexOutputWriteMode {
  return input.state.dryRun || input.signals.modes.project === "codex-assisted"
    ? "report-only"
    : "bundle";
}

function projectProgressStatus(input: {
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
}): DirectCodexProgressStatus {
  if (input.templatePhase.phase.decisionMode === "no-usable-project") {
    return "error";
  }
  if (
    input.profilePhase.phase.decisionMode === "conservative-fallback" ||
    input.templatePhase.phase.decisionMode === "conservative-fallback"
  ) {
    return "fallback";
  }
  return "done";
}

function stableIdentity(
  outputPlan: MarkdownPdfProjectCodexOutputPlan,
): MarkdownPdfProjectCodexIdentity {
  const { outputDirectory: _outputDirectory, ...identity } = outputPlan.identity;
  return identity;
}

function preparedLayout(
  outputPlan: MarkdownPdfProjectCodexOutputPlan,
): MarkdownPdfProjectCodexPreparedLayout {
  return {
    profile: { bundlePath: outputPlan.profile.bundlePath },
    templateHtml: { bundlePath: outputPlan.templateHtml.bundlePath },
    styleCss: { bundlePath: outputPlan.styleCss.bundlePath },
    ...(outputPlan.report
      ? {
          report:
            outputPlan.report.location === "in-bundle"
              ? { location: "in-bundle" as const, bundlePath: outputPlan.report.bundlePath }
              : { location: "external" as const },
        }
      : {}),
    assets: outputPlan.assets.map(({ bundlePath, role, sourceBasename, sourcePath }) => ({
      bundlePath,
      role,
      sourceBasename,
      sourcePath,
    })),
  };
}

function acceptedTemplatePhase(
  templatePhase: MdPdfProjectCodexTemplatePhaseResult,
): MdPdfProjectCodexAcceptedTemplatePhase {
  const { outputPlan: _outputPlan, ...accepted } = templatePhase;
  return accepted;
}

function bindBundleFile(outputDirectory: string, bundlePath: string) {
  return { bundlePath, path: join(outputDirectory, bundlePath) };
}

function bindPreservedReport(input: {
  currentReport: MarkdownPdfProjectCodexPlannedReport | undefined;
  layout: MarkdownPdfProjectCodexPreparedLayout;
  outputDirectory: string;
}): MarkdownPdfProjectCodexPlannedReport | undefined {
  if (!input.layout.report) {
    return undefined;
  }
  if (input.layout.report.location === "in-bundle") {
    return {
      ...bindBundleFile(input.outputDirectory, input.layout.report.bundlePath),
      location: "in-bundle",
    };
  }
  const path = input.currentReport?.path;
  return path ? { location: "external", path } : undefined;
}

function resolveReboundReport(input: {
  outputDirectory: string;
  prepared: MarkdownPdfProjectCodexPreparedArtifact;
  report: MarkdownPdfCodexReportBinding | undefined;
  reportOutputPath?: string;
  runtime: CliRuntime;
}): MarkdownPdfProjectCodexPlannedReport | undefined {
  if (!input.report && !input.reportOutputPath) {
    return bindPreservedReport({
      currentReport: input.prepared.binding.outputPlan.report,
      layout: input.prepared.layout,
      outputDirectory: input.outputDirectory,
    });
  }
  const reportBinding: MarkdownPdfCodexReportBinding = input.report ?? {
    kind: "external",
    path: assertNonEmpty(input.reportOutputPath, "Codex report path"),
  };
  if (reportBinding.kind === "none") {
    return undefined;
  }
  if (reportBinding.kind === "with-artifact") {
    return {
      ...bindBundleFile(input.outputDirectory, MARKDOWN_PDF_PROJECT_CODEX_REPORT_BUNDLE_PATH),
      location: "in-bundle",
    };
  }
  const path = resolveFromCwd(
    input.runtime,
    assertNonEmpty(reportBinding.path, "Codex report path"),
  );
  if (extname(path).toLowerCase() !== ".json") {
    throw new CliError("Markdown PDF project Codex report path must end with .json.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return { location: "external", path };
}

function bindOutputPlan(input: {
  generatedOutputDirectory: boolean;
  identity: MarkdownPdfProjectCodexIdentity;
  layout: MarkdownPdfProjectCodexPreparedLayout;
  outputDirectory: string;
  report?: MarkdownPdfProjectCodexPlannedReport;
}): MarkdownPdfProjectCodexOutputPlan {
  return {
    identity: { ...input.identity, outputDirectory: input.outputDirectory },
    outputDirectory: input.outputDirectory,
    generatedOutputDirectory: input.generatedOutputDirectory,
    profile: bindBundleFile(input.outputDirectory, input.layout.profile.bundlePath),
    templateHtml: bindBundleFile(input.outputDirectory, input.layout.templateHtml.bundlePath),
    styleCss: bindBundleFile(input.outputDirectory, input.layout.styleCss.bundlePath),
    ...(input.report ? { report: input.report } : {}),
    assets: input.layout.assets.map((asset) => ({
      ...asset,
      path: join(input.outputDirectory, asset.bundlePath),
    })),
  };
}

function bindTemplatePhase(input: {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  templatePhase: MdPdfProjectCodexAcceptedTemplatePhase;
}): MdPdfProjectCodexTemplatePhaseResult {
  return {
    ...input.templatePhase,
    outputPlan: {
      bundleId: input.outputPlan.identity.templateBundleId,
      outputDirectory: input.outputPlan.outputDirectory,
      generatedOutputDirectory: input.outputPlan.generatedOutputDirectory,
      templateHtml: input.outputPlan.templateHtml,
      styleCss: input.outputPlan.styleCss,
      report: input.outputPlan.report,
      assets: input.outputPlan.assets,
    },
  };
}

function createBinding(input: {
  generatedAt?: string;
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  runtime: CliRuntime;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
  templatePhase: MdPdfProjectCodexAcceptedTemplatePhase;
}): MarkdownPdfProjectCodexPreparedBinding {
  const templatePhase = bindTemplatePhase({
    outputPlan: input.outputPlan,
    templatePhase: input.templatePhase,
  });
  const validation = validateMdPdfProjectCodexProject({
    outputPlan: input.outputPlan,
    profilePhase: input.profilePhase,
    runtime: input.runtime,
    state: input.state,
    templatePhase,
  });
  const reportArtifact = createMdPdfProjectCodexReportArtifact({
    outputPlan: input.outputPlan,
    profilePhase: input.profilePhase,
    runtime: input.runtime,
    signals: input.signals,
    state: input.state,
    templatePhase,
    validation,
  });
  return {
    outputPlan: input.outputPlan,
    reportArtifact: input.generatedAt
      ? { ...reportArtifact, generatedAt: input.generatedAt }
      : reportArtifact,
    state: input.state,
    templatePhase,
    validation,
  };
}

export async function prepareMdPdfProjectCodex(
  runtime: CliRuntime,
  options: MdPdfProjectCodexOptions,
): Promise<MarkdownPdfProjectCodexPreparedArtifact> {
  const state = await normalizeMdPdfProjectCodexCommandState(runtime, options);
  const signals = await collectMdPdfProjectCodexSignals(runtime, state);
  const outputPlan = await planMdPdfProjectCodexOutput({
    identityUidFactory: options.identityUidFactory,
    runtime,
    state,
    signalMode: signals.modes.project,
    writeMode: initialWriteMode({ signals, state }),
  });
  const progressSession = options.codexProgressPresenter
    ? createCodexProgressSession(options.codexProgressPresenter)
    : undefined;
  let progressStatus: DirectCodexProgressStatus = "error";
  try {
    const profilePhase = await runMdPdfProjectCodexProfilePhase({
      outputPlan,
      profileCodexRunner: options.profileCodexRunner,
      progressSession,
      runtime,
      signals,
      state,
    });
    const completeTemplatePhase = await runMdPdfProjectCodexTemplatePhase({
      outputPlan,
      profilePhase,
      progressSession,
      runtime,
      signals,
      state,
      templateCodexRunner: options.templateCodexRunner,
    });
    const completedProgressStatus = projectProgressStatus({
      profilePhase,
      templatePhase: completeTemplatePhase,
    });
    const templatePhase = acceptedTemplatePhase(completeTemplatePhase);
    const binding = createBinding({
      outputPlan,
      profilePhase,
      runtime,
      signals,
      state,
      templatePhase,
    });
    if (!state.dryRun && binding.validation.decisionMode !== "no-usable-project") {
      await validateMdPdfProjectCodexOutputWritability({
        plan: outputPlan,
        runtime,
        state,
        writeMode: "bundle",
      });
    }
    const managedAssetContents =
      binding.validation.decisionMode === "no-usable-project"
        ? []
        : await snapshotMdPdfProjectCodexManagedAssets({
            outputPlan,
            templatePhase: binding.templatePhase,
          });
    progressStatus = completedProgressStatus;
    return {
      identity: stableIdentity(outputPlan),
      layout: preparedLayout(outputPlan),
      managedAssetContents,
      profilePhase,
      signals,
      templatePhase,
      binding,
    };
  } finally {
    progressSession?.stop(progressStatus);
  }
}

export async function rebindMdPdfProjectCodexPreparedArtifact(input: {
  prepared: MarkdownPdfProjectCodexPreparedArtifact;
  runtime: CliRuntime;
  outputDirectory: string;
  reportOutputPath?: string;
  dryRun?: boolean;
  overwrite?: boolean;
  report?: MarkdownPdfCodexReportBinding;
}): Promise<MarkdownPdfProjectCodexPreparedArtifact> {
  const outputDirectory = resolveFromCwd(
    input.runtime,
    assertNonEmpty(input.outputDirectory, "Output directory"),
  );
  const report = resolveReboundReport({
    outputDirectory,
    prepared: input.prepared,
    report: input.report,
    reportOutputPath: input.reportOutputPath,
    runtime: input.runtime,
  });
  const state: NormalizedMdPdfProjectCodexCommandState = {
    ...input.prepared.binding.state,
    dryRun: input.dryRun ?? false,
    outputDirectory,
    keepCodexReport: Boolean(report),
    codexReportOutputPath: report?.location === "external" ? report.path : undefined,
    overwrite: input.overwrite ?? input.prepared.binding.state.overwrite,
  };
  const outputPlan = bindOutputPlan({
    generatedOutputDirectory: false,
    identity: input.prepared.identity,
    layout: input.prepared.layout,
    outputDirectory,
    report,
  });
  const binding = createBinding({
    generatedAt: input.prepared.binding.reportArtifact.generatedAt,
    outputPlan,
    profilePhase: input.prepared.profilePhase,
    runtime: input.runtime,
    signals: input.prepared.signals,
    state,
    templatePhase: input.prepared.templatePhase,
  });
  if (!state.dryRun && binding.validation.decisionMode !== "no-usable-project") {
    await validateMdPdfProjectCodexOutputWritability({
      plan: outputPlan,
      runtime: input.runtime,
      state,
      writeMode: "bundle",
    });
  }
  return { ...input.prepared, binding };
}

function preparedWriteInput(
  prepared: MarkdownPdfProjectCodexPreparedArtifact,
  runtime: CliRuntime,
) {
  return {
    managedAssetContents: prepared.managedAssetContents,
    outputPlan: prepared.binding.outputPlan,
    overwrite: prepared.binding.state.overwrite,
    profilePhase: prepared.profilePhase,
    reportArtifact: prepared.binding.reportArtifact,
    runtime,
    signals: prepared.signals,
    state: prepared.binding.state,
    templatePhase: prepared.binding.templatePhase,
    validation: prepared.binding.validation,
  };
}

export async function writePreparedMdPdfProjectCodexBundle(
  runtime: CliRuntime,
  prepared: MarkdownPdfProjectCodexPreparedArtifact,
): Promise<void> {
  await writeMdPdfProjectCodexBundle(preparedWriteInput(prepared, runtime));
}

export async function writePreparedMdPdfProjectCodexReportIfRequested(
  runtime: CliRuntime,
  prepared: MarkdownPdfProjectCodexPreparedArtifact,
): Promise<void> {
  await writeMdPdfProjectCodexReportIfRequested(preparedWriteInput(prepared, runtime));
}
