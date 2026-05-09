import { mock } from "bun:test";

import { getMultiObjectSourceDisplayLabel } from "../../../../../src/cli/duckdb/query";
import type { HarnessRunnerContext } from "../../context";
import { duckdbQueryModuleUrl } from "../../module-urls";
import { getScenarioWorkspaceIntrospection } from "./workspace";

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

export function installDuckDbQueryMock(context: HarnessRunnerContext): void {
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
    getMultiObjectSourceDisplayLabel,
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
}
