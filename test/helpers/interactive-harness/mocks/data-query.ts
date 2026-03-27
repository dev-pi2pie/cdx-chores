import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../context";
import {
  dataQueryCodexModuleUrl,
  dataQueryHeaderMappingModuleUrl,
  duckdbQueryModuleUrl,
  sourceShapeModuleUrl,
  xlsxSourcesModuleUrl,
} from "../module-urls";

interface DataQueryIntrospectionColumn {
  name: string;
  type: string;
}

interface DataQueryIntrospection {
  columns?: DataQueryIntrospectionColumn[];
  sampleRows?: Record<string, unknown>[];
  selectedBodyStartRow?: unknown;
  selectedHeaderRow?: unknown;
  selectedRange?: unknown;
  selectedSource?: unknown;
  truncated?: boolean;
}

interface DataQueryCodexDraftOptions {
  format?: unknown;
  intent?: unknown;
  introspection?: {
    selectedHeaderRow?: unknown;
    selectedRange?: unknown;
    selectedSource?: unknown;
  };
}

interface HeaderSuggestionOptions {
  format?: unknown;
  introspection?: {
    selectedHeaderRow?: unknown;
    selectedRange?: unknown;
    selectedSource?: unknown;
  };
}

interface SourceShapeSuggestionOptions {
  currentHeaderRow?: unknown;
  currentRange?: unknown;
  context?: {
    currentIntrospection?: { selectedSource?: unknown };
    sheetSnapshot?: { sheetName?: unknown };
  };
}

function getScenarioIntrospection(
  context: HarnessRunnerContext,
  shape: { bodyStartRow?: unknown; headerRow?: unknown; range?: unknown; source?: unknown },
): Record<string, unknown> {
  const nextIntrospection = context.scenario.dataQueryIntrospectionQueue?.shift();
  if (nextIntrospection) {
    return nextIntrospection;
  }

  if (context.scenario.dataQueryIntrospection) {
    return context.scenario.dataQueryIntrospection;
  }

  return {
    columns: [
      { name: "id", type: "BIGINT" },
      { name: "name", type: "VARCHAR" },
      { name: "status", type: "VARCHAR" },
    ],
    sampleRows: [
      { id: "1", name: "Ada", status: "active" },
      { id: "2", name: "Bob", status: "inactive" },
    ],
    selectedBodyStartRow: shape.bodyStartRow,
    selectedHeaderRow: shape.headerRow,
    selectedRange: shape.range,
    selectedSource: shape.source,
    truncated: false,
  };
}

function buildCodexTemplate(options: {
  format?: unknown;
  introspection?: DataQueryIntrospection;
  intent?: unknown;
}): string {
  const schema =
    Array.isArray(options.introspection?.columns) && options.introspection.columns.length > 0
      ? options.introspection.columns
          .slice(0, 8)
          .map((column) => `${column.name} (${column.type})`)
          .join(", ")
      : "(no columns available)";
  const sampleRows = Array.isArray(options.introspection?.sampleRows)
    ? options.introspection.sampleRows.slice(0, 3)
    : [];

  return [
    "# Query context for Codex drafting.",
    "# Logical table: file",
    `# Format: ${String(options.format ?? "")}`,
    ...(options.introspection?.selectedSource
      ? [`# Source: ${String(options.introspection.selectedSource)}`]
      : []),
    ...(options.introspection?.selectedRange
      ? [`# Range: ${String(options.introspection.selectedRange)}`]
      : []),
    ...(options.introspection?.selectedHeaderRow !== undefined
      ? [`# Header row: ${String(options.introspection.selectedHeaderRow)}`]
      : []),
    `# Schema: ${schema}`,
    "# Sample rows:",
    ...(sampleRows.length > 0
      ? sampleRows.map((row, index) => `# ${index + 1}. ${JSON.stringify(row)}`)
      : ["# (no sample rows available)"]),
    "#",
    "# Write plain intent below. Comment lines starting with # are ignored.",
    "",
    String(options.intent ?? "").trim(),
  ].join("\n");
}

export function installDataQueryMocks(context: HarnessRunnerContext): void {
  mock.module(duckdbQueryModuleUrl, () => ({
    DATA_QUERY_INPUT_FORMAT_VALUES: ["csv", "tsv", "parquet", "sqlite", "excel"],
    normalizeExcelBodyStartRow: (value: unknown) => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--body-start-row must be a positive integer.");
      }
      return parsed;
    },
    normalizeExcelHeaderRow: (value: unknown) => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--header-row must be a positive integer.");
      }
      return parsed;
    },
    normalizeExcelRange: (value: unknown) =>
      String(value ?? "")
        .trim()
        .toUpperCase(),
    quoteSqlIdentifier: (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`,
    createDuckDbConnection: async () => ({
      closeSync() {},
    }),
    detectDataQueryInputFormat: () => context.scenario.dataQueryDetectedFormat ?? "csv",
    listDataQuerySources: async () => context.scenario.dataQuerySources,
    collectDataQuerySourceIntrospection: async (
      _connection: unknown,
      _input: unknown,
      _format: unknown,
      shape: {
        bodyStartRow?: unknown;
        headerRow?: unknown;
        range?: unknown;
        source?: unknown;
      },
    ) => getScenarioIntrospection(context, shape),
  }));

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

  mock.module(dataQueryCodexModuleUrl, () => ({
    normalizeDataQueryCodexIntent: (value: unknown) =>
      String(value ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(" ")
        .trim(),
    normalizeDataQueryCodexEditorIntent: (value: unknown) =>
      String(value ?? "")
        .split(/\r?\n/)
        .filter((line) => !line.trimStart().startsWith("#"))
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(" ")
        .trim(),
    buildDataQueryCodexIntentEditorTemplate: buildCodexTemplate,
    draftDataQueryWithCodex: async (options: DataQueryCodexDraftOptions) => {
      context.recordAction("data:query:codex-draft", {
        format: options.format,
        intent: options.intent,
        ...(options.introspection?.selectedHeaderRow !== undefined
          ? { selectedHeaderRow: options.introspection.selectedHeaderRow }
          : {}),
        ...(options.introspection?.selectedRange
          ? { selectedRange: options.introspection.selectedRange }
          : {}),
        selectedSource: options.introspection?.selectedSource,
      });

      if (context.scenario.dataQueryCodexErrorMessage) {
        return { errorMessage: context.scenario.dataQueryCodexErrorMessage };
      }

      return {
        draft: context.scenario.dataQueryCodexDraft ?? {
          sql: "select count(*) as total from file",
          reasoningSummary: "Counts rows from the selected source.",
        },
      };
    },
  }));

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
