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
import { createMdPdfProjectCodexReportArtifact } from "./report";
import { printMdPdfProjectCodexSummary } from "./summary";
import {
  escapeMdPdfProjectCodexTerminalText,
  sanitizeMdPdfProjectCodexTerminalText,
} from "./report-redaction";
import type { MarkdownPdfProjectCodexValidationSummary } from "./validate-project";

function throwNoUsableProject(validation: MarkdownPdfProjectCodexValidationSummary): never {
  throw new CliError(
    validation.fallbackReason
      ? sanitizeMdPdfProjectCodexTerminalText(validation.fallbackReason)
      : "No usable Markdown PDF project path is available for the provided signals.",
    {
      code: "NO_USABLE_PROJECT",
      exitCode: 1,
    },
  );
}

function publicProjectPath(runtime: CliRuntime, path: string): string {
  return escapeMdPdfProjectCodexTerminalText(
    publicPathDisplay(runtime, path)?.display ?? publicPathBasename(path),
  );
}

export async function actionMdPdfProjectCodex(
  runtime: CliRuntime,
  options: MdPdfProjectCodexOptions,
): Promise<void> {
  const prepared = await prepareMdPdfProjectCodex(runtime, options);
  const preflight = {
    outputPlan: prepared.binding.outputPlan,
    profilePhase: prepared.profilePhase,
    reportArtifact: prepared.binding.reportArtifact,
    state: prepared.binding.state,
    validation: prepared.binding.validation,
  };
  if (preflight.state.dryRun) {
    printMdPdfProjectCodexSummary(runtime, preflight);
    await writePreparedMdPdfProjectCodexReportIfRequested(runtime, prepared);
    if (preflight.validation.decisionMode === "no-usable-project") {
      throwNoUsableProject(preflight.validation);
    }
    return;
  }

  await writePreparedMdPdfProjectCodexBundle(runtime, prepared);
  if (preflight.validation.decisionMode === "no-usable-project") {
    printMdPdfProjectCodexSummary(runtime, preflight);
    if (preflight.outputPlan.report) {
      printLine(
        runtime.stderr,
        `Wrote Codex report: ${publicProjectPath(runtime, preflight.outputPlan.report.path)}`,
      );
    }
    throwNoUsableProject(preflight.validation);
  }
  printMdPdfProjectCodexSummary(runtime, {
    ...preflight,
    reportArtifact: createMdPdfProjectCodexReportArtifact({
      outputPlan: preflight.outputPlan,
      profilePhase: preflight.profilePhase,
      projectArtifactsWritten: true,
      runtime,
      signals: prepared.signals,
      state: preflight.state,
      templatePhase: prepared.binding.templatePhase,
      validation: preflight.validation,
    }),
  });
  printLine(
    runtime.stderr,
    `Wrote Markdown PDF project bundle: ${publicProjectPath(runtime, preflight.outputPlan.outputDirectory)}`,
  );
}
