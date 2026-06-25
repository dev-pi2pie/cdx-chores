import { printLine } from "../../actions/shared";
import { formatPathForDisplay } from "../../path-utils";
import type { CliRuntime } from "../../types";
import type {
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexSynthesisResult,
  MdPdfTemplateCodexSignalCollection,
  NormalizedMdPdfTemplateCodexCommandState,
} from "./types";

function renderFollowUpRenderCommand(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  runtime: CliRuntime;
  state: NormalizedMdPdfTemplateCodexCommandState;
  synthesis: MarkdownPdfTemplateCodexSynthesisResult;
}): string | undefined {
  if (input.synthesis.decisionMode === "no-usable-template") {
    return undefined;
  }
  const inputPath = input.state.inputPath
    ? formatPathForDisplay(input.runtime, input.state.inputPath)
    : "<input.md>";
  return `cdx-chores md to-pdf --input ${inputPath} --template ${formatPathForDisplay(
    input.runtime,
    input.outputPlan.templateHtml.path,
  )} --css ${formatPathForDisplay(input.runtime, input.outputPlan.styleCss.path)} --output <output.pdf>`;
}

export function printMdPdfTemplateCodexSummary(
  runtime: CliRuntime,
  input: {
    outputPlan: MarkdownPdfTemplateCodexOutputPlan;
    signals: MdPdfTemplateCodexSignalCollection;
    state: NormalizedMdPdfTemplateCodexCommandState;
    synthesis: MarkdownPdfTemplateCodexSynthesisResult;
  },
): void {
  printLine(runtime.stdout, `Signal mode: ${input.signals.signalMode}`);
  printLine(runtime.stdout, `Decision mode: ${input.synthesis.decisionMode}`);
  printLine(runtime.stdout, `Template family: ${input.synthesis.templateFamily}`);
  printLine(
    runtime.stdout,
    `Recipe preset: ${input.synthesis.slots.recipePreset.preset} (${input.synthesis.slots.recipePreset.source})`,
  );
  if (input.synthesis.slots.cover.enabled) {
    printLine(runtime.stdout, `Cover composition: ${input.synthesis.slots.cover.composition}`);
    printLine(runtime.stdout, `Cover byline: ${input.synthesis.slots.cover.byline}`);
    printLine(runtime.stdout, `Cover text align: ${input.synthesis.slots.cover.textAlign}`);
    printLine(
      runtime.stdout,
      `Cover image fit: ${input.synthesis.slots.cover.imageFit ?? "contain"}`,
    );
    printLine(runtime.stdout, `Cover media scale: ${input.synthesis.slots.cover.mediaScale}`);
  }
  printLine(runtime.stdout, `Template bundle: ${input.outputPlan.bundleId}`);
  printLine(
    runtime.stdout,
    `Output directory: ${formatPathForDisplay(runtime, input.outputPlan.outputDirectory)}`,
  );
  printLine(runtime.stdout, `Template HTML: ${input.outputPlan.templateHtml.bundlePath}`);
  printLine(runtime.stdout, `Stylesheet: ${input.outputPlan.styleCss.bundlePath}`);
  printLine(runtime.stdout, `Managed assets: ${input.outputPlan.assets.length}`);
  if (input.outputPlan.report) {
    printLine(
      runtime.stdout,
      `Codex report: ${formatPathForDisplay(runtime, input.outputPlan.report.path)}`,
    );
  }
  if (input.synthesis.fallbackReason) {
    printLine(runtime.stdout, `Fallback reason: ${input.synthesis.fallbackReason}`);
  }
  for (const direction of input.synthesis.unsupportedDirections ?? []) {
    printLine(runtime.stdout, `Unsupported direction: ${direction}`);
  }
  const followUpCommand = renderFollowUpRenderCommand({ ...input, runtime });
  if (followUpCommand) {
    printLine(runtime.stdout, `Follow-up render: ${followUpCommand}`);
  }
  if (input.state.dryRun) {
    printLine(runtime.stdout, "Dry run only. No template bundle files were written.");
  }
}
