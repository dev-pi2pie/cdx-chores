import type { CliRuntime } from "../../types";
import {
  createMarkdownPdfInteractiveFontHintEditorSession,
  createMarkdownPdfInteractiveFontHintSuggestionService,
} from "./font-hints";

export function createMarkdownPdfInteractiveCodexSession(runtime: CliRuntime) {
  const suggestions = createMarkdownPdfInteractiveFontHintSuggestionService(runtime);
  const fontHintEditor = createMarkdownPdfInteractiveFontHintEditorSession(suggestions);
  return {
    cancel: () => fontHintEditor.cancel(),
    fontHintEditor,
  };
}
