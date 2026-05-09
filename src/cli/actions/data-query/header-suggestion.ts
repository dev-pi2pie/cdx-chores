import type {
  DataHeaderMappingEntry,
  DataHeaderSuggestionRunner,
} from "../../duckdb/header-mapping";
import {
  collectDataQuerySourceIntrospection,
  createDuckDbConnection,
  type DataQueryInputFormat,
} from "../../duckdb/query";
import {
  resolveReusableHeaderMappingsForDataFlow,
  runCodexHeaderSuggestionFlow,
} from "../../data-workflows/header-mapping-flow";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import type { ResolvedDataQueryShape } from "./shape-resolution";

const DATA_QUERY_HEADER_SUGGESTION_SAMPLE_ROWS = 5;

export async function resolveDataQueryHeaderMappings(options: {
  format: DataQueryInputFormat;
  headerMapping?: string;
  headerMappings?: DataHeaderMappingEntry[];
  inputPath: string;
  runtime: CliRuntime;
  shape: ResolvedDataQueryShape;
}): Promise<DataHeaderMappingEntry[] | undefined> {
  if (options.headerMappings) {
    return options.headerMappings.map((mapping) => ({ ...mapping }));
  }

  if (!options.headerMapping?.trim()) {
    return undefined;
  }

  return resolveReusableHeaderMappingsForDataFlow({
    format: options.format,
    headerMappingPath: resolveFromCwd(options.runtime, options.headerMapping.trim()),
    inputPath: options.inputPath,
    runtime: options.runtime,
    shape: {
      ...(options.shape.bodyStartRow !== undefined
        ? { bodyStartRow: options.shape.bodyStartRow }
        : {}),
      ...(options.shape.headerRow !== undefined ? { headerRow: options.shape.headerRow } : {}),
      noHeader: options.shape.noHeader,
      range: options.shape.range,
      source: options.shape.source,
    },
  });
}

export async function runDataQueryHeaderSuggestion(options: {
  format: DataQueryInputFormat;
  headerSuggestionRunner?: DataHeaderSuggestionRunner;
  inputPath: string;
  installMissingExtension?: boolean;
  overwrite?: boolean;
  runtime: CliRuntime;
  shape: ResolvedDataQueryShape;
  sourceIntrospectionCollector?: typeof collectDataQuerySourceIntrospection;
  writeHeaderMapping?: string;
}): Promise<void> {
  const collectSourceIntrospection =
    options.sourceIntrospectionCollector ?? collectDataQuerySourceIntrospection;
  const connection = await createDuckDbConnection();
  try {
    await runCodexHeaderSuggestionFlow({
      runtime: options.runtime,
      format: options.format,
      inputPath: options.inputPath,
      shape: {
        ...(options.shape.bodyStartRow !== undefined
          ? { bodyStartRow: options.shape.bodyStartRow }
          : {}),
        ...(options.shape.headerRow !== undefined ? { headerRow: options.shape.headerRow } : {}),
        noHeader: options.shape.noHeader,
        range: options.shape.range,
        source: options.shape.source,
      },
      overwrite: options.overwrite,
      writeHeaderMapping: options.writeHeaderMapping,
      headerSuggestionRunner: options.headerSuggestionRunner,
      collectIntrospection: async () =>
        await collectSourceIntrospection(
          connection,
          options.inputPath,
          options.format,
          {
            ...(options.shape.bodyStartRow !== undefined
              ? { bodyStartRow: options.shape.bodyStartRow }
              : {}),
            ...(options.shape.headerRow !== undefined
              ? { headerRow: options.shape.headerRow }
              : {}),
            noHeader: options.shape.noHeader,
            range: options.shape.range,
            source: options.shape.source,
          },
          DATA_QUERY_HEADER_SUGGESTION_SAMPLE_ROWS,
          {
            installMissingExtension: options.installMissingExtension,
            statusStream: options.runtime.stderr,
          },
        ),
      failureCode: "DATA_QUERY_HEADER_SUGGESTION_FAILED",
      failurePrefix: "Codex header suggestions failed",
      reviewMessage: "Review the mapping, then rerun with --header-mapping before SQL execution.",
      followUpCommandPath: ["data", "query"],
      followUpTailArgs: ["--sql", JSON.stringify("<query>")],
    });
  } finally {
    connection.closeSync();
  }
}
