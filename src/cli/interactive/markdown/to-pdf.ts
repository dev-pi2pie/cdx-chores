import { confirm, select } from "@inquirer/prompts";

import {
  bindResolvedMarkdownPdfRenderOutput,
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
import {
  createMarkdownPdfGeneratedLifecycleSession,
  handleMarkdownPdfGeneratedLifecycle,
} from "./generated-lifecycle";
import { isRecoverableGeneratedLifecycleBindError } from "./generated-lifecycle/guards";

import {
  collectMarkdownPdfRenderSource,
  prepareMarkdownPdfRenderSource,
  promptMarkdownPdfRenderInput,
  selectSavedMarkdownPdfRenderSource,
  type MarkdownPdfInteractivePreparedRenderSource,
  type MarkdownPdfInteractiveSelectedRenderSource,
} from "./render-source";
import { renderMarkdownPdfRecipeReview } from "./review";
import { promptMarkdownPdfRenderCodeHighlightChoice } from "./render-code-highlighting";
import { promptMarkdownPdfRenderPageNumberChoice } from "./render-page-numbers";
import {
  formatEffectiveMarkdownPdfCodeReview,
  formatMarkdownPdfRenderOverrideReview,
  formatReusableMarkdownPdfCodeReview,
} from "./code-highlighting-review";
import { formatMarkdownPdfPageNumberReview } from "./page-number-review";

type MarkdownPdfOutputSelection =
  | { kind: "plan"; plan: PlannedMarkdownPdfRender }
  | { kind: "change-code-highlighting" }
  | { kind: "change-page-numbers" }
  | { kind: "change-source" }
  | { kind: "cancel" };

async function promptMarkdownPdfOutput(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  selection: MarkdownPdfInteractivePreparedRenderSource,
): Promise<MarkdownPdfOutputSelection> {
  while (true) {
    const defaultHint = formatDefaultOutputPathHint(runtime, selection.prepared.inputPath, ".pdf");
    const destination = await select<
      | "default"
      | "custom"
      | "change-code-highlighting"
      | "change-page-numbers"
      | "change-source"
      | "cancel"
    >({
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
        {
          name: "Change code highlighting",
          value: "change-code-highlighting",
        },
        ...(selection.pageNumbers === undefined
          ? []
          : [{ name: "Change page numbers", value: "change-page-numbers" as const }]),
        { name: "Change recipe source", value: "change-source" },
        { name: "Cancel", value: "cancel" },
      ],
    });
    if (
      destination === "change-code-highlighting" ||
      destination === "change-page-numbers" ||
      destination === "change-source" ||
      destination === "cancel"
    ) {
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
  if (selection.prepared.resolvedInputs.profile) {
    printLine(runtime.stderr, "");
    for (const line of formatReusableMarkdownPdfCodeReview(
      selection.prepared.normalizedProfile.code,
    )) {
      printLine(runtime.stderr, line);
    }
  }
  printLine(runtime.stderr, "");
  for (const line of formatMarkdownPdfRenderOverrideReview(selection.codeHighlight)) {
    printLine(runtime.stderr, line);
  }
  printLine(runtime.stderr, "");
  for (const line of formatEffectiveMarkdownPdfCodeReview(selection.prepared.code)) {
    printLine(runtime.stderr, line);
  }
  if (selection.pageNumbers !== undefined) {
    printLine(runtime.stderr, "");
    for (const line of formatMarkdownPdfPageNumberReview(selection.prepared)) {
      printLine(runtime.stderr, line);
    }
  }
}

async function promptDeclinedRenderAction(
  pageNumberChangeAvailable: boolean,
): Promise<
  "change-output" | "change-code-highlighting" | "change-page-numbers" | "change-source" | "cancel"
> {
  return await select<
    | "change-output"
    | "change-code-highlighting"
    | "change-page-numbers"
    | "change-source"
    | "cancel"
  >({
    message: "Final render next step",
    choices: [
      { name: "Change PDF output", value: "change-output" },
      { name: "Change code highlighting", value: "change-code-highlighting" },
      ...(pageNumberChangeAvailable
        ? [{ name: "Change page numbers", value: "change-page-numbers" as const }]
        : []),
      { name: "Change recipe source", value: "change-source" },
      { name: "Cancel", value: "cancel" },
    ],
  });
}

type PreparedRenderOutcome = "change-source" | "done";

async function changePreparedMarkdownPdfCodeHighlighting(
  runtime: CliRuntime,
  source: MarkdownPdfInteractivePreparedRenderSource,
): Promise<MarkdownPdfInteractivePreparedRenderSource | "back" | "cancel"> {
  const choice = await promptMarkdownPdfRenderCodeHighlightChoice(source.codeHighlight);
  if (choice === "back" || choice === "cancel") {
    return choice;
  }
  if (choice === source.codeHighlight) {
    return source;
  }
  return await prepareMarkdownPdfRenderSource(runtime, source.selected, choice, source.pageNumbers);
}

async function changePreparedMarkdownPdfPageNumbers(
  runtime: CliRuntime,
  source: MarkdownPdfInteractivePreparedRenderSource,
): Promise<MarkdownPdfInteractivePreparedRenderSource | "back" | "cancel"> {
  if (source.pageNumbers === undefined) {
    return source;
  }
  const choice = await promptMarkdownPdfRenderPageNumberChoice(source.pageNumbers);
  if (choice === "back" || choice === "cancel") {
    return choice;
  }
  if (choice === source.pageNumbers) {
    return source;
  }
  return await prepareMarkdownPdfRenderSource(
    runtime,
    source.selected,
    source.codeHighlight,
    choice,
  );
}

function renderMarkdownPdfRendererCapabilityAssessment(
  runtime: CliRuntime,
  assessment: Awaited<ReturnType<typeof executePlannedMarkdownPdfRender>>["rendererCapabilities"],
  requests: MarkdownPdfInteractivePreparedRenderSource["prepared"]["rendererCapabilityRequests"],
): void {
  const requestedCapabilityIds = new Set(requests.map((request) => request.capabilityId));
  const capabilities = assessment.capabilities.filter((capability) =>
    requestedCapabilityIds.has(capability.id),
  );
  if (capabilities.length === 0) {
    return;
  }
  printLine(runtime.stderr, "Markdown PDF renderer capability assessment:");
  const rendererStatus =
    assessment.renderer.available === true
      ? `installed (${assessment.renderer.version ?? "unknown version"})`
      : assessment.renderer.available === false
        ? "missing"
        : "unverified";
  printLine(runtime.stderr, `- ${assessment.renderer.name}: ${rendererStatus}`);
  for (const capability of capabilities) {
    const diagnostic = capability.diagnosticConditionId
      ? `, diagnostic=${capability.diagnosticConditionId}`
      : "";
    printLine(
      runtime.stderr,
      `- ${capability.id}: ${capability.status}, minimum=${capability.minimumVersion}${diagnostic}`,
    );
  }
}

async function handlePreparedMarkdownPdfRender(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  initialSource: MarkdownPdfInteractivePreparedRenderSource,
): Promise<PreparedRenderOutcome> {
  let source = initialSource;
  while (true) {
    renderMarkdownPdfRecipeReview(runtime, source);
    const output = await promptMarkdownPdfOutput(runtime, pathPromptContext, source);
    if (output.kind === "cancel") {
      return "done";
    }
    if (output.kind === "change-source") {
      return "change-source";
    }
    if (output.kind === "change-code-highlighting") {
      const changed = await changePreparedMarkdownPdfCodeHighlighting(runtime, source);
      if (changed === "cancel") {
        return "done";
      }
      if (changed !== "back") {
        source = changed;
      }
      continue;
    }
    if (output.kind === "change-page-numbers") {
      const changed = await changePreparedMarkdownPdfPageNumbers(runtime, source);
      if (changed === "cancel") {
        return "done";
      }
      if (changed !== "back") {
        source = changed;
      }
      continue;
    }

    let plan = output.plan;
    while (true) {
      renderMarkdownPdfFinalReview(runtime, source, plan);
      if (!(await confirm({ message: "Render this PDF?", default: true }))) {
        const next = await promptDeclinedRenderAction(source.pageNumbers !== undefined);
        if (next === "cancel") {
          return "done";
        }
        if (next === "change-source") {
          return "change-source";
        }
        if (next === "change-code-highlighting") {
          const changed = await changePreparedMarkdownPdfCodeHighlighting(runtime, source);
          if (changed === "cancel") {
            return "done";
          }
          if (changed === "back") {
            continue;
          }
          source = changed;
          plan = bindResolvedMarkdownPdfRenderOutput(source.prepared, {
            htmlOutputPath: plan.htmlOutputPath,
            outputPath: plan.outputPath,
            overwrite: plan.overwrite,
          });
          continue;
        }
        if (next === "change-page-numbers") {
          const changed = await changePreparedMarkdownPdfPageNumbers(runtime, source);
          if (changed === "cancel") {
            return "done";
          }
          if (changed === "back") {
            continue;
          }
          source = changed;
          plan = bindResolvedMarkdownPdfRenderOutput(source.prepared, {
            htmlOutputPath: plan.htmlOutputPath,
            outputPath: plan.outputPath,
            overwrite: plan.overwrite,
          });
          continue;
        }
        break;
      }

      const result = await executePlannedMarkdownPdfRender(runtime, plan);
      if (result.warnings.length > 0) {
        printLine(runtime.stderr, "Markdown PDF render warnings:");
        for (const warning of result.warnings) {
          printLine(runtime.stderr, `- ${warning}`);
        }
      }
      renderMarkdownPdfRendererCapabilityAssessment(
        runtime,
        result.rendererCapabilities,
        source.prepared.rendererCapabilityRequests,
      );
      printLine(runtime.stdout, `Wrote PDF: ${displayPath(runtime, plan.outputPath)}`);
      return "done";
    }
  }
}

async function promptAndPrepareMarkdownPdfRenderSource(
  runtime: CliRuntime,
  selected: MarkdownPdfInteractiveSelectedRenderSource,
): Promise<MarkdownPdfInteractivePreparedRenderSource | "back" | "cancel"> {
  const choice = await promptMarkdownPdfRenderCodeHighlightChoice();
  if (choice === "back" || choice === "cancel") {
    return choice;
  }
  return await prepareMarkdownPdfRenderSource(runtime, selected, choice);
}

async function promptAndPrepareDirectMarkdownPdfRenderSource(
  runtime: CliRuntime,
  selected: MarkdownPdfInteractiveSelectedRenderSource,
): Promise<MarkdownPdfInteractivePreparedRenderSource | "back" | "cancel"> {
  while (true) {
    const codeHighlight = await promptMarkdownPdfRenderCodeHighlightChoice();
    if (codeHighlight === "back" || codeHighlight === "cancel") {
      return codeHighlight;
    }
    const pageNumbers = await promptMarkdownPdfRenderPageNumberChoice();
    if (pageNumbers === "cancel") {
      return "cancel";
    }
    if (pageNumbers === "back") {
      continue;
    }
    return await prepareMarkdownPdfRenderSource(runtime, selected, codeHighlight, pageNumbers);
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
        const prepared = await promptAndPrepareMarkdownPdfRenderSource(runtime, selected);
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
          entry: "to-pdf",
          fontHintEditor: session.fontHintEditor,
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
    session.cancel();
  }
}
