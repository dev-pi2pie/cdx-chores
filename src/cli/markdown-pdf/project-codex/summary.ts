import { printLine } from "../../actions/shared";
import type { CliRuntime } from "../../types";
import { publicPathBasename, publicPathDisplay } from "../codex-path-display";
import { collectMdPdfProjectCodexUnsupportedDirections } from "./diagnostics";
import type {
  MarkdownPdfProjectCodexOutputPlan,
  MdPdfProjectCodexSignalCollection,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";
import type { MdPdfProjectCodexProfilePhaseResult } from "./profile-phase";
import type { MdPdfProjectCodexTemplatePhaseResult } from "./template-phase";
import { sanitizeMdPdfProjectCodexReportText } from "./report-redaction";
import type { MarkdownPdfProjectCodexValidationSummary } from "./validate-project";

function publicSummaryPath(runtime: CliRuntime, path: string): string {
  return publicPathDisplay(runtime, path)?.display ?? publicPathBasename(path);
}

export function printMdPdfProjectCodexSummary(
  runtime: CliRuntime,
  input: {
    outputPlan: MarkdownPdfProjectCodexOutputPlan;
    profilePhase: MdPdfProjectCodexProfilePhaseResult;
    signals: MdPdfProjectCodexSignalCollection;
    state: NormalizedMdPdfProjectCodexCommandState;
    templatePhase: MdPdfProjectCodexTemplatePhaseResult;
    validation: MarkdownPdfProjectCodexValidationSummary;
  },
): void {
  const noUsableProject = input.validation.decisionMode === "no-usable-project";
  printLine(runtime.stdout, `Project signal mode: ${input.signals.modes.project}`);
  printLine(runtime.stdout, `Final decision mode: ${input.validation.decisionMode}`);
  printLine(runtime.stdout, `Profile decision mode: ${input.profilePhase.phase.decisionMode}`);
  printLine(runtime.stdout, `Template decision mode: ${input.templatePhase.phase.decisionMode}`);
  printLine(
    runtime.stdout,
    `Output directory: ${publicSummaryPath(runtime, input.outputPlan.outputDirectory)}`,
  );
  if (!noUsableProject) {
    printLine(runtime.stdout, `Project bundle: ${input.outputPlan.identity.projectBundleId}`);
    printLine(runtime.stdout, `Profile: ${input.outputPlan.profile.bundlePath}`);
    printLine(runtime.stdout, `Template HTML: ${input.outputPlan.templateHtml.bundlePath}`);
    printLine(runtime.stdout, `Stylesheet: ${input.outputPlan.styleCss.bundlePath}`);
    printLine(
      runtime.stdout,
      `Managed assets: ${input.templatePhase.synthesis.managedAssets.length}`,
    );
  }
  if (input.outputPlan.report) {
    printLine(
      runtime.stdout,
      `Codex report: ${publicSummaryPath(runtime, input.outputPlan.report.path)}`,
    );
  }
  if (input.validation.fallbackReason) {
    printLine(
      runtime.stdout,
      `Fallback reason: ${sanitizeMdPdfProjectCodexReportText(input.validation.fallbackReason)}`,
    );
  }
  for (const direction of collectMdPdfProjectCodexUnsupportedDirections(input)) {
    printLine(
      runtime.stdout,
      `Unsupported direction: ${sanitizeMdPdfProjectCodexReportText(direction)}`,
    );
  }
  for (const result of input.validation.results.filter((result) => result.status === "failed")) {
    printLine(runtime.stdout, `Validation failed: ${result.name}`);
  }
  if (input.validation.renderCommand) {
    printLine(runtime.stdout, `Follow-up render: ${input.validation.renderCommand.display}`);
  }
  if (input.state.dryRun) {
    printLine(runtime.stdout, "Dry run only. No project bundle files were written.");
  }
}
