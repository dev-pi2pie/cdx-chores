import { stat } from "node:fs/promises";

import type { DataStackDiagnosticsResult } from "../../data-stack/diagnostics";
import {
  createDataStackPlanArtifact,
  writeDataStackPlanArtifact,
  type DataStackDuplicatePolicy,
  type DataStackPlanArtifact,
  type DataStackPlanMetadata,
} from "../../data-stack/plan";
import type { PreparedDataStackExecution } from "../../data-stack/prepare";
import type { DataStackOutputFormat } from "../../data-stack/types";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import { displayPath } from "../shared";
import type { DataStackOptions } from "./options";

async function createSourceFingerprint(path: string): Promise<
  | {
      mtimeMs: number;
      sizeBytes: number;
    }
  | undefined
> {
  try {
    const sourceStats = await stat(path);
    if (!Number.isFinite(sourceStats.mtimeMs) || !Number.isFinite(sourceStats.size)) {
      return undefined;
    }
    return {
      mtimeMs: sourceStats.mtimeMs,
      sizeBytes: sourceStats.size,
    };
  } catch {
    return undefined;
  }
}

export async function createPreparedDataStackPlan(options: {
  diagnostics: DataStackDiagnosticsResult;
  duplicatePolicy: DataStackDuplicatePolicy;
  inputColumns?: readonly string[];
  outputFormat: DataStackOutputFormat;
  outputPath: string;
  overwrite?: boolean;
  prepared: PreparedDataStackExecution;
  runtime: CliRuntime;
  sourcePaths: readonly string[];
  stackOptions: DataStackOptions;
  uniqueBy: readonly string[];
  metadata?: Partial<
    Omit<DataStackPlanMetadata, "artifactId" | "artifactType" | "issuedAt" | "payloadId">
  >;
}): Promise<DataStackPlanArtifact> {
  return createDataStackPlanArtifact({
    diagnostics: options.diagnostics.planDiagnostics,
    duplicates: {
      duplicateKeyConflicts: options.diagnostics.duplicateSummary.duplicateKeyConflicts,
      exactDuplicateRows: options.diagnostics.duplicateSummary.exactDuplicateRows,
      policy: options.duplicatePolicy,
      uniqueBy: [...options.uniqueBy],
    },
    input: {
      columns: options.stackOptions.noHeader ? [...(options.inputColumns ?? [])] : [],
      format: options.prepared.inputFormat,
      headerMode: options.stackOptions.noHeader ? "no-header" : "header",
    },
    metadata: options.metadata,
    now: options.runtime.now(),
    output: {
      format: options.outputFormat,
      overwrite: options.overwrite ?? false,
      path: options.outputPath,
    },
    schema: {
      excludedNames: [...options.prepared.excludedColumns],
      includedNames: [...options.prepared.header],
      mode: options.prepared.schemaMode,
    },
    sources: {
      baseDirectory: options.runtime.cwd,
      maxDepth: options.stackOptions.maxDepth ?? null,
      pattern: options.stackOptions.pattern?.trim() || null,
      raw: [...options.sourcePaths],
      recursive: options.stackOptions.recursive ?? false,
      resolved: await Promise.all(
        options.prepared.files.map(async (file) => ({
          fingerprint: await createSourceFingerprint(file.path),
          kind: "file" as const,
          path: file.path,
        })),
      ),
    },
  });
}

export async function writePreparedDataStackPlan(
  runtime: CliRuntime,
  options: {
    diagnostics: DataStackDiagnosticsResult;
    duplicatePolicy: DataStackDuplicatePolicy;
    inputColumns?: readonly string[];
    outputFormat: DataStackOutputFormat;
    outputPath: string;
    overwrite?: boolean;
    plan?: DataStackPlanArtifact;
    planPath: string;
    prepared: PreparedDataStackExecution;
    sourcePaths: readonly string[];
    stackOptions: DataStackOptions;
    uniqueBy: readonly string[];
    metadata?: Partial<
      Omit<DataStackPlanMetadata, "artifactId" | "artifactType" | "issuedAt" | "payloadId">
    >;
  },
): Promise<DataStackPlanArtifact> {
  const plan =
    options.plan ??
    (await createPreparedDataStackPlan({
      diagnostics: options.diagnostics,
      duplicatePolicy: options.duplicatePolicy,
      inputColumns: options.inputColumns,
      outputFormat: options.outputFormat,
      outputPath: options.outputPath,
      overwrite: options.overwrite,
      prepared: options.prepared,
      runtime,
      sourcePaths: options.sourcePaths,
      stackOptions: options.stackOptions,
      uniqueBy: options.uniqueBy,
      metadata: options.metadata,
    }));
  await writeDataStackPlanArtifact(options.planPath, plan, { overwrite: options.overwrite });
  return plan;
}

export function assertDataStackDryRunArtifactPathsDoNotOverlapInputs(
  runtime: CliRuntime,
  options: {
    paths: ReadonlyArray<{ label: string; path?: string }>;
    prepared: PreparedDataStackExecution;
  },
): void {
  const inputPaths = new Set(options.prepared.files.map((file) => file.path));
  for (const reservation of options.paths) {
    if (!reservation.path || !inputPaths.has(reservation.path)) {
      continue;
    }
    throw new CliError(
      `${reservation.label} cannot be the same path as an input source: ${displayPath(runtime, reservation.path)}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
}
