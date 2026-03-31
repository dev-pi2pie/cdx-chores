import type { DuckDBConnection } from "@duckdb/node-api";

import { stringifyPreviewValue } from "../../data-preview/normalize";
import { CliError } from "../../errors";
import { probeDuckDbManagedExtension, type DuckDbExtensionProbe } from "../extensions";
import { createDuckDbConnection, toErrorMessage } from "./formats";
import { prepareDataQuerySource } from "./prepare-source";
import { prepareDataQueryWorkspace } from "./prepare-workspace";
import { quoteSqlIdentifier } from "./formats";
import type {
  DataQueryInputFormat,
  DataQueryRelationBinding,
  DataQuerySourceIntrospection,
  DataQuerySourceShape,
  DataQueryWorkspaceIntrospection,
} from "./types";

function buildPreviewPayload(options: {
  columnNames: string[];
  columnTypes: Array<{ toString(): string } | undefined>;
  rows: Array<Record<string, unknown>>;
  sampleRowLimit: number;
  readerDone: boolean;
}) {
  const visibleRows = options.rows
    .slice(0, options.sampleRowLimit)
    .map((row) =>
      Object.fromEntries(
        options.columnNames.map((column) => [column, stringifyPreviewValue(row[column])]),
      ),
    );

  return {
    columns: options.columnNames.map((name, index) => ({
      name,
      type: options.columnTypes[index]?.toString() ?? "UNKNOWN",
    })),
    sampleRows: visibleRows,
    truncated: options.rows.length > options.sampleRowLimit || !options.readerDone,
  };
}

export async function collectDataQuerySourceIntrospection(
  connection: DuckDBConnection,
  inputPath: string,
  format: DataQueryInputFormat,
  shape: DataQuerySourceShape,
  sampleRowLimit: number,
  options: {
    installMissingExtension?: boolean;
    statusStream?: NodeJS.WritableStream;
  } = {},
): Promise<DataQuerySourceIntrospection> {
  const preparedSource = await prepareDataQuerySource(connection, inputPath, format, shape, {
    installMissingExtension: options.installMissingExtension,
    statusStream: options.statusStream,
  });

  try {
    const reader = await connection.streamAndReadUntil("select * from file", sampleRowLimit + 1);
    if (reader.columnCount === 0) {
      throw new CliError("data query requires a SQL statement that returns rows.", {
        code: "INVALID_INPUT",
        exitCode: 2,
      });
    }

    const columnNames = reader.deduplicatedColumnNames();
    const columnTypes = reader.columnTypes();
    const allRows = reader.getRowObjectsJson() as Array<Record<string, unknown>>;
    const preview = buildPreviewPayload({
      columnNames,
      columnTypes,
      rows: allRows,
      sampleRowLimit,
      readerDone: reader.done,
    });

    return {
      ...preview,
      kind: "single-source",
      selectedBodyStartRow: preparedSource.selectedBodyStartRow,
      selectedHeaderRow: preparedSource.selectedHeaderRow,
      selectedRange: preparedSource.selectedRange,
      selectedSource: preparedSource.selectedSource,
    };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(`Failed to inspect ${format} query input: ${toErrorMessage(error)}`, {
      code: "DATA_QUERY_SOURCE_FAILED",
      exitCode: 2,
    });
  }
}

export async function collectDataQueryWorkspaceIntrospection(
  connection: DuckDBConnection,
  inputPath: string,
  format: DataQueryInputFormat,
  relations: readonly DataQueryRelationBinding[],
  sampleRowLimit: number,
  options: {
    installMissingExtension?: boolean;
    statusStream?: NodeJS.WritableStream;
  } = {},
): Promise<DataQueryWorkspaceIntrospection> {
  const preparedWorkspace = await prepareDataQueryWorkspace(
    connection,
    inputPath,
    format,
    relations,
    {
      installMissingExtension: options.installMissingExtension,
      statusStream: options.statusStream,
    },
  );

  try {
    const inspectedRelations = [];
    for (const relation of relations) {
      const reader = await connection.streamAndReadUntil(
        `select * from ${quoteSqlIdentifier(relation.alias)}`,
        sampleRowLimit + 1,
      );
      if (reader.columnCount === 0) {
        throw new CliError("data query requires a SQL statement that returns rows.", {
          code: "INVALID_INPUT",
          exitCode: 2,
        });
      }

      const columnNames = reader.deduplicatedColumnNames();
      const columnTypes = reader.columnTypes();
      const allRows = reader.getRowObjectsJson() as Array<Record<string, unknown>>;
      const preview = buildPreviewPayload({
        columnNames,
        columnTypes,
        rows: allRows,
        sampleRowLimit,
        readerDone: reader.done,
      });

      inspectedRelations.push({
        alias: relation.alias,
        columns: preview.columns,
        sampleRows: preview.sampleRows,
        source: relation.source,
        truncated: preview.truncated,
      });
    }

    return {
      kind: "workspace",
      relations:
        preparedWorkspace.relationAliases?.map((alias) => {
          const relation = inspectedRelations.find((entry) => entry.alias === alias);
          if (!relation) {
            throw new CliError(`Missing workspace introspection for relation ${alias}.`, {
              code: "DATA_QUERY_SOURCE_FAILED",
              exitCode: 2,
            });
          }
          return relation;
        }) ?? inspectedRelations,
    };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError(`Failed to inspect ${format} query input: ${toErrorMessage(error)}`, {
      code: "DATA_QUERY_SOURCE_FAILED",
      exitCode: 2,
    });
  }
}

export async function inspectDataQueryExtensions(): Promise<{
  available: boolean;
  detail?: string;
  runtimeVersion?: string;
  excel?: DuckDbExtensionProbe;
  sqlite?: DuckDbExtensionProbe;
}> {
  let connection: DuckDBConnection | undefined;
  try {
    connection = await createDuckDbConnection();
    const excel = await probeDuckDbManagedExtension(connection, "excel");
    const sqlite = await probeDuckDbManagedExtension(connection, "sqlite");
    return {
      available: true,
      excel,
      runtimeVersion: excel.runtimeVersion,
      sqlite,
    };
  } catch (error) {
    return {
      available: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    connection?.closeSync();
  }
}
