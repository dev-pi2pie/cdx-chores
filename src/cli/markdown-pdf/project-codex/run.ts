import { printLine } from "../../actions/shared";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import { publicPathBasename, publicPathDisplay } from "../codex-path-display";
import { collectMdPdfProjectCodexSignals } from "./signals";
import {
  planMdPdfProjectCodexOutput,
  validateMdPdfProjectCodexOutputWritability,
  type MdPdfProjectCodexOutputWriteMode,
} from "./output-plan";
import { normalizeMdPdfProjectCodexCommandState } from "./options";
import { runMdPdfProjectCodexProfilePhase } from "./profile-phase";
import { runMdPdfProjectCodexTemplatePhase } from "./template-phase";
import type {
  MarkdownPdfProjectCodexOutputPlan,
  MdPdfProjectCodexOptions,
  MdPdfProjectCodexSignalCollection,
  NormalizedMdPdfProjectCodexCommandState,
} from "./types";
import { printMdPdfProjectCodexSummary } from "./summary";
import { sanitizeMdPdfProjectCodexReportText } from "./report-redaction";
import {
  validateMdPdfProjectCodexProject,
  type MarkdownPdfProjectCodexValidationSummary,
} from "./validate-project";
import {
  writeMdPdfProjectCodexBundle,
  writeMdPdfProjectCodexReportIfRequested,
} from "./write-project";
import type { MdPdfProjectCodexProfilePhaseResult } from "./profile-phase";
import type { MdPdfProjectCodexTemplatePhaseResult } from "./template-phase";

interface MdPdfProjectCodexPreflight {
  outputPlan: MarkdownPdfProjectCodexOutputPlan;
  profilePhase: MdPdfProjectCodexProfilePhaseResult;
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
  templatePhase: MdPdfProjectCodexTemplatePhaseResult;
  validation: MarkdownPdfProjectCodexValidationSummary;
}

function initialWriteMode(input: {
  signals: MdPdfProjectCodexSignalCollection;
  state: NormalizedMdPdfProjectCodexCommandState;
}): MdPdfProjectCodexOutputWriteMode {
  return input.state.dryRun || input.signals.modes.project === "codex-assisted"
    ? "report-only"
    : "bundle";
}

async function preflightMdPdfProjectCodex(
  runtime: CliRuntime,
  options: MdPdfProjectCodexOptions,
): Promise<MdPdfProjectCodexPreflight> {
  const state = await normalizeMdPdfProjectCodexCommandState(runtime, options);
  const signals = await collectMdPdfProjectCodexSignals(runtime, state);
  const outputPlan = await planMdPdfProjectCodexOutput({
    identityUidFactory: options.identityUidFactory,
    runtime,
    state,
    signalMode: signals.modes.project,
    writeMode: initialWriteMode({ signals, state }),
  });
  const profilePhase = await runMdPdfProjectCodexProfilePhase({
    outputPlan,
    profileCodexRunner: options.profileCodexRunner,
    runtime,
    signals,
    state,
  });
  const templatePhase = await runMdPdfProjectCodexTemplatePhase({
    outputPlan,
    profilePhase,
    runtime,
    signals,
    state,
    templateCodexRunner: options.templateCodexRunner,
  });
  const validation = validateMdPdfProjectCodexProject({
    outputPlan,
    profilePhase,
    runtime,
    state,
    templatePhase,
  });
  if (!state.dryRun && validation.decisionMode !== "no-usable-project") {
    await validateMdPdfProjectCodexOutputWritability({
      plan: outputPlan,
      runtime,
      state,
      writeMode: "bundle",
    });
  }
  return { outputPlan, profilePhase, signals, state, templatePhase, validation };
}

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
  const preflight = await preflightMdPdfProjectCodex(runtime, options);
  printMdPdfProjectCodexSummary(runtime, preflight);

  if (preflight.state.dryRun) {
    await writeMdPdfProjectCodexReportIfRequested({
      outputPlan: preflight.outputPlan,
      overwrite: preflight.state.overwrite,
      profilePhase: preflight.profilePhase,
      runtime,
      signals: preflight.signals,
      state: preflight.state,
      templatePhase: preflight.templatePhase,
      validation: preflight.validation,
    });
    if (preflight.validation.decisionMode === "no-usable-project") {
      throwNoUsableProject(preflight.validation);
    }
    return;
  }

  await writeMdPdfProjectCodexBundle({
    outputPlan: preflight.outputPlan,
    overwrite: preflight.state.overwrite,
    profilePhase: preflight.profilePhase,
    runtime,
    signals: preflight.signals,
    state: preflight.state,
    templatePhase: preflight.templatePhase,
    validation: preflight.validation,
  });
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
