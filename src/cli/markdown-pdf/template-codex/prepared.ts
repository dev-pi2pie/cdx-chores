import { extname, join } from "node:path";

import { assertNonEmpty } from "../../actions/shared";
import { CliError } from "../../errors";
import { writeTextFileSafe } from "../../file-io";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import type { MarkdownPdfCodexReportBinding } from "../codex-report-binding";
import {
  prepareMdPdfTemplateCodexManagedAssets,
  writePreparedMdPdfTemplateCodexManagedAssets,
  type PreparedMdPdfTemplateCodexManagedAsset,
} from "./asset-copy";
import {
  createMdPdfTemplateCodexReportArtifact,
  serializeMdPdfTemplateCodexReportArtifact,
  type MdPdfTemplateCodexReportArtifact,
} from "./report";
import {
  MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_BUNDLE_PATH,
  validateMdPdfTemplateCodexOutputWritability,
} from "./output-plan";
import { validateMdPdfTemplateCodexSynthesis } from "./validate-template";
import type {
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexPlannedAsset,
  MarkdownPdfTemplateCodexPlannedFile,
  MarkdownPdfTemplateCodexPlannedReport,
  MarkdownPdfTemplateCodexSynthesisResult,
  MdPdfTemplateCodexSignalCollection,
  NormalizedMdPdfTemplateCodexCommandState,
} from "./types";

export interface PreparedMdPdfTemplateCodexArtifact {
  bundleId: string;
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  signals: MdPdfTemplateCodexSignalCollection;
  state: NormalizedMdPdfTemplateCodexCommandState;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
  managedAssets: PreparedMdPdfTemplateCodexManagedAsset[];
  reportArtifact: MdPdfTemplateCodexReportArtifact;
}

function bindBundleFile(
  outputDirectory: string,
  file: MarkdownPdfTemplateCodexPlannedFile,
): MarkdownPdfTemplateCodexPlannedFile {
  return {
    bundlePath: file.bundlePath,
    path: join(outputDirectory, file.bundlePath),
  };
}

function bindManagedAsset(
  outputDirectory: string,
  asset: MarkdownPdfTemplateCodexPlannedAsset,
): MarkdownPdfTemplateCodexPlannedAsset {
  return {
    ...asset,
    path: join(outputDirectory, asset.bundlePath),
  };
}

function bindReport(
  outputDirectory: string,
  report: MarkdownPdfTemplateCodexPlannedReport | undefined,
): MarkdownPdfTemplateCodexPlannedReport | undefined {
  if (!report || report.location === "external") {
    return report;
  }
  return {
    ...bindBundleFile(outputDirectory, report),
    location: "in-bundle",
  };
}

function resolveReboundReport(input: {
  outputDirectory: string;
  prepared: PreparedMdPdfTemplateCodexArtifact;
  report: MarkdownPdfCodexReportBinding | undefined;
  runtime: CliRuntime;
}): MarkdownPdfTemplateCodexPlannedReport | undefined {
  if (!input.report) {
    return bindReport(input.outputDirectory, input.prepared.outputPlan.report);
  }
  if (input.report.kind === "none") {
    return undefined;
  }
  if (input.report.kind === "with-artifact") {
    return {
      ...bindBundleFile(input.outputDirectory, {
        bundlePath: MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_BUNDLE_PATH,
        path: join(input.outputDirectory, MARKDOWN_PDF_TEMPLATE_CODEX_REPORT_BUNDLE_PATH),
      }),
      location: "in-bundle",
    };
  }
  const path = resolveFromCwd(
    input.runtime,
    assertNonEmpty(input.report.path, "Codex report path"),
  );
  if (extname(path).toLowerCase() !== ".json") {
    throw new CliError("Markdown PDF template Codex report path must end with .json.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
  return { location: "external", path };
}

export async function createPreparedMdPdfTemplateCodexArtifact(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  runtime: CliRuntime;
  signals: MdPdfTemplateCodexSignalCollection;
  state: NormalizedMdPdfTemplateCodexCommandState;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): Promise<PreparedMdPdfTemplateCodexArtifact> {
  validateMdPdfTemplateCodexSynthesis({
    outputPlan: input.outputPlan,
    synthesis: input.synthesis,
  });
  const managedAssets = await prepareMdPdfTemplateCodexManagedAssets({
    managedAssets: input.synthesis.managedAssets,
    outputPlan: input.outputPlan,
  });
  return {
    bundleId: input.outputPlan.bundleId,
    outputPlan: input.outputPlan,
    signals: input.signals,
    state: input.state,
    synthesis: input.synthesis,
    managedAssets,
    reportArtifact: createMdPdfTemplateCodexReportArtifact(input),
  };
}

export function bindPreparedMdPdfTemplateCodexOutput(
  prepared: PreparedMdPdfTemplateCodexArtifact,
  input: {
    outputDirectory: string;
    generatedOutputDirectory?: boolean;
  },
): PreparedMdPdfTemplateCodexArtifact {
  const outputPlan: MarkdownPdfTemplateCodexOutputPlan = {
    bundleId: prepared.bundleId,
    outputDirectory: input.outputDirectory,
    generatedOutputDirectory: input.generatedOutputDirectory ?? false,
    templateHtml: bindBundleFile(input.outputDirectory, prepared.outputPlan.templateHtml),
    styleCss: bindBundleFile(input.outputDirectory, prepared.outputPlan.styleCss),
    report: bindReport(input.outputDirectory, prepared.outputPlan.report),
    assets: prepared.outputPlan.assets.map((asset) =>
      bindManagedAsset(input.outputDirectory, asset),
    ),
  };
  return {
    ...prepared,
    outputPlan,
  };
}

export async function rebindPreparedMdPdfTemplateCodexArtifact(input: {
  outputDirectory: string;
  overwrite?: boolean;
  prepared: PreparedMdPdfTemplateCodexArtifact;
  report?: MarkdownPdfCodexReportBinding;
  runtime: CliRuntime;
}): Promise<PreparedMdPdfTemplateCodexArtifact> {
  const outputDirectory = resolveFromCwd(
    input.runtime,
    assertNonEmpty(input.outputDirectory, "Output directory"),
  );
  const report = resolveReboundReport({
    outputDirectory,
    prepared: input.prepared,
    report: input.report,
    runtime: input.runtime,
  });
  const outputPlan: MarkdownPdfTemplateCodexOutputPlan = {
    bundleId: input.prepared.bundleId,
    outputDirectory,
    generatedOutputDirectory: false,
    templateHtml: bindBundleFile(outputDirectory, input.prepared.outputPlan.templateHtml),
    styleCss: bindBundleFile(outputDirectory, input.prepared.outputPlan.styleCss),
    ...(report ? { report } : {}),
    assets: input.prepared.outputPlan.assets.map((asset) =>
      bindManagedAsset(outputDirectory, asset),
    ),
  };
  const state: NormalizedMdPdfTemplateCodexCommandState = {
    ...input.prepared.state,
    outputPath: outputDirectory,
    dryRun: false,
    overwrite: input.overwrite ?? input.prepared.state.overwrite,
    keepCodexReport: Boolean(report),
    codexReportOutputPath: report?.location === "external" ? report.path : undefined,
  };
  validateMdPdfTemplateCodexSynthesis({
    outputPlan,
    synthesis: input.prepared.synthesis,
  });
  await validateMdPdfTemplateCodexOutputWritability({
    plan: outputPlan,
    runtime: input.runtime,
    state,
    writeMode:
      input.prepared.synthesis.decisionMode === "no-usable-template" ? "report-only" : "bundle",
  });
  const reportArtifact = createMdPdfTemplateCodexReportArtifact({
    outputPlan,
    runtime: input.runtime,
    signals: input.prepared.signals,
    state,
    synthesis: input.prepared.synthesis,
  });
  return {
    ...input.prepared,
    outputPlan,
    state,
    reportArtifact: {
      ...reportArtifact,
      generatedAt: input.prepared.reportArtifact.generatedAt,
    },
  };
}

async function writePreparedReport(input: {
  prepared: PreparedMdPdfTemplateCodexArtifact;
  runtime: CliRuntime;
}): Promise<void> {
  const report = input.prepared.outputPlan.report;
  if (!report) {
    return;
  }
  await writeTextFileSafe(
    report.path,
    serializeMdPdfTemplateCodexReportArtifact(input.prepared.reportArtifact),
    {
      label: "--codex-report-output",
      overwrite: input.prepared.state.overwrite,
      parentRootDirectory:
        report.location === "in-bundle"
          ? input.prepared.outputPlan.outputDirectory
          : input.runtime.cwd,
    },
  );
}

export async function writePreparedMdPdfTemplateCodexReport(input: {
  prepared: PreparedMdPdfTemplateCodexArtifact;
  runtime: CliRuntime;
}): Promise<void> {
  validateMdPdfTemplateCodexSynthesis({
    outputPlan: input.prepared.outputPlan,
    synthesis: input.prepared.synthesis,
  });
  await validateMdPdfTemplateCodexOutputWritability({
    plan: input.prepared.outputPlan,
    runtime: input.runtime,
    state: input.prepared.state,
    writeMode: "report-only",
  });
  await writePreparedReport(input);
}

export async function writePreparedMdPdfTemplateCodexBundle(input: {
  prepared: PreparedMdPdfTemplateCodexArtifact;
  runtime: CliRuntime;
}): Promise<void> {
  const { prepared } = input;
  validateMdPdfTemplateCodexSynthesis({
    outputPlan: prepared.outputPlan,
    synthesis: prepared.synthesis,
  });
  await validateMdPdfTemplateCodexOutputWritability({
    plan: prepared.outputPlan,
    runtime: input.runtime,
    state: prepared.state,
    writeMode: prepared.synthesis.decisionMode === "no-usable-template" ? "report-only" : "bundle",
  });

  if (prepared.synthesis.decisionMode === "no-usable-template") {
    await writePreparedReport(input);
    return;
  }

  await writeTextFileSafe(prepared.outputPlan.templateHtml.path, prepared.synthesis.templateHtml, {
    label: "planned template.html",
    overwrite: prepared.state.overwrite,
    parentRootDirectory: prepared.outputPlan.outputDirectory,
  });
  await writeTextFileSafe(prepared.outputPlan.styleCss.path, prepared.synthesis.styleCss, {
    label: "planned style.css",
    overwrite: prepared.state.overwrite,
    parentRootDirectory: prepared.outputPlan.outputDirectory,
  });
  await writePreparedMdPdfTemplateCodexManagedAssets({
    managedAssets: prepared.managedAssets,
    outputPlan: prepared.outputPlan,
    overwrite: prepared.state.overwrite,
  });
  await writePreparedReport(input);
}
