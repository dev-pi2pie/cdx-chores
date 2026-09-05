import type { HarnessRunnerContext } from "../../cli-foundations/interactive-harness/context";
import { installDataExtractIntrospectionMock } from "./mock-introspection";
import { installDataExtractSourceShapeMocks } from "./mock-source-shape";
import { installDataQueryHeaderMappingMock } from "../../data-query/interactive/mock-header-mapping";

function needsSourceShapeMocks(context: HarnessRunnerContext): boolean {
  return Boolean(
    context.scenario.dataSourceShapeSuggestion ||
    context.scenario.dataSourceShapeSuggestionErrorMessage ||
    context.scenario.xlsxSheetSnapshot ||
    context.scenario.dataQueryDetectedFormat === "excel",
  );
}

export function installDataExtractIntrospectionMocks(context: HarnessRunnerContext): void {
  installDataExtractIntrospectionMock(context);
  if (
    context.scenario.dataQueryHeaderSuggestions ||
    context.scenario.dataQueryHeaderSuggestionErrorMessage
  ) {
    installDataQueryHeaderMappingMock(context);
  }
  if (needsSourceShapeMocks(context)) {
    installDataExtractSourceShapeMocks(context);
  }
}
