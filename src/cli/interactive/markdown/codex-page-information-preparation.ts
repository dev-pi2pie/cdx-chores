import { confirm } from "@inquirer/prompts";

import { displayPath, printLine } from "../../actions/shared";
import { getCliColors } from "../../colors";
import { escapeMarkdownPdfPageInformationTerminalText } from "../../markdown-pdf/page-information-terminal";
import type { CliRuntime } from "../../types";
import {
  classifyMarkdownPdfProfileCodexSignalMode,
  executionModeForMarkdownPdfProfileCodexSignalMode,
  prepareMarkdownPdfCodexPageInformationSignal,
  MarkdownPdfPageInformationConflictError,
  type MarkdownPdfCodexPageInformationSignal,
  type MdPdfProfileCodexOptions,
} from "../../markdown-pdf/profile-codex";
import {
  classifyMdPdfProjectCodexSignalModes,
  collectTemplateOwnedIntentDirections,
} from "../../markdown-pdf/project-codex/signal-mode";
import type { MdPdfProjectCodexOptions } from "../../markdown-pdf/project-codex";
import { resolveCodexExecution, type CodexExecutionOptions } from "../../../utils/codex-execution";
import type { MarkdownPdfCodexSetup, PreparedMarkdownPdfCodexCandidate } from "./codex-types";
import { prepareMarkdownPdfCodexCandidate } from "./codex-service";
import {
  loadMarkdownPdfCodexPageInformationBase,
  reviseMarkdownPdfCodexPageInformationConflict,
  type MarkdownPdfCodexLateConflict,
  type MarkdownPdfCodexPageInformationOutcome,
  type MarkdownPdfCodexPageInformationPrompts,
} from "./codex-page-information";

export interface MarkdownPdfPageInformationRequestPlan {
  pageInformation?: MarkdownPdfCodexPageInformationSignal;
  profileMode: "codex-assisted" | "deterministic";
  projectMode?: "codex-assisted" | "deterministic" | "too-low-signal";
  needsConsent: boolean;
}

/** The same helper classifiers decide whether any model request is possible. */
export function planMarkdownPdfPageInformationRequest(
  setup: MarkdownPdfCodexSetup,
): MarkdownPdfPageInformationRequestPlan {
  if (setup.artifact === "template-bundle") {
    throw new Error("Template-bundle setup does not collect page information.");
  }
  const pageInformation = prepareMarkdownPdfCodexPageInformationSignal(setup.pageInformation);
  const facts = {
    hasBaseProfile: Boolean(setup.baseProfile),
    hasFontHints: setup.fontHints.length > 0,
    hasInput: Boolean(setup.sample),
    hasIntent: Boolean(setup.intent),
    hasPageInformation: Boolean(pageInformation),
  };
  const profileSignalMode = classifyMarkdownPdfProfileCodexSignalMode(facts);
  const profileMode = executionModeForMarkdownPdfProfileCodexSignalMode(profileSignalMode);
  if (setup.artifact === "profile") {
    return {
      pageInformation,
      profileMode,
      needsConsent: profileMode === "codex-assisted",
    };
  }
  const project = classifyMdPdfProjectCodexSignalModes({
    ...facts,
    hasCoverImage: Boolean(setup.coverImage),
    templateOwnedSignals: {
      requiresCodex: collectTemplateOwnedIntentDirections(setup.intent).length > 0,
    },
  });
  const needsConsent = project.signalMode === "codex-assisted";
  return {
    pageInformation,
    profileMode,
    projectMode: project.signalMode,
    needsConsent,
  };
}

export { escapeMarkdownPdfPageInformationTerminalText } from "../../markdown-pdf/page-information-terminal";

export function renderMarkdownPdfPageInformationConsent(
  runtime: CliRuntime,
  setup: MarkdownPdfCodexSetup,
  plan: MarkdownPdfPageInformationRequestPlan,
): void {
  const colors = getCliColors(runtime, runtime.stderr);
  printLine(runtime.stderr, colors.bold("Codex Assistant preparation"));
  printLine(runtime.stderr, "");
  printLine(
    runtime.stderr,
    `Creating: ${setup.artifact === "profile" ? "Profile" : "Project bundle"}`,
  );
  printLine(
    runtime.stderr,
    `Markdown sample: ${setup.sample ? escapeMarkdownPdfPageInformationTerminalText(displayPath(runtime, setup.sample)) : "none"}`,
  );
  printLine(
    runtime.stderr,
    `Intent: ${setup.intent ? escapeMarkdownPdfPageInformationTerminalText(setup.intent) : "none"}`,
  );
  printLine(
    runtime.stderr,
    `Base profile: ${setup.baseProfile ? escapeMarkdownPdfPageInformationTerminalText(displayPath(runtime, setup.baseProfile)) : "none"}`,
  );
  printLine(runtime.stderr, "Font hints:");
  if (setup.fontHints.length === 0) {
    printLine(runtime.stderr, "- none");
  } else {
    for (const hint of setup.fontHints) {
      printLine(runtime.stderr, `- ${escapeMarkdownPdfPageInformationTerminalText(hint)}`);
    }
  }
  if (setup.artifact === "project-bundle") {
    printLine(
      runtime.stderr,
      `Cover image: ${setup.coverImage ? escapeMarkdownPdfPageInformationTerminalText(displayPath(runtime, setup.coverImage)) : "none"}`,
    );
  }
  if (plan.pageInformation) {
    printLine(runtime.stderr, colors.bold("Page information sent to Codex:"));
  }
  const numbers = plan.pageInformation?.pageNumbers;
  if (numbers) {
    printLine(runtime.stderr, `Page numbers: ${numbers.enabled ? "ON" : "OFF"}`);
    if (numbers.enabled) {
      printLine(runtime.stderr, `Page-number scope: ${numbers.scope}`);
      printLine(runtime.stderr, `Page-number position: ${numbers.position}`);
      printLine(
        runtime.stderr,
        `Page-number label: ${escapeMarkdownPdfPageInformationTerminalText(numbers.format)}`,
      );
    }
  }
  const repeating = plan.pageInformation?.repeatingContent;
  if (repeating) {
    printLine(runtime.stderr, `Repeating content: ${repeating.enabled ? "ON" : "OFF"}`);
    if (repeating.enabled) {
      for (const position of repeating.selected) {
        printLine(
          runtime.stderr,
          `${position}: ${escapeMarkdownPdfPageInformationTerminalText(repeating.text[position] ?? "")}`,
        );
      }
    }
  }
  printLine(
    runtime.stderr,
    setup.artifact === "project-bundle"
      ? "Codex requests: Profile phase; a Template request may follow if needed."
      : "Codex requests: Profile phase.",
  );
}

export function renderMarkdownPdfPageInformationPhaseModes(
  runtime: CliRuntime,
  candidate: PreparedMarkdownPdfCodexCandidate,
  plan: MarkdownPdfPageInformationRequestPlan,
): void {
  if (candidate.artifact === "project-bundle") {
    printLine(runtime.stderr, `Profile phase: ${candidate.prepared.profilePhase.phase.signalMode}`);
    printLine(
      runtime.stderr,
      `Template phase: ${candidate.prepared.templatePhase.phase.signalMode}`,
    );
  } else if (candidate.artifact === "profile") {
    printLine(runtime.stderr, `Profile phase: ${plan.profileMode}`);
  }
}

/** Internal Phase 2 harness entry. Normal Interactive authoring does not call this. */
export function createMarkdownPdfPageInformationPreparationSession(
  runtime: CliRuntime,
  options: {
    codexExecution?: CodexExecutionOptions;
    timeoutMs?: number;
    confirmRequest?: () => Promise<boolean>;
    prepareCandidate?: typeof prepareMarkdownPdfCodexCandidate;
    internalProfileCodexRunner?: MdPdfProfileCodexOptions["codexRunner"];
    internalTemplateCodexRunner?: MdPdfProjectCodexOptions["templateCodexRunner"];
  } = {},
) {
  const codexExecution = resolveCodexExecution(options.codexExecution);
  const prepareCandidate = options.prepareCandidate ?? prepareMarkdownPdfCodexCandidate;
  return {
    async revise(
      setup: MarkdownPdfCodexSetup,
      conflict: MarkdownPdfCodexLateConflict,
      prompts: MarkdownPdfCodexPageInformationPrompts,
    ): Promise<MarkdownPdfCodexPageInformationOutcome> {
      if (!setup.pageInformation) {
        throw new Error("Page-information revision requires explicit answers.");
      }
      const base = setup.baseProfile
        ? await loadMarkdownPdfCodexPageInformationBase(runtime.cwd, setup.baseProfile)
        : undefined;
      return await reviseMarkdownPdfCodexPageInformationConflict({
        base,
        conflict,
        current: setup.pageInformation,
        prompts,
      });
    },
    async prepare(setup: MarkdownPdfCodexSetup): Promise<
      | { kind: "declined"; plan: MarkdownPdfPageInformationRequestPlan }
      | {
          kind: "needs-revision";
          plan: MarkdownPdfPageInformationRequestPlan;
          conflict: MarkdownPdfCodexLateConflict;
        }
      | {
          kind: "prepared";
          candidate: PreparedMarkdownPdfCodexCandidate;
          plan: MarkdownPdfPageInformationRequestPlan;
        }
    > {
      const plan = planMarkdownPdfPageInformationRequest(setup);
      if (plan.needsConsent) {
        renderMarkdownPdfPageInformationConsent(runtime, setup, plan);
        const accepted = options.confirmRequest
          ? await options.confirmRequest()
          : await confirm({
              message: "Send these prepared signals to Codex Assistant?",
              default: true,
            });
        if (!accepted) return { kind: "declined", plan };
      }
      let candidate: PreparedMarkdownPdfCodexCandidate;
      try {
        candidate = await prepareCandidate(runtime, setup, {
          timeoutMs: options.timeoutMs,
          codexExecution,
          internalPageInformation: setup.pageInformation,
          internalPageInformationSlotResolution: setup.pageInformation?.occupiedNumberSlot,
          internalProfileCodexRunner: options.internalProfileCodexRunner,
          internalTemplateCodexRunner: options.internalTemplateCodexRunner,
        });
      } catch (error) {
        if (!(error instanceof MarkdownPdfPageInformationConflictError)) throw error;
        return {
          kind: "needs-revision",
          plan,
          conflict: { position: error.position, text: error.text, source: error.source },
        };
      }
      renderMarkdownPdfPageInformationPhaseModes(runtime, candidate, plan);
      return { kind: "prepared", candidate, plan };
    },
  };
}
