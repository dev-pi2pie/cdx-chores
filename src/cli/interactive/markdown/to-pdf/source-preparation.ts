import { validateMdPdfProjectBundleCompleteness } from "../../../markdown-pdf/project-codex/project-bundle-completeness";
import type { CliRuntime } from "../../../types";

import type { MarkdownPdfSavedRecipe } from "../codex-types";
import {
  prepareMarkdownPdfRenderSource,
  type MarkdownPdfInteractivePreparedRenderSource,
  type MarkdownPdfInteractiveSelectedRenderSource,
} from "../render-source";
import {
  promptMarkdownPdfRenderCodeHighlightChoice,
  type MarkdownPdfRenderCodeHighlightChoice,
} from "../render-code-highlighting";
import { promptMarkdownPdfRenderPageNumberChoice } from "../render-page-numbers";
import { displayPath } from "../../../actions/shared";

export async function promptAndPrepareSavedMarkdownPdfRenderSource(
  runtime: CliRuntime,
  selected: MarkdownPdfInteractiveSelectedRenderSource,
  saved: MarkdownPdfSavedRecipe,
): Promise<MarkdownPdfInteractivePreparedRenderSource | "back" | "cancel"> {
  let currentCodeHighlight: MarkdownPdfRenderCodeHighlightChoice = "inherit";
  while (true) {
    const codeHighlight = await promptMarkdownPdfRenderCodeHighlightChoice(currentCodeHighlight);
    if (codeHighlight === "back" || codeHighlight === "cancel") {
      return codeHighlight;
    }
    currentCodeHighlight = codeHighlight;
    const pageNumbers = await promptMarkdownPdfRenderPageNumberChoice();
    if (pageNumbers === "cancel") {
      return "cancel";
    }
    if (pageNumbers === "back") {
      continue;
    }
    if (saved.artifact === "project-bundle") {
      await validateMdPdfProjectBundleCompleteness(saved.outputPath, {
        displayDirectory: displayPath(runtime, saved.outputPath),
      });
    }
    return await prepareMarkdownPdfRenderSource(runtime, selected, codeHighlight, pageNumbers);
  }
}

export async function promptAndPrepareDirectMarkdownPdfRenderSource(
  runtime: CliRuntime,
  selected: MarkdownPdfInteractiveSelectedRenderSource,
): Promise<MarkdownPdfInteractivePreparedRenderSource | "back" | "cancel"> {
  let currentCodeHighlight: MarkdownPdfRenderCodeHighlightChoice = "inherit";
  while (true) {
    const codeHighlight = await promptMarkdownPdfRenderCodeHighlightChoice(currentCodeHighlight);
    if (codeHighlight === "back" || codeHighlight === "cancel") {
      return codeHighlight;
    }
    currentCodeHighlight = codeHighlight;
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
