import type { HarnessRunnerContext } from "../../context";
import { installDataQueryCodexMock } from "./codex";
import { installDataQueryHeaderMappingMock } from "./header-mapping";
import { installDuckDbQueryMock } from "./query";
import { installDataQuerySourceShapeMocks } from "./source-shape";

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
  installDuckDbQueryMock(context);
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
