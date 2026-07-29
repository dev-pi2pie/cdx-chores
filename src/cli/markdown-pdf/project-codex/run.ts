import { printLine } from "../../actions/shared";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import { publicPathBasename, publicPathDisplay } from "../codex-path-display";
import {
  prepareMdPdfProjectCodex,
  writePreparedMdPdfProjectCodexBundle,
  writePreparedMdPdfProjectCodexReportIfRequested,
} from "./prepared";
import type { MdPdfProjectCodexOptions } from "./types";
import { printMdPdfProjectCodexSummary } from "./summary";
import { sanitizeMdPdfProjectCodexReportText } from "./report-redaction";
import type { MarkdownPdfProjectCodexValidationSummary } from "./validate-project";

function throwNoUsableProject(validation: MarkdownPdfProjectCodexValidationSummary): never {
  throw new CliError(
    validation.fallbackReason
      ? sanitizeMdPdfProjectCodexReportText(validation.fallbackReason)
      : "No usable Markdown PDF project path is available for the provided signals.",
    {
      code: "NO_USABLE_PROJECT",
      exitCode: 1,
    },
  );
}

function publicProjectPath(runtime: CliRuntime, path: string): string {
  return publicPathDisplay(runtime, path)?.display ?? publicPathBasename(path);
}

export async function actionMdPdfProjectCodex(
  runtime: CliRuntime,
  options: MdPdfProjectCodexOptions,
): Promise<void> {
  const prepared = await prepareMdPdfProjectCodex(runtime, options);
  const preflight = {
    outputPlan: prepared.binding.outputPlan,
    profilePhase: prepared.profilePhase,
    signals: prepared.signals,
    state: prepared.binding.state,
    templatePhase: prepared.binding.templatePhase,
    validation: prepared.binding.validation,
  };
  printMdPdfProjectCodexSummary(runtime, preflight);

  if (preflight.state.dryRun) {
    await writePreparedMdPdfProjectCodexReportIfRequested(runtime, prepared);
    if (preflight.validation.decisionMode === "no-usable-project") {
      throwNoUsableProject(preflight.validation);
    }
    return;
  }

  await writePreparedMdPdfProjectCodexBundle(runtime, prepared);
  if (preflight.validation.decisionMode === "no-usable-project") {
    if (preflight.outputPlan.report) {
      printLine(
        runtime.stderr,
        `Wrote Codex report: ${publicProjectPath(runtime, preflight.outputPlan.report.path)}`,
      );
    }
    throwNoUsableProject(preflight.validation);
  }
  printLine(
    runtime.stderr,
    `Wrote Markdown PDF project bundle: ${publicProjectPath(runtime, preflight.outputPlan.outputDirectory)}`,
  );
}
