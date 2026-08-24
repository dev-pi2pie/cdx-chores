import type { HarnessRunnerContext } from "./context";
import { installDataExtractIntrospectionMocks } from "../../data-extract/interactive/mock-installation";
import { installDataQueryMocks } from "../../data-query/interactive/mock-installation";
import { installMarkdownPdfMocks } from "../../markdown-pdf/interactive/mock-action";
import { installActionMocks } from "./action-mocks";
import { installFsPromiseMocks } from "./fs-mock";
import { installPathPromptMocks } from "./path-prompt-mocks";
import { installPromptMocks } from "./prompt-mocks";

function hasInteractiveDataCommand(
  context: HarnessRunnerContext,
  command: "data:extract" | "data:query",
): boolean {
  return context.scenario.selectQueue?.includes(command) ?? false;
}

function needsDataMocks(context: HarnessRunnerContext): boolean {
  return Boolean(
    context.scenario.dataQueryMocks ||
    context.scenario.dataQueryActionErrorMessage ||
    context.scenario.dataQueryActionErrorCode ||
    typeof context.scenario.dataQueryActionStderr === "string" ||
    typeof context.scenario.dataQueryActionStdout === "string" ||
    context.scenario.dataQueryCodexDraft ||
    context.scenario.dataQueryCodexErrorMessage ||
    context.scenario.dataQueryDetectedFormat ||
    context.scenario.dataQueryHeaderSuggestionErrorMessage ||
    context.scenario.dataQueryHeaderSuggestions ||
    context.scenario.dataQueryIntrospection ||
    context.scenario.dataQueryIntrospectionQueue ||
    context.scenario.dataQueryWorkspaceIntrospection ||
    context.scenario.dataQueryWorkspaceIntrospectionQueue ||
    context.scenario.dataSourceShapeSuggestion ||
    context.scenario.dataSourceShapeSuggestionErrorMessage ||
    context.scenario.dataQuerySources ||
    context.scenario.xlsxSheetSnapshot,
  );
}

export function installHarnessMocks(context: HarnessRunnerContext): void {
  installPromptMocks(context);
  installFsPromiseMocks(context);
  installActionMocks(context);
  installPathPromptMocks(context);
  if (context.scenario.markdownPdfMocks) {
    installMarkdownPdfMocks(context);
  }
  if (needsDataMocks(context)) {
    if (hasInteractiveDataCommand(context, "data:extract")) {
      installDataExtractIntrospectionMocks(context);
    }
    if (
      hasInteractiveDataCommand(context, "data:query") ||
      context.scenario.dataQueryMocks === true
    ) {
      installDataQueryMocks(context);
    }
  }
}
