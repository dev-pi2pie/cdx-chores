import type { DuckDBConnection } from "@duckdb/node-api";

import { stringifyPreviewValue } from "../../data-preview/normalize";
import { CliError } from "../../errors";
import { probeDuckDbManagedExtension, type DuckDbExtensionProbe } from "../extensions";
import { createDuckDbConnection, toErrorMessage } from "./formats";
import { prepareDataQuerySource } from "./prepare-source";
import type {
  DataQueryInputFormat,
  DataQuerySourceIntrospection,
  DataQuerySourceShape,
} from "./types";

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
    const visibleRows = allRows
      .slice(0, sampleRowLimit)
      .map((row) =>
        Object.fromEntries(
          columnNames.map((column) => [column, stringifyPreviewValue(row[column])]),
        ),
      );

    return {
      columns: columnNames.map((name, index) => ({
        name,
        type: columnTypes[index]?.toString() ?? "UNKNOWN",
      })),
      selectedBodyStartRow: preparedSource.selectedBodyStartRow,
      selectedHeaderRow: preparedSource.selectedHeaderRow,
      sampleRows: visibleRows,
      selectedRange: preparedSource.selectedRange,
      selectedSource: preparedSource.selectedSource,
      truncated: allRows.length > sampleRowLimit || !reader.done,
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
