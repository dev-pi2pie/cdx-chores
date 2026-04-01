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
  introspection?:
    | {
        selectedHeaderRow?: unknown;
        selectedRange?: unknown;
        selectedSource?: unknown;
      }
    | {
        kind?: unknown;
        relations?: Array<{ alias?: unknown; source?: unknown }>;
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

interface DataQueryWorkspaceRelationScenario {
  alias?: unknown;
  columns?: DataQueryIntrospectionColumn[];
  sampleRows?: Record<string, unknown>[];
  source?: unknown;
  truncated?: boolean;
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

function buildDefaultWorkspaceRelation(relation: {
  alias?: unknown;
  source?: unknown;
}): DataQueryWorkspaceRelationScenario {
  const alias = String(relation.alias ?? "");
  const source = String(relation.source ?? "");
  const key = `${alias}:${source}`.toLowerCase();

  if (key.includes("entry")) {
    return {
      alias,
      columns: [
        { name: "entry_id", type: "BIGINT" },
        { name: "hours", type: "DOUBLE" },
      ],
      sampleRows: [{ entry_id: "1", hours: "7.5" }],
      source,
      truncated: false,
    };
  }

  if (key.includes("active")) {
    return {
      alias,
      columns: [
        { name: "id", type: "BIGINT" },
        { name: "name", type: "VARCHAR" },
        { name: "is_active", type: "BOOLEAN" },
      ],
      sampleRows: [{ id: "1", name: "Ada", is_active: "true" }],
      source,
      truncated: false,
    };
  }

  return {
    alias,
    columns: [
      { name: "id", type: "BIGINT" },
      { name: "name", type: "VARCHAR" },
    ],
    sampleRows: [{ id: "1", name: "Ada" }],
    source,
    truncated: false,
  };
}

function getScenarioWorkspaceIntrospection(
  context: HarnessRunnerContext,
  relations: Array<{ alias?: unknown; source?: unknown }>,
): Record<string, unknown> {
  const nextIntrospection = context.scenario.dataQueryWorkspaceIntrospectionQueue?.shift();
  if (nextIntrospection) {
    return nextIntrospection;
  }

  const configuredRelations = Array.isArray(
    context.scenario.dataQueryWorkspaceIntrospection?.relations,
  )
    ? (context.scenario.dataQueryWorkspaceIntrospection
        ?.relations as DataQueryWorkspaceRelationScenario[])
    : [];

  return {
    kind: "workspace",
    relations: relations.map((relation, index) => {
      const configured = configuredRelations[index];
      const fallback = buildDefaultWorkspaceRelation(relation);
      return {
        alias: String(configured?.alias ?? relation.alias ?? ""),
        columns: configured?.columns ?? fallback.columns ?? [],
        sampleRows: configured?.sampleRows ?? fallback.sampleRows ?? [],
        source: String(configured?.source ?? relation.source ?? ""),
        truncated: Boolean(configured?.truncated ?? fallback.truncated),
      };
    }),
  };
}

function buildCodexTemplate(options: {
  format?: unknown;
  introspection?:
    | DataQueryIntrospection
    | { kind?: unknown; relations?: Array<Record<string, unknown>> };
  intent?: unknown;
}): string {
  if (
    typeof options.introspection === "object" &&
    options.introspection !== null &&
    (options.introspection as { kind?: unknown }).kind === "workspace"
  ) {
    const relations = Array.isArray((options.introspection as { relations?: unknown[] }).relations)
      ? ((options.introspection as { relations?: Array<Record<string, unknown>> }).relations ?? [])
      : [];
    return [
      "# Query context for Codex drafting.",
      "# Workspace relations:",
      ...relations.map(
        (relation) =>
          `# - ${String(relation.alias ?? "")} (source: ${String(relation.source ?? "")})`,
      ),
      `# Format: ${String(options.format ?? "")}`,
      `# Schema: ${relations
        .map((relation) => {
          const columns = Array.isArray(relation.columns)
            ? relation.columns.map(
                (column) => `${String(column.name ?? "")} (${String(column.type ?? "")})`,
              )
            : [];
          return `${String(relation.alias ?? "")}: ${columns.length > 0 ? columns.join(", ") : "(no columns available)"}`;
        })
        .join(" | ")}`,
      "# Sample rows:",
      ...relations.flatMap((relation) => {
        const sampleRows = Array.isArray(relation.sampleRows)
          ? relation.sampleRows.slice(0, 3)
          : [];
        return [
          `# ${String(relation.alias ?? "")}:`,
          ...(sampleRows.length > 0
            ? sampleRows.map((row, index) => `#   ${index + 1}. ${JSON.stringify(row)}`)
            : ["#   (no sample rows available)"]),
        ];
      }),
      "#",
      "# Write plain intent below. Comment lines starting with # are ignored.",
      "",
      String(options.intent ?? "").trim(),
    ].join("\n");
  }

  const singleSourceIntrospection =
    typeof options.introspection === "object" &&
    options.introspection !== null &&
    (options.introspection as { kind?: unknown }).kind !== "workspace"
      ? (options.introspection as DataQueryIntrospection)
      : undefined;
  const schema =
    Array.isArray(singleSourceIntrospection?.columns) && singleSourceIntrospection.columns.length > 0
      ? singleSourceIntrospection.columns
          .slice(0, 8)
          .map((column) => `${column.name} (${column.type})`)
          .join(", ")
      : "(no columns available)";
  const sampleRows: Record<string, unknown>[] = Array.isArray(singleSourceIntrospection?.sampleRows)
    ? singleSourceIntrospection.sampleRows.slice(0, 3)
    : [];

  return [
    "# Query context for Codex drafting.",
    "# Logical table: file",
    `# Format: ${String(options.format ?? "")}`,
    ...(singleSourceIntrospection?.selectedSource
      ? [`# Source: ${String(singleSourceIntrospection.selectedSource)}`]
      : []),
    ...(singleSourceIntrospection?.selectedRange
      ? [`# Range: ${String(singleSourceIntrospection.selectedRange)}`]
      : []),
    ...(singleSourceIntrospection?.selectedHeaderRow !== undefined
      ? [`# Header row: ${String(singleSourceIntrospection.selectedHeaderRow)}`]
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
    collectDataQueryWorkspaceIntrospection: async (
      _connection: unknown,
      _input: unknown,
      _format: unknown,
      relations: Array<{ alias?: unknown; source?: unknown }>,
    ) => getScenarioWorkspaceIntrospection(context, relations),
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
        ...(typeof options.introspection === "object" &&
        options.introspection !== null &&
        "selectedHeaderRow" in options.introspection &&
        options.introspection.selectedHeaderRow !== undefined
          ? { selectedHeaderRow: options.introspection.selectedHeaderRow }
          : {}),
        ...(typeof options.introspection === "object" &&
        options.introspection !== null &&
        "selectedRange" in options.introspection &&
        options.introspection.selectedRange
          ? { selectedRange: options.introspection.selectedRange }
          : {}),
        ...(typeof options.introspection === "object" &&
        options.introspection !== null &&
        "selectedSource" in options.introspection
          ? { selectedSource: options.introspection.selectedSource }
          : {}),
        ...(typeof options.introspection === "object" &&
        options.introspection !== null &&
        "relations" in options.introspection
          ? {
              relations: Array.isArray(options.introspection.relations)
                ? options.introspection.relations.map((relation) => ({
                    alias: relation.alias,
                    columns:
                      Array.isArray((relation as { columns?: unknown[] }).columns) &&
                      (relation as { columns?: unknown[] }).columns
                        ? (relation as { columns?: unknown[] }).columns
                        : undefined,
                    sampleRows:
                      Array.isArray((relation as { sampleRows?: unknown[] }).sampleRows) &&
                      (relation as { sampleRows?: unknown[] }).sampleRows
                        ? (relation as { sampleRows?: unknown[] }).sampleRows
                        : undefined,
                    source: relation.source,
                    truncated:
                      "truncated" in relation
                        ? (relation as { truncated?: unknown }).truncated
                        : undefined,
                  }))
                : undefined,
            }
          : {}),
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
