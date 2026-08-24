import { select } from "@inquirer/prompts";

import { displayPath } from "../../actions/shared";
import type { CliRuntime } from "../../types";
import { createInteractiveSession, type InteractiveSession } from "../session";
import type { InteractiveNavigationOutcome, InteractivePathPromptContext } from "../shared";
import { runMarkdownPdfAuthoring } from "./authoring";
import { createMarkdownPdfInteractiveCodexSession } from "./codex-session";
import type { MarkdownPdfSavedRecipe } from "./codex-types";
import {
  createMarkdownPdfGeneratedLifecycleSession,
  handleMarkdownPdfGeneratedLifecycle,
} from "./generated-lifecycle";
import {
  collectMarkdownPdfRenderSource,
  promptMarkdownPdfRenderInput,
  selectSavedMarkdownPdfRenderSource,
  type MarkdownPdfInteractivePreparedRenderSource,
} from "./render-source";
import {
  promptAndPrepareDirectMarkdownPdfRenderSource,
  promptAndPrepareSavedMarkdownPdfRenderSource,
} from "./to-pdf/source-preparation";
import { handlePreparedMarkdownPdfRender } from "./to-pdf/prepared-render";

export async function handleMarkdownPdfToPdfInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  session: InteractiveSession = createInteractiveSession(),
): Promise<InteractiveNavigationOutcome> {
  return await runMarkdownPdfToPdfInteractiveFlow(runtime, pathPromptContext, {
    interactiveSession: session,
  });
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
  options: {
    interactiveSession?: InteractiveSession;
    savedRecipe?: MarkdownPdfSavedRecipe;
  } = {},
): Promise<InteractiveNavigationOutcome> {
  const interactiveSession = options.interactiveSession ?? createInteractiveSession();
  const codexSession = createMarkdownPdfInteractiveCodexSession(runtime);
  const generatedLifecycleSession = createMarkdownPdfGeneratedLifecycleSession();
  try {
    let input: string;
    let initialSource: MarkdownPdfInteractivePreparedRenderSource | undefined;
    if (options.savedRecipe) {
      while (true) {
        input = await promptMarkdownPdfHandoffInput(
          runtime,
          pathPromptContext,
          options.savedRecipe,
        );
        const selected = selectSavedMarkdownPdfRenderSource(input, options.savedRecipe);
        const prepared = await promptAndPrepareSavedMarkdownPdfRenderSource(
          runtime,
          selected,
          options.savedRecipe,
        );
        if (prepared === "back") {
          continue;
        }
        if (prepared === "cancel") {
          return { kind: "complete" };
        }
        initialSource = prepared;
        break;
      }
    } else {
      input = await promptMarkdownPdfRenderInput(pathPromptContext);
    }

    while (true) {
      if (initialSource) {
        const prepared = initialSource;
        initialSource = undefined;
        if (
          (await handlePreparedMarkdownPdfRender(runtime, pathPromptContext, prepared)) === "done"
        ) {
          return { kind: "complete" };
        }
        continue;
      }

      const source = await collectMarkdownPdfRenderSource(runtime, pathPromptContext, input);
      if (source.kind === "back") {
        return { kind: "open-submenu", group: "md" };
      }
      if (source.kind === "cancel") {
        return { kind: "complete" };
      }
      if (source.kind === "generated") {
        const outcome = await runMarkdownPdfAuthoring(runtime, pathPromptContext, {
          codexTimeoutMs: interactiveSession.codexTimeoutMs,
          entry: "to-pdf",
          fontHintEditor: codexSession.fontHintEditor,
          markdownInput: input,
          onGeneratedLifecycle: async (selection) =>
            await handleMarkdownPdfGeneratedLifecycle(
              runtime,
              pathPromptContext,
              selection,
              generatedLifecycleSession,
            ),
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

      const prepared = await promptAndPrepareDirectMarkdownPdfRenderSource(runtime, source);
      if (prepared === "back") {
        continue;
      }
      if (prepared === "cancel") {
        return { kind: "complete" };
      }
      if (
        (await handlePreparedMarkdownPdfRender(runtime, pathPromptContext, prepared)) === "done"
      ) {
        return { kind: "complete" };
      }
    }
  } finally {
    codexSession.cancel();
  }
}
