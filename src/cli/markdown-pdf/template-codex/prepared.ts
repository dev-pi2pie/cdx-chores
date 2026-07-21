import { join } from "node:path";

import { writeTextFileSafe } from "../../file-io";
import type { CliRuntime } from "../../types";
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
import { validateMdPdfTemplateCodexOutputWritability } from "./output-plan";
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
