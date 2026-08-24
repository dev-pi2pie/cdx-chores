import { confirm } from "@inquirer/prompts";

import {
  bindResolvedMarkdownPdfRenderOutput,
  executePlannedMarkdownPdfRender,
} from "../../../actions/markdown/to-pdf-service";
import { printMarkdownPdfRenderWarnings } from "../../../actions/markdown/render-warnings";
import { displayPath, printLine } from "../../../actions/shared";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";
import { promptMarkdownPdfRenderCodeHighlightChoice } from "../render-code-highlighting";
import { promptMarkdownPdfRenderPageNumberChoice } from "../render-page-numbers";
import {
  prepareMarkdownPdfRenderSource,
  type MarkdownPdfInteractivePreparedRenderSource,
} from "../render-source";
import { renderMarkdownPdfRecipeReview } from "../review";

import {
  promptDeclinedRenderAction,
  promptMarkdownPdfOutput,
  renderMarkdownPdfFinalReview,
  renderMarkdownPdfRendererCapabilityAssessment,
} from "./output-review";

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

export async function handlePreparedMarkdownPdfRender(
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
      printMarkdownPdfRenderWarnings(runtime, result.warnings);
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
