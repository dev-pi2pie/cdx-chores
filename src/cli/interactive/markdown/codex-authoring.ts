import {
  resolveCodexExecution,
  type CodexExecutionOptions,
  type ResolvedCodexExecution,
} from "../../../utils/codex-execution";
import { select } from "@inquirer/prompts";
import { isDeepStrictEqual } from "node:util";

import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";
import {
  confirmMarkdownPdfCodexConsent,
  promptMarkdownPdfCodexReportRetention,
  promptMarkdownPdfCodexReviewAction,
  renderMarkdownPdfCodexCandidateReview,
} from "./codex-review";
import { saveMarkdownPdfCodexCandidate } from "./codex-save";
import { prepareMarkdownPdfCodexCandidate } from "./codex-service";
import { collectMarkdownPdfCodexSetup } from "./codex-setup";
import { createMarkdownPdfPageInformationPreparationSession } from "./codex-page-information-preparation";
import { createMarkdownPdfCodexPageInformationPrompts } from "./codex-page-information";
import type {
  MarkdownPdfCodexArtifact,
  MarkdownPdfCodexSetup,
  MarkdownPdfGeneratedLifecycleHandler,
  MarkdownPdfGeneratedLifecycleSelection,
  MarkdownPdfSavedRecipe,
  PreparedMarkdownPdfCodexCandidate,
} from "./codex-types";
import type { MarkdownPdfInteractiveFontHintEditorSession } from "./font-hints";
import type { MarkdownPdfInteractiveEntry } from "./types";
import {
  promptMarkdownPdfRenderCodeHighlightChoice,
  type MarkdownPdfRenderCodeHighlightChoice,
} from "./render-code-highlighting";
import {
  promptMarkdownPdfRenderPageNumberChoice,
  type MarkdownPdfRenderPageNumberChoice,
} from "./render-page-numbers";

export type MarkdownPdfCodexAuthoringOutcome =
  | { kind: "complete" }
  | { kind: "change-mode" }
  | { kind: "change-artifact" }
  | MarkdownPdfGeneratedLifecycleSelection
  | MarkdownPdfSavedRecipe;

async function promptDeclinedConsentAction(): Promise<"setup" | "artifact" | "cancel"> {
  return await select({
    message: "Codex Assistant preparation next step",
    choices: [
      { name: "Revise setup", value: "setup" },
      { name: "Change artifact", value: "artifact" },
      { name: "Cancel", value: "cancel" },
    ],
  });
}

async function prepareWithConsent(
  runtime: CliRuntime,
  setup: MarkdownPdfCodexSetup,
  timeoutMs: number,
  codexExecution: ResolvedCodexExecution,
): Promise<PreparedMarkdownPdfCodexCandidate | "revise" | "change-artifact" | "cancel"> {
  if (!(await confirmMarkdownPdfCodexConsent(runtime, setup))) {
    const next = await promptDeclinedConsentAction();
    return next === "setup" ? "revise" : next === "artifact" ? "change-artifact" : "cancel";
  }
  return await prepareMarkdownPdfCodexCandidate(runtime, setup, { timeoutMs, codexExecution });
}

export function sameCodexSetup(left: MarkdownPdfCodexSetup, right: MarkdownPdfCodexSetup): boolean {
  return (
    left.artifact === right.artifact &&
    left.baseProfile === right.baseProfile &&
    left.coverImage === right.coverImage &&
    left.intent === right.intent &&
    left.sample === right.sample &&
    left.fontHints.length === right.fontHints.length &&
    left.fontHints.every((hint, index) => hint === right.fontHints[index]) &&
    isDeepStrictEqual(left.pageInformation, right.pageInformation)
  );
}

export async function runMarkdownPdfCodexAuthoring(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  input: {
    artifact: MarkdownPdfCodexArtifact;
    backToMode: boolean;
    codexTimeoutMs: number;
    codexExecution?: CodexExecutionOptions;
    entry: MarkdownPdfInteractiveEntry;
    fontHintEditor: MarkdownPdfInteractiveFontHintEditorSession;
    onGeneratedLifecycle?: MarkdownPdfGeneratedLifecycleHandler;
    markdownInput?: string;
  },
): Promise<MarkdownPdfCodexAuthoringOutcome> {
  const codexExecution = resolveCodexExecution(input.codexExecution);
  const pageInformationSession = createMarkdownPdfPageInformationPreparationSession(runtime, {
    codexExecution,
    timeoutMs: input.codexTimeoutMs,
  });
  let setup: MarkdownPdfCodexSetup | undefined;
  let acceptedCandidate: PreparedMarkdownPdfCodexCandidate | undefined;
  let renderContext:
    | {
        candidate: PreparedMarkdownPdfCodexCandidate;
        codeHighlight: MarkdownPdfRenderCodeHighlightChoice;
        pageNumbers: MarkdownPdfRenderPageNumberChoice;
      }
    | undefined;
  while (true) {
    const setupOutcome = await collectMarkdownPdfCodexSetup(runtime, pathPromptContext, {
      artifact: input.artifact,
      entry: input.entry,
      fontHintEditor: input.fontHintEditor,
      initialSetup: setup,
      markdownInput: input.markdownInput,
    });
    if (setupOutcome.kind === "cancel") {
      return { kind: "complete" };
    }
    if (setupOutcome.kind === "back") {
      return { kind: input.backToMode ? "change-mode" : "change-artifact" };
    }
    setup = setupOutcome.setup;

    let prepared: PreparedMarkdownPdfCodexCandidate | "revise" | "change-artifact" | "cancel";
    if (acceptedCandidate && sameCodexSetup(acceptedCandidate.setup, setup)) {
      prepared = acceptedCandidate;
    } else if (setup.pageInformation) {
      while (true) {
        const outcome = await pageInformationSession.prepare(setup);
        if (outcome.kind === "prepared") {
          prepared = outcome.candidate;
          break;
        }
        if (outcome.kind === "declined") {
          const next = await promptDeclinedConsentAction();
          prepared =
            next === "setup" ? "revise" : next === "artifact" ? "change-artifact" : "cancel";
          break;
        }
        const revision = await pageInformationSession.revise(
          setup,
          outcome.conflict,
          createMarkdownPdfCodexPageInformationPrompts(pathPromptContext),
        );
        if (revision.kind === "cancel") {
          prepared = "cancel";
          break;
        }
        if (revision.kind === "back") {
          prepared = "revise";
          break;
        }
        setup = { ...setup, pageInformation: revision.answers };
        if (!revision.answers) {
          prepared = "revise";
          break;
        }
      }
    } else {
      prepared = await prepareWithConsent(runtime, setup, input.codexTimeoutMs, codexExecution);
    }
    if (prepared === "cancel") {
      return { kind: "complete" };
    }
    if (prepared === "change-artifact") {
      return { kind: "change-artifact" };
    }
    if (prepared === "revise") {
      continue;
    }
    acceptedCandidate = prepared;

    while (true) {
      renderMarkdownPdfCodexCandidateReview(runtime, prepared);
      const action = await promptMarkdownPdfCodexReviewAction(input.entry, prepared);
      if (action === "cancel") {
        return { kind: "complete" };
      }
      if (action === "change-artifact") {
        return { kind: "change-artifact" };
      }
      if (action === "change-setup") {
        break;
      }
      if (action === "regenerate") {
        const regenerated = setup.pageInformation
          ? await pageInformationSession.prepare(setup)
          : await prepareWithConsent(runtime, setup, input.codexTimeoutMs, codexExecution);
        if (
          typeof regenerated !== "string" &&
          "kind" in regenerated &&
          regenerated.kind !== "prepared"
        ) {
          if (regenerated.kind === "needs-revision") {
            const revision = await pageInformationSession.revise(
              setup,
              regenerated.conflict,
              createMarkdownPdfCodexPageInformationPrompts(pathPromptContext),
            );
            if (revision.kind === "cancel") return { kind: "complete" };
            if (revision.kind === "back") break;
            setup = { ...setup, pageInformation: revision.answers };
            break;
          }
          const next = await promptDeclinedConsentAction();
          if (next === "cancel") return { kind: "complete" };
          if (next === "artifact") return { kind: "change-artifact" };
          break;
        }
        const regeneratedCandidate =
          typeof regenerated === "string"
            ? regenerated
            : "candidate" in regenerated
              ? regenerated.candidate
              : regenerated;
        if (regeneratedCandidate === "cancel") {
          return { kind: "complete" };
        }
        if (regeneratedCandidate === "change-artifact") {
          return { kind: "change-artifact" };
        }
        if (regeneratedCandidate === "revise") {
          break;
        }
        prepared = regeneratedCandidate;
        acceptedCandidate = regeneratedCandidate;
        continue;
      }
      if (action === "save") {
        const report = await promptMarkdownPdfCodexReportRetention("save-only", pathPromptContext);
        const saved = await saveMarkdownPdfCodexCandidate(
          runtime,
          pathPromptContext,
          prepared,
          report,
        );
        if (saved.kind === "review") {
          continue;
        }
        return saved.kind === "cancel" ? { kind: "complete" } : saved.saved;
      }
      const lifecycle = action;
      const currentCodeHighlight =
        renderContext?.candidate === prepared ? renderContext.codeHighlight : "inherit";
      let codeHighlight = currentCodeHighlight;
      let pageNumbers =
        renderContext?.candidate === prepared ? renderContext.pageNumbers : "inherit";
      let backToReview = false;
      while (true) {
        const codeChoice = await promptMarkdownPdfRenderCodeHighlightChoice(codeHighlight);
        if (codeChoice === "back") {
          backToReview = true;
          break;
        }
        if (codeChoice === "cancel") {
          return { kind: "complete" };
        }
        codeHighlight = codeChoice;
        const pageChoice = await promptMarkdownPdfRenderPageNumberChoice(pageNumbers);
        if (pageChoice === "cancel") {
          return { kind: "complete" };
        }
        if (pageChoice === "back") {
          continue;
        }
        pageNumbers = pageChoice;
        break;
      }
      if (backToReview) {
        continue;
      }
      const report = await promptMarkdownPdfCodexReportRetention(lifecycle, pathPromptContext);
      const selection: MarkdownPdfGeneratedLifecycleSelection = {
        candidate: { kind: "codex", candidate: prepared },
        codeHighlight,
        kind: "generated-lifecycle",
        lifecycle,
        markdownInput: input.markdownInput!,
        pageNumbers,
        report,
      };
      if (!input.onGeneratedLifecycle) {
        return selection;
      }
      const outcome = await input.onGeneratedLifecycle(selection);
      if (outcome.kind === "complete") {
        return { kind: "complete" };
      }
      renderContext = {
        candidate: prepared,
        codeHighlight: outcome.codeHighlight,
        pageNumbers: outcome.pageNumbers,
      };
    }
  }
}
