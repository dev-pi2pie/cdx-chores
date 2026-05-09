import type { DataHeaderMappingEntry } from "../../duckdb/header-mapping";
import {
  prepareDataQuerySource,
  prepareDataQueryWorkspace,
  type DataQueryInputFormat,
  type DataQueryRelationBinding,
  type PreparedDataQueryContext,
} from "../../duckdb/query";
import { resolveReusableSourceShapeForDataFlow } from "../../data-workflows/source-shape-flow";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";

type DataQueryConnection = Parameters<typeof prepareDataQuerySource>[0];

export interface ResolvedDataQueryShape {
  bodyStartRow?: number;
  headerRow?: number;
  noHeader: boolean;
  range?: string;
  source?: string;
}

export async function resolveDataQueryShape(options: {
  bodyStartRow?: number;
  format: DataQueryInputFormat;
  headerRow?: number;
  inputPath: string;
  noHeader: boolean;
  range?: string;
  relations: DataQueryRelationBinding[];
  runtime: CliRuntime;
  source?: string;
  sourceShape?: string;
}): Promise<ResolvedDataQueryShape> {
  const explicitRange = options.range?.trim() || undefined;
  const explicitSource = options.source?.trim() || undefined;
  const resolvedSourceShape = options.sourceShape?.trim()
    ? await resolveReusableSourceShapeForDataFlow({
        commandName: "query",
        format: options.format,
        inputPath: options.inputPath,
        runtime: options.runtime,
        source: explicitSource,
        sourceShapePath: resolveFromCwd(options.runtime, options.sourceShape.trim()),
      })
    : undefined;

  return {
    bodyStartRow: resolvedSourceShape?.bodyStartRow ?? options.bodyStartRow,
    headerRow: resolvedSourceShape?.headerRow ?? options.headerRow,
    noHeader: options.noHeader,
    range: resolvedSourceShape?.range ?? explicitRange,
    source: resolvedSourceShape?.source ?? explicitSource,
  };
}

export async function prepareDataQueryExecutionContext(
  connection: DataQueryConnection,
  options: {
    format: DataQueryInputFormat;
    headerMappings?: DataHeaderMappingEntry[];
    inputPath: string;
    installMissingExtension?: boolean;
    relationBindings: DataQueryRelationBinding[];
    runtime: CliRuntime;
    shape: ResolvedDataQueryShape;
  },
): Promise<PreparedDataQueryContext> {
  return options.relationBindings.length > 0
    ? await prepareDataQueryWorkspace(
        connection,
        options.inputPath,
        options.format,
        options.relationBindings,
        {
          installMissingExtension: options.installMissingExtension,
          statusStream: options.runtime.stderr,
        },
      )
    : await prepareDataQuerySource(
        connection,
        options.inputPath,
        options.format,
        {
          ...(options.shape.bodyStartRow !== undefined
            ? { bodyStartRow: options.shape.bodyStartRow }
            : {}),
          headerMappings: options.headerMappings,
          ...(options.shape.headerRow !== undefined ? { headerRow: options.shape.headerRow } : {}),
          noHeader: options.shape.noHeader,
          range: options.shape.range,
          source: options.shape.source,
        },
        {
          installMissingExtension: options.installMissingExtension,
          statusStream: options.runtime.stderr,
        },
      );
}
