import type { HarnessRunnerContext } from "../../helpers/interactive-harness/context";
import { installDataQueryCodexMock } from "./mock-codex";
import { installDataQueryHeaderMappingMock } from "./mock-header-mapping";
import { installDataQueryMock } from "./mock-query";
import { installDataQuerySourceShapeMocks } from "./mock-source-shape";

function needsCodexMocks(context: HarnessRunnerContext): boolean {
  return Boolean(
    context.scenario.dataQueryCodexDraft ||
    context.scenario.dataQueryCodexErrorMessage ||
    context.scenario.editorQueue?.length,
  );
}

function needsHeaderMappingMocks(context: HarnessRunnerContext): boolean {
  return Boolean(
    context.scenario.dataQueryHeaderSuggestions ||
    context.scenario.dataQueryHeaderSuggestionErrorMessage,
  );
}

function needsSourceShapeMocks(context: HarnessRunnerContext): boolean {
  return Boolean(
    context.scenario.dataSourceShapeSuggestion ||
    context.scenario.dataSourceShapeSuggestionErrorMessage ||
    context.scenario.xlsxSheetSnapshot ||
    context.scenario.dataQueryDetectedFormat === "excel",
  );
}

export function installDataQueryMocks(context: HarnessRunnerContext): void {
  installDataQueryMock(context);
  if (needsSourceShapeMocks(context)) {
    installDataQuerySourceShapeMocks(context);
  }
  if (needsCodexMocks(context)) {
    installDataQueryCodexMock(context);
  }
  if (needsHeaderMappingMocks(context)) {
    installDataQueryHeaderMappingMock(context);
  }
}
