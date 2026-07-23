import { select } from "@inquirer/prompts";

import { printLine } from "../../actions/shared";
import type { CliRuntime } from "../../types";
import type { InteractiveNavigationOutcome, InteractivePathPromptContext } from "../shared";
import {
  markdownPdfCandidateReviewChoices,
  renderDeterministicRecipeReview,
  type MarkdownPdfCandidateReviewAction,
} from "./authoring-review";
import { saveMarkdownPdfDeterministicCandidate } from "./authoring-save";
import {
  runMarkdownPdfCodexAuthoring,
  type MarkdownPdfCodexAuthoringOutcome,
} from "./codex-authoring";
import type {
  MarkdownPdfCodexArtifact,
  MarkdownPdfGeneratedLifecycleHandler,
  MarkdownPdfGeneratedLifecycleSelection,
  MarkdownPdfSavedRecipe,
} from "./codex-types";
import type { MarkdownPdfInteractiveFontHintEditorSession } from "./font-hints";
import {
  prepareMarkdownPdfDeterministicRecipe,
  type MarkdownPdfDeterministicArtifact,
  type MarkdownPdfDeterministicPreparation,
  type PreparedMarkdownPdfDeterministicRecipe,
} from "./deterministic-authoring";
import {
  collectMarkdownPdfFormalGuideAnswers,
  collectMarkdownPdfProfileFormalGuideAnswers,
  compileMarkdownPdfFormalGuideOptions,
  createMarkdownPdfFormalGuidePrompts,
  reviseMarkdownPdfFormalGuideCode,
  reviseMarkdownPdfFormalGuideLayout,
  reviseMarkdownPdfFormalGuideMargins,
  reviseMarkdownPdfFormalGuideToc,
  type MarkdownPdfFormalGuideGroup,
} from "./formal-guide";
import type { MarkdownPdfInteractiveEntry } from "./types";

export type MarkdownPdfAuthoringOutcome =
  | InteractiveNavigationOutcome
  | { kind: "change-source" }
  | MarkdownPdfGeneratedLifecycleSelection
  | MarkdownPdfSavedRecipe;

async function promptArtifact(
  entry: MarkdownPdfInteractiveEntry,
): Promise<MarkdownPdfCodexArtifact | "back" | "cancel"> {
  return await select({
    message: "What would you like to create?",
    choices: [
      {
        name: "Profile",
        value: "profile",
        description: "Reusable layout and PDF settings",
      },
      {
        name: "Template bundle",
        value: "template-bundle",
        description: "Pandoc template and stylesheet bundle",
      },
      {
        name: "Project bundle",
        value: "project-bundle",
        description: "Coordinated Profile, Template, stylesheet, and assets",
      },
      {
        name: "Back",
        value: "back",
        description:
          entry === "to-pdf" ? "Choose another recipe source" : "Return to the Markdown menu",
      },
      { name: "Cancel", value: "cancel", description: "Exit without writing" },
    ],
  });
}

async function promptPreparationMode(): Promise<
  MarkdownPdfDeterministicPreparation | "codex-assistant" | "back" | "cancel"
> {
  return await select({
    message: "Choose preparation mode",
    choices: [
      {
        name: "starter",
        value: "starter",
        description: "Use the deterministic starter configuration",
      },
      {
        name: "formal-guide",
        value: "formal-guide",
        description: "Answer structured layout, margin, and ToC questions",
      },
      {
        name: "Codex Assistant",
        value: "codex-assistant",
        description: "Draft and adapt the recipe from bounded signals",
      },
      { name: "Back", value: "back", description: "Choose another artifact" },
      { name: "Cancel", value: "cancel", description: "Exit without writing" },
    ],
  });
}

async function prepareCandidate(
  artifact: MarkdownPdfDeterministicArtifact,
  preparation: MarkdownPdfDeterministicPreparation,
): Promise<PreparedMarkdownPdfDeterministicRecipe> {
  if (preparation === "starter") {
    return prepareMarkdownPdfDeterministicRecipe({ artifact, preparation });
  }
  const prompts = createMarkdownPdfFormalGuidePrompts();
  if (artifact === "profile") {
    const formalGuideAnswers = await collectMarkdownPdfProfileFormalGuideAnswers(prompts);
    return prepareMarkdownPdfDeterministicRecipe({
      artifact,
      preparation,
      formalGuideAnswers,
      options: compileMarkdownPdfFormalGuideOptions(formalGuideAnswers),
    });
  }
  const formalGuideAnswers = await collectMarkdownPdfFormalGuideAnswers(prompts);
  return prepareMarkdownPdfDeterministicRecipe({
    artifact,
    preparation,
    formalGuideAnswers,
    options: compileMarkdownPdfFormalGuideOptions(formalGuideAnswers),
  });
}

async function reviseCandidate(
  candidate: PreparedMarkdownPdfDeterministicRecipe,
  group: MarkdownPdfFormalGuideGroup,
): Promise<PreparedMarkdownPdfDeterministicRecipe> {
  const answers = candidate.formalGuideAnswers;
  if (!answers) {
    return candidate;
  }
  const prompts = createMarkdownPdfFormalGuidePrompts();
  if (candidate.artifact === "profile") {
    const revised =
      group === "code"
        ? await reviseMarkdownPdfFormalGuideCode(answers, prompts)
        : group === "layout"
          ? {
              ...(await reviseMarkdownPdfFormalGuideLayout(answers, prompts)),
              code: answers.code,
            }
          : group === "margins"
            ? {
                ...(await reviseMarkdownPdfFormalGuideMargins(answers, prompts)),
                code: answers.code,
              }
            : {
                ...(await reviseMarkdownPdfFormalGuideToc(answers, prompts)),
                code: answers.code,
              };
    return prepareMarkdownPdfDeterministicRecipe({
      artifact: "profile",
      preparation: "formal-guide",
      formalGuideAnswers: revised,
      options: compileMarkdownPdfFormalGuideOptions(revised),
    });
  }
  const revised =
    group === "layout"
      ? await reviseMarkdownPdfFormalGuideLayout(answers, prompts)
      : group === "margins"
        ? await reviseMarkdownPdfFormalGuideMargins(answers, prompts)
        : await reviseMarkdownPdfFormalGuideToc(answers, prompts);
  return prepareMarkdownPdfDeterministicRecipe({
    artifact: "template-bundle",
    preparation: "formal-guide",
    formalGuideAnswers: revised,
    options: compileMarkdownPdfFormalGuideOptions(revised),
  });
}

async function reviewCandidate(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  entry: MarkdownPdfInteractiveEntry,
  initialCandidate: PreparedMarkdownPdfDeterministicRecipe,
  markdownInput?: string,
  onGeneratedLifecycle?: MarkdownPdfGeneratedLifecycleHandler,
): Promise<
  | "complete"
  | "change-mode"
  | "change-artifact"
  | MarkdownPdfGeneratedLifecycleSelection
  | MarkdownPdfSavedRecipe
> {
  let candidate = initialCandidate;
  while (true) {
    renderDeterministicRecipeReview(runtime, candidate, markdownInput);
    const action = await select<MarkdownPdfCandidateReviewAction>({
      message: "Recipe review next step",
      choices: markdownPdfCandidateReviewChoices(entry, candidate),
    });
    if (action === "cancel") {
      return "complete";
    }
    if (action === "change-mode" || action === "change-artifact") {
      return action;
    }
    if (action === "temporary-render" || action === "save-and-render") {
      const selection: MarkdownPdfGeneratedLifecycleSelection = {
        candidate: { kind: "deterministic", candidate },
        kind: "generated-lifecycle",
        lifecycle: action,
        markdownInput: markdownInput!,
        report: { kind: "none" },
      };
      if (!onGeneratedLifecycle) {
        return selection;
      }
      if ((await onGeneratedLifecycle(selection)) === "complete") {
        return "complete";
      }
      continue;
    }
    if (action === "save") {
      const saved = await saveMarkdownPdfDeterministicCandidate(
        runtime,
        pathPromptContext,
        candidate,
      );
      if (saved.kind === "saved") {
        return saved.saved;
      }
      if (saved.kind === "cancel") {
        return "complete";
      }
      continue;
    }
    candidate = await reviseCandidate(
      candidate,
      action === "revise-layout"
        ? "layout"
        : action === "revise-margins"
          ? "margins"
          : action === "revise-toc"
            ? "toc"
            : "code",
    );
  }
}

function isNavigationOutcome(
  outcome: MarkdownPdfCodexAuthoringOutcome,
): outcome is Extract<
  MarkdownPdfCodexAuthoringOutcome,
  { kind: "complete" | "change-mode" | "change-artifact" }
> {
  return (
    outcome.kind === "complete" ||
    outcome.kind === "change-mode" ||
    outcome.kind === "change-artifact"
  );
}

export async function runMarkdownPdfAuthoring(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  input: {
    entry: MarkdownPdfInteractiveEntry;
    fontHintEditor: MarkdownPdfInteractiveFontHintEditorSession;
    markdownInput?: string;
    onGeneratedLifecycle?: MarkdownPdfGeneratedLifecycleHandler;
  },
): Promise<MarkdownPdfAuthoringOutcome> {
  while (true) {
    const artifact = await promptArtifact(input.entry);
    if (artifact === "cancel") {
      return { kind: "complete" };
    }
    if (artifact === "back") {
      return input.entry === "to-pdf"
        ? { kind: "change-source" }
        : { kind: "open-submenu", group: "md" };
    }

    if (artifact === "project-bundle") {
      printLine(runtime.stderr, "Project bundles are prepared with Codex Assistant.");
      const outcome = await runMarkdownPdfCodexAuthoring(runtime, pathPromptContext, {
        artifact,
        backToMode: false,
        entry: input.entry,
        fontHintEditor: input.fontHintEditor,
        markdownInput: input.markdownInput,
        onGeneratedLifecycle: input.onGeneratedLifecycle,
      });
      if (outcome.kind === "change-artifact" || outcome.kind === "change-mode") {
        continue;
      }
      return outcome;
    }

    let changeArtifact = false;
    while (!changeArtifact) {
      const preparation = await promptPreparationMode();
      if (preparation === "cancel") {
        return { kind: "complete" };
      }
      if (preparation === "back") {
        break;
      }
      if (preparation === "codex-assistant") {
        const outcome = await runMarkdownPdfCodexAuthoring(runtime, pathPromptContext, {
          artifact,
          backToMode: true,
          entry: input.entry,
          fontHintEditor: input.fontHintEditor,
          markdownInput: input.markdownInput,
          onGeneratedLifecycle: input.onGeneratedLifecycle,
        });
        if (!isNavigationOutcome(outcome)) {
          return outcome;
        }
        if (outcome.kind === "complete") {
          return outcome;
        }
        if (outcome.kind === "change-artifact") {
          changeArtifact = true;
        }
        continue;
      }
      const candidate = await prepareCandidate(artifact, preparation);
      const outcome = await reviewCandidate(
        runtime,
        pathPromptContext,
        input.entry,
        candidate,
        input.markdownInput,
        input.onGeneratedLifecycle,
      );
      if (typeof outcome !== "string") {
        return outcome;
      }
      switch (outcome) {
        case "complete":
          return { kind: "complete" };
        case "change-mode":
          continue;
        case "change-artifact":
          changeArtifact = true;
          continue;
      }
    }
  }
}
