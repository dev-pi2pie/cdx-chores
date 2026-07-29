import {
  prepareMdPdfTemplateCodex,
  printMdPdfTemplateCodexSummary,
  writePreparedMdPdfTemplateCodexBundle,
  writePreparedMdPdfTemplateCodexReport,
  type MarkdownPdfTemplateCodexSynthesisResult,
  type MdPdfTemplateCodexCliOptions,
  type MdPdfTemplateCodexOptions,
} from "../../markdown-pdf/template-codex";
import { displayPath, printLine } from "../shared";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";

export type { MdPdfTemplateCodexCliOptions, MdPdfTemplateCodexOptions };

export { prepareMdPdfTemplateCodex };

function throwNoUsableTemplate(synthesis: MarkdownPdfTemplateCodexSynthesisResult): never {
  throw new CliError(
    synthesis.fallbackReason ??
      "No usable Markdown PDF template path is available for the provided signals.",
    {
      code: "NO_USABLE_TEMPLATE",
      exitCode: 1,
    },
  );
}

export async function actionMdPdfTemplateCodex(
  runtime: CliRuntime,
  options: MdPdfTemplateCodexOptions,
): Promise<void> {
  const preflight = await prepareMdPdfTemplateCodex(runtime, options);
  printMdPdfTemplateCodexSummary(runtime, preflight);

  if (preflight.state.dryRun) {
    await writePreparedMdPdfTemplateCodexReport({
      prepared: preflight,
      runtime,
    });
    if (preflight.synthesis.decisionMode === "no-usable-template") {
      throwNoUsableTemplate(preflight.synthesis);
    }
    return;
  }

  await writePreparedMdPdfTemplateCodexBundle({
    prepared: preflight,
    runtime,
  });
  if (preflight.synthesis.decisionMode === "no-usable-template") {
    if (preflight.outputPlan.report) {
      printLine(
        runtime.stderr,
        `Wrote Codex report: ${displayPath(runtime, preflight.outputPlan.report.path)}`,
      );
    }
    throwNoUsableTemplate(preflight.synthesis);
  }
  printLine(
    runtime.stderr,
    `Wrote Markdown PDF template bundle: ${displayPath(runtime, preflight.outputPlan.outputDirectory)}`,
  );
}
