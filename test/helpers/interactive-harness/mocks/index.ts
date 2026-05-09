import type { HarnessRunnerContext } from "../context";
import { installActionMocks } from "./actions";
import { installDataQueryMocks } from "./data-query";
import { installFsPromiseMocks } from "./fs";
import { installPathPromptMocks } from "./path-prompts";
import { installPromptMocks } from "./prompts";

function needsDataQueryMocks(context: HarnessRunnerContext): boolean {
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
  if (needsDataQueryMocks(context)) {
    installDataQueryMocks(context);
  }
}
