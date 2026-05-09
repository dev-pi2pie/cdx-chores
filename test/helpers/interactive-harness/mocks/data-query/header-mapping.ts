import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../../context";
import { dataQueryHeaderMappingModuleUrl } from "../../module-urls";
import type { HeaderSuggestionOptions } from "./types";

export function installDataQueryHeaderMappingMock(context: HarnessRunnerContext): void {
  mock.module(dataQueryHeaderMappingModuleUrl, () => ({
    normalizeHeaderMappingTargetName: (value: unknown) =>
      String(value ?? "")
        .trim()
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_")
        .toLowerCase(),
    normalizeAndValidateAcceptedHeaderMappings: ({
      availableColumns,
      mappings,
    }: {
      availableColumns?: unknown[];
      mappings?: Array<Record<string, unknown>>;
    }) =>
      (mappings ?? [])
        .map((mapping) => ({
          ...mapping,
          from: String(mapping.from ?? "").trim() || String(availableColumns?.[0] ?? "column_1"),
          to: String(mapping.to ?? "").trim() || "edited_header",
        }))
        .filter((mapping) => mapping.to !== mapping.from),
    suggestDataHeaderMappingsWithCodex: async (options: HeaderSuggestionOptions) => {
      context.recordAction("data:query:header-suggest", {
        format: options.format,
        ...(options.introspection?.selectedHeaderRow !== undefined
          ? { selectedHeaderRow: options.introspection.selectedHeaderRow }
          : {}),
        ...(options.introspection?.selectedRange
          ? { selectedRange: options.introspection.selectedRange }
          : {}),
        selectedSource: options.introspection?.selectedSource,
      });

      if (context.scenario.dataQueryHeaderSuggestionErrorMessage) {
        return {
          errorMessage: context.scenario.dataQueryHeaderSuggestionErrorMessage,
          mappings: [],
        };
      }

      return {
        mappings: context.scenario.dataQueryHeaderSuggestions ?? [
          { from: "column_1", to: "id", sample: "1", inferredType: "BIGINT" },
          {
            from: "column_2",
            to: "name",
            sample: "Ada",
            inferredType: "VARCHAR",
          },
        ],
      };
    },
  }));
}
