import { mkdir } from "node:fs/promises";

import { writeTextFileSafe } from "../../file-io";
import type { CliRuntime } from "../../types";
import { copyMdPdfTemplateCodexManagedAssets } from "./asset-copy";
import { writeMdPdfTemplateCodexReportArtifact } from "./report";
import { validateMdPdfTemplateCodexSynthesis } from "./validate-template";
import type {
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexSynthesisResult,
  MdPdfTemplateCodexSignalCollection,
  NormalizedMdPdfTemplateCodexCommandState,
} from "./types";

export async function writeMdPdfTemplateCodexReportIfRequested(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  overwrite?: boolean;
  runtime: CliRuntime;
  signals: MdPdfTemplateCodexSignalCollection;
  state: NormalizedMdPdfTemplateCodexCommandState;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): Promise<void> {
  validateMdPdfTemplateCodexSynthesis({
    outputPlan: input.outputPlan,
    synthesis: input.synthesis,
  });
  await writeMdPdfTemplateCodexReportArtifact(input);
}

export async function writeMdPdfTemplateCodexBundle(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  overwrite?: boolean;
  runtime: CliRuntime;
  signals: MdPdfTemplateCodexSignalCollection;
  state: NormalizedMdPdfTemplateCodexCommandState;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): Promise<void> {
  validateMdPdfTemplateCodexSynthesis({
    outputPlan: input.outputPlan,
    synthesis: input.synthesis,
  });

  if (input.synthesis.decisionMode === "no-usable-template") {
    await writeMdPdfTemplateCodexReportArtifact(input);
    return;
  }

  await mkdir(input.outputPlan.outputDirectory, { recursive: true });
  await writeTextFileSafe(input.outputPlan.templateHtml.path, input.synthesis.templateHtml, {
    label: "planned template.html",
    overwrite: input.overwrite,
    parentRootDirectory: input.outputPlan.outputDirectory,
  });
  await writeTextFileSafe(input.outputPlan.styleCss.path, input.synthesis.styleCss, {
    label: "planned style.css",
    overwrite: input.overwrite,
    parentRootDirectory: input.outputPlan.outputDirectory,
  });
  await copyMdPdfTemplateCodexManagedAssets({
    managedAssets: input.synthesis.managedAssets,
    outputPlan: input.outputPlan,
    overwrite: input.overwrite,
  });
  await writeMdPdfTemplateCodexReportArtifact(input);
}
