import { confirm, select } from "@inquirer/prompts";

import {
  executePlannedMarkdownPdfRender,
  planMarkdownPdfRender,
  type PlannedMarkdownPdfRender,
} from "../../actions/markdown/to-pdf-service";
import { displayPath, printLine } from "../../actions/shared";
import { formatDefaultOutputPathHint, promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import type { InteractiveNavigationOutcome, InteractivePathPromptContext } from "../shared";
import { runMarkdownPdfAuthoring } from "./authoring";
import { createMarkdownPdfInteractiveCodexSession } from "./codex-session";
import type { MarkdownPdfSavedRecipe } from "./codex-types";
import { handleMarkdownPdfGeneratedLifecycle } from "./generated-lifecycle";
import { isRecoverableGeneratedLifecycleBindError } from "./generated-lifecycle/guards";

import {
  collectPreparedMarkdownPdfRenderSource,
  prepareSavedMarkdownPdfRenderSource,
  promptMarkdownPdfRenderInput,
  type MarkdownPdfInteractivePreparedRenderSource,
} from "./render-source";
import { renderMarkdownPdfRecipeReview } from "./review";

type MarkdownPdfOutputSelection =
  | { kind: "plan"; plan: PlannedMarkdownPdfRender }
  | { kind: "change-source" }
  | { kind: "cancel" };

async function promptMarkdownPdfOutput(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  selection: MarkdownPdfInteractivePreparedRenderSource,
): Promise<MarkdownPdfOutputSelection> {
  while (true) {
    const defaultHint = formatDefaultOutputPathHint(runtime, selection.prepared.inputPath, ".pdf");
    const destination = await select<"default" | "custom" | "change-source" | "cancel">({
      message: "PDF output destination",
      choices: [
        {
          name: "Use default output",
          value: "default",
          description: defaultHint,
        },
        {
          name: "Custom output path",
          value: "custom",
          description: "Choose where to write the PDF",
        },
        { name: "Change recipe source", value: "change-source" },
        { name: "Cancel", value: "cancel" },
      ],
    });
    if (destination === "change-source" || destination === "cancel") {
      return { kind: destination };
    }

    const output =
      destination === "custom"
        ? await promptRequiredPathWithConfig("Custom PDF output path", {
            kind: "file",
            ...pathPromptContext,
          })
        : undefined;
    const overwrite = await confirm({ message: "Overwrite PDF if it exists?", default: false });
    try {
      const plan = await planMarkdownPdfRender(runtime, selection.prepared, {
        output,
        overwrite,
      });
      return { kind: "plan", plan };
    } catch (error) {
      if (!isRecoverableGeneratedLifecycleBindError(error)) {
        throw error;
      }
      printLine(runtime.stderr, `Unable to prepare PDF output: ${error.message}`);
    }
  }
}

function renderMarkdownPdfFinalReview(
  runtime: CliRuntime,
  selection: MarkdownPdfInteractivePreparedRenderSource,
  plan: PlannedMarkdownPdfRender,
): void {
  printLine(runtime.stderr, "Final render review");
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `Input: ${displayPath(runtime, selection.prepared.inputPath)}`);
  printLine(runtime.stderr, `PDF output: ${displayPath(runtime, plan.outputPath)}`);
  printLine(runtime.stderr, `Overwrite: ${plan.overwrite ? "enabled" : "disabled"}`);
  printLine(runtime.stderr, "Existing recipe cleanup: never");
}

async function promptDeclinedRenderAction(): Promise<"change-output" | "change-source" | "cancel"> {
  return await select<"change-output" | "change-source" | "cancel">({
    message: "Final render next step",
    choices: [
      { name: "Change PDF output", value: "change-output" },
      { name: "Change recipe source", value: "change-source" },
      { name: "Cancel", value: "cancel" },
    ],
  });
}

type PreparedRenderOutcome = "change-source" | "done";

async function handlePreparedMarkdownPdfRender(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  source: MarkdownPdfInteractivePreparedRenderSource,
): Promise<PreparedRenderOutcome> {
  while (true) {
    renderMarkdownPdfRecipeReview(runtime, source);
    const output = await promptMarkdownPdfOutput(runtime, pathPromptContext, source);
    if (output.kind === "cancel") {
      return "done";
    }
    if (output.kind === "change-source") {
      return "change-source";
    }

    renderMarkdownPdfFinalReview(runtime, source, output.plan);
    if (!(await confirm({ message: "Render this PDF?", default: true }))) {
      const next = await promptDeclinedRenderAction();
      if (next === "cancel") {
        return "done";
      }
      if (next === "change-source") {
        return "change-source";
      }
      continue;
    }

    const result = await executePlannedMarkdownPdfRender(runtime, output.plan);
    if (result.warnings.length > 0) {
      printLine(runtime.stderr, "Markdown PDF render warnings:");
      for (const warning of result.warnings) {
        printLine(runtime.stderr, `- ${warning}`);
      }
    }
    printLine(runtime.stdout, `Wrote PDF: ${displayPath(runtime, output.plan.outputPath)}`);
    return "done";
  }
}

export async function handleMarkdownPdfToPdfInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<InteractiveNavigationOutcome> {
  return await runMarkdownPdfToPdfInteractiveFlow(runtime, pathPromptContext);
}

async function promptMarkdownPdfHandoffInput(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  saved: MarkdownPdfSavedRecipe,
): Promise<string> {
  if (!saved.sample) {
    return await promptMarkdownPdfRenderInput(pathPromptContext);
  }
  const choice = await select<"sample" | "choose">({
    message: "Markdown input for rendering",
    choices: [
      {
        name: `Use ${displayPath(runtime, saved.sample)}`,
        value: "sample",
        description: "Use the preparation sample as the render input",
      },
      { name: "Choose another Markdown file", value: "choose" },
    ],
  });
  return choice === "sample" ? saved.sample : await promptMarkdownPdfRenderInput(pathPromptContext);
}

export async function runMarkdownPdfToPdfInteractiveFlow(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: { savedRecipe?: MarkdownPdfSavedRecipe } = {},
): Promise<InteractiveNavigationOutcome> {
  const session = createMarkdownPdfInteractiveCodexSession(runtime);
  try {
    const input = options.savedRecipe
      ? await promptMarkdownPdfHandoffInput(runtime, pathPromptContext, options.savedRecipe)
      : await promptMarkdownPdfRenderInput(pathPromptContext);
    let preselected = options.savedRecipe;
    while (true) {
      const source = preselected
        ? await prepareSavedMarkdownPdfRenderSource(runtime, input, preselected)
        : await collectPreparedMarkdownPdfRenderSource(runtime, pathPromptContext, input);
      preselected = undefined;
      if (source.kind === "back") {
        return { kind: "open-submenu", group: "md" };
      }
      if (source.kind === "cancel") {
        return { kind: "complete" };
      }
      if (source.kind === "generated") {
        const outcome = await runMarkdownPdfAuthoring(runtime, pathPromptContext, {
          entry: "to-pdf",
          fontHintEditor: session.fontHintEditor,
          markdownInput: input,
          onGeneratedLifecycle: async (selection) =>
            await handleMarkdownPdfGeneratedLifecycle(runtime, pathPromptContext, selection),
        });
        if (outcome.kind === "change-source") {
          continue;
        }
        if (outcome.kind === "generated-lifecycle") {
          return { kind: "complete" };
        }
        if (outcome.kind === "saved-recipe") {
          return { kind: "complete" };
        }
        return outcome;
      }

      if ((await handlePreparedMarkdownPdfRender(runtime, pathPromptContext, source)) === "done") {
        return { kind: "complete" };
      }
    }
  } finally {
    session.cancel();
  }
}
