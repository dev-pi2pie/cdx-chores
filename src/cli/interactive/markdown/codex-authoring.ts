import { select } from "@inquirer/prompts";

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
): Promise<PreparedMarkdownPdfCodexCandidate | "revise" | "change-artifact" | "cancel"> {
  if (!(await confirmMarkdownPdfCodexConsent(runtime, setup))) {
    const next = await promptDeclinedConsentAction();
    return next === "setup" ? "revise" : next === "artifact" ? "change-artifact" : "cancel";
  }
  return await prepareMarkdownPdfCodexCandidate(runtime, setup, { timeoutMs });
}

function sameCodexSetup(left: MarkdownPdfCodexSetup, right: MarkdownPdfCodexSetup): boolean {
  return (
    left.artifact === right.artifact &&
    left.baseProfile === right.baseProfile &&
    left.coverImage === right.coverImage &&
    left.intent === right.intent &&
    left.sample === right.sample &&
    left.fontHints.length === right.fontHints.length &&
    left.fontHints.every((hint, index) => hint === right.fontHints[index])
  );
}

export async function runMarkdownPdfCodexAuthoring(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  input: {
    artifact: MarkdownPdfCodexArtifact;
    backToMode: boolean;
    codexTimeoutMs: number;
    entry: MarkdownPdfInteractiveEntry;
    fontHintEditor: MarkdownPdfInteractiveFontHintEditorSession;
    onGeneratedLifecycle?: MarkdownPdfGeneratedLifecycleHandler;
    markdownInput?: string;
  },
): Promise<MarkdownPdfCodexAuthoringOutcome> {
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

    let prepared =
      acceptedCandidate && sameCodexSetup(acceptedCandidate.setup, setup)
        ? acceptedCandidate
        : await prepareWithConsent(runtime, setup, input.codexTimeoutMs);
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
        const regenerated = await prepareWithConsent(runtime, setup, input.codexTimeoutMs);
        if (regenerated === "cancel") {
          return { kind: "complete" };
        }
        if (regenerated === "change-artifact") {
          return { kind: "change-artifact" };
        }
        if (regenerated === "revise") {
          break;
        }
        prepared = regenerated;
        acceptedCandidate = regenerated;
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
