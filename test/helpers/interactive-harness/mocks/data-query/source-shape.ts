import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../../context";
import { sourceShapeModuleUrl, xlsxSourcesModuleUrl } from "../../module-urls";
import type { SourceShapeSuggestionOptions } from "./types";

export function installDataQuerySourceShapeMocks(context: HarnessRunnerContext): void {
  mock.module(xlsxSourcesModuleUrl, () => ({
    collectXlsxSheetSnapshot: async (_inputPath: unknown, sheetName: unknown) => ({
      mergedRanges: [],
      mergedRangesTruncated: false,
      nonEmptyCellCount: 6,
      nonEmptyRowCount: 3,
      rows: [
        {
          rowNumber: 1,
          cellCount: 2,
          firstRef: "A1",
          lastRef: "B1",
          cells: [
            { ref: "A1", value: "id" },
            { ref: "B1", value: "name" },
          ],
        },
        {
          rowNumber: 2,
          cellCount: 2,
          firstRef: "A2",
          lastRef: "B2",
          cells: [
            { ref: "A2", value: "1" },
            { ref: "B2", value: "Ada" },
          ],
        },
      ],
      rowsTruncated: false,
      sheetName: String(sheetName ?? "Summary"),
      usedRange: "A1:B3",
      ...context.scenario.xlsxSheetSnapshot,
    }),
  }));

  mock.module(sourceShapeModuleUrl, () => ({
    suggestDataSourceShapeWithCodex: async (options: SourceShapeSuggestionOptions) => {
      context.recordAction("data:source-shape-suggest", {
        ...(options.currentHeaderRow !== undefined
          ? { currentHeaderRow: options.currentHeaderRow }
          : {}),
        ...(options.currentRange ? { currentRange: options.currentRange } : {}),
        selectedSource: options.context?.currentIntrospection?.selectedSource,
        sheetName: options.context?.sheetSnapshot?.sheetName,
      });

      if (context.scenario.dataSourceShapeSuggestionErrorMessage) {
        return {
          errorMessage: context.scenario.dataSourceShapeSuggestionErrorMessage,
        };
      }

      return (
        context.scenario.dataSourceShapeSuggestion ?? {
          reasoningSummary: "The table starts at A1 and spans two columns.",
          shape: {
            range: "A1:B3",
          },
        }
      );
    },
  }));
}
