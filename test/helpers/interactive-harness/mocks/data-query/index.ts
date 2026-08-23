import type { HarnessRunnerContext } from "../../context";
import { installDataExtractIntrospectionMock } from "./query";
import { installDataExtractSourceShapeMocks } from "./source-shape";

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
  if (needsSourceShapeMocks(context)) {
    installDataExtractSourceShapeMocks(context);
  }
}
