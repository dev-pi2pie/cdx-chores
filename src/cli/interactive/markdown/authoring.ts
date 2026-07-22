import { select } from "@inquirer/prompts";

import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import type { InteractiveNavigationOutcome, InteractivePathPromptContext } from "../shared";
import {
  markdownPdfCandidateReviewChoices,
  renderDeterministicRecipeReview,
  type MarkdownPdfCandidateReviewAction,
} from "./authoring-review";
import { saveMarkdownPdfDeterministicCandidate } from "./authoring-save";
import {
  prepareMarkdownPdfDeterministicRecipe,
  type MarkdownPdfDeterministicArtifact,
  type MarkdownPdfDeterministicPreparation,
  type PreparedMarkdownPdfDeterministicRecipe,
} from "./deterministic-authoring";
import {
  collectMarkdownPdfFormalGuideAnswers,
  compileMarkdownPdfFormalGuideOptions,
  createMarkdownPdfFormalGuidePrompts,
  reviseMarkdownPdfFormalGuideLayout,
  reviseMarkdownPdfFormalGuideMargins,
  reviseMarkdownPdfFormalGuideToc,
  type MarkdownPdfFormalGuideGroup,
} from "./formal-guide";
import type { MarkdownPdfInteractiveEntry } from "./types";

export type MarkdownPdfDeterministicAuthoringOutcome =
  | InteractiveNavigationOutcome
  | { kind: "change-source" };

async function promptArtifact(
  entry: MarkdownPdfInteractiveEntry,
): Promise<MarkdownPdfDeterministicArtifact | "back" | "cancel"> {
  return await select({
    message: "What would you like to create?",
    choices: [
      { name: "Profile", value: "profile", description: "Reusable layout and PDF settings" },
      {
        name: "Template bundle",
        value: "template-bundle",
        description: "Pandoc template and stylesheet bundle",
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
  MarkdownPdfDeterministicPreparation | "back" | "cancel"
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
  const formalGuideAnswers = await collectMarkdownPdfFormalGuideAnswers(
    createMarkdownPdfFormalGuidePrompts(),
  );
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
  const revised =
    group === "layout"
      ? await reviseMarkdownPdfFormalGuideLayout(answers, prompts)
      : group === "margins"
        ? await reviseMarkdownPdfFormalGuideMargins(answers, prompts)
        : await reviseMarkdownPdfFormalGuideToc(answers, prompts);
  return prepareMarkdownPdfDeterministicRecipe({
    artifact: candidate.artifact,
    preparation: "formal-guide",
    formalGuideAnswers: revised,
    options: compileMarkdownPdfFormalGuideOptions(revised),
  });
}

function deferredLifecycleError(): CliError {
  return new CliError(
    "Interactive rendering for a generated Markdown PDF recipe is not implemented yet.",
    {
      code: "MARKDOWN_PDF_INTERACTIVE_MATERIALIZATION_NOT_READY",
      exitCode: 2,
    },
  );
}

async function reviewCandidate(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  entry: MarkdownPdfInteractiveEntry,
  initialCandidate: PreparedMarkdownPdfDeterministicRecipe,
  markdownInput?: string,
): Promise<"complete" | "change-mode" | "change-artifact"> {
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
      throw deferredLifecycleError();
    }
    if (action === "save") {
      if (
        (await saveMarkdownPdfDeterministicCandidate(runtime, pathPromptContext, candidate)) ===
        "complete"
      ) {
        return "complete";
      }
      continue;
    }
    candidate = await reviseCandidate(
      candidate,
      action === "revise-layout" ? "layout" : action === "revise-margins" ? "margins" : "toc",
    );
  }
}

export async function runMarkdownPdfDeterministicAuthoring(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  input: { entry: MarkdownPdfInteractiveEntry; markdownInput?: string },
): Promise<MarkdownPdfDeterministicAuthoringOutcome> {
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

    let changeArtifact = false;
    while (!changeArtifact) {
      const preparation = await promptPreparationMode();
      if (preparation === "cancel") {
        return { kind: "complete" };
      }
      if (preparation === "back") {
        break;
      }
      const candidate = await prepareCandidate(artifact, preparation);
      const outcome = await reviewCandidate(
        runtime,
        pathPromptContext,
        input.entry,
        candidate,
        input.markdownInput,
      );
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
