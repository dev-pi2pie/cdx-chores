import { join } from "node:path";

import { displayPath, printLine } from "../actions/shared";
import {
  createDataHeaderMappingArtifact,
  createHeaderMappingInputReference,
  generateDataHeaderMappingFileName,
  readDataHeaderMappingArtifact,
  resolveReusableHeaderMappings,
  suggestDataHeaderMappingsWithCodex,
  writeDataHeaderMappingArtifact,
  type DataHeaderMappingEntry,
  type DataHeaderSuggestionRunner,
} from "../duckdb/header-mapping";
import type { DataQueryInputFormat, DataQuerySourceIntrospection } from "../duckdb/query";
import { CliError } from "../errors";
import { resolveFromCwd } from "../path-utils";
import type { CliRuntime } from "../types";

export interface DataWorkflowHeaderMappingShape {
  headerRow?: number;
  range?: string;
  source?: string;
}

export function classifyHeaderSuggestionFailure(message: string, options: {
  failureCode: string;
  failurePrefix: string;
}): { code: string; prefix: string } {
  if (
    /codex exec exited/i.test(message) ||
    /missing optional dependency/i.test(message) ||
    /spawn/i.test(message) ||
    /enoent/i.test(message) ||
    /auth/i.test(message) ||
    /sign in/i.test(message) ||
    /api key/i.test(message)
  ) {
    return {
      code: "CODEX_UNAVAILABLE",
      prefix: "Codex header suggestions unavailable",
    };
  }

  return {
    code: options.failureCode,
    prefix: options.failurePrefix,
  };
}

export function renderHeaderSuggestionSummary(
  runtime: CliRuntime,
  mappings: readonly DataHeaderMappingEntry[],
): void {
  printLine(runtime.stdout, "Suggested headers");
  printLine(runtime.stdout, "");

  if (mappings.length === 0) {
    printLine(runtime.stdout, "(no semantic header changes suggested)");
    return;
  }

  for (const mapping of mappings) {
    const details = [
      `${mapping.from} -> ${mapping.to}`,
      typeof mapping.sample === "string" ? `sample: ${JSON.stringify(mapping.sample)}` : undefined,
      typeof mapping.inferredType === "string" ? `type: ${mapping.inferredType}` : undefined,
    ].filter((value): value is string => Boolean(value));
    printLine(runtime.stdout, `- ${details.join("  ")}`);
  }
}

export function buildHeaderSuggestionFollowUpCommand(options: {
  artifactPath: string;
  commandPath: readonly string[];
  format: DataQueryInputFormat;
  inputPath: string;
  runtime: CliRuntime;
  shape: DataWorkflowHeaderMappingShape;
  tailArgs: readonly string[];
}): string {
  const parts = [
    "cdx-chores",
    ...options.commandPath,
    JSON.stringify(displayPath(options.runtime, options.inputPath)),
    "--input-format",
    options.format,
    ...(options.shape.source ? ["--source", JSON.stringify(options.shape.source)] : []),
    ...(options.shape.range ? ["--range", options.shape.range] : []),
    ...(options.shape.headerRow !== undefined
      ? ["--header-row", String(options.shape.headerRow)]
      : []),
    "--header-mapping",
    JSON.stringify(displayPath(options.runtime, options.artifactPath)),
    ...options.tailArgs,
  ];
  return parts.join(" ");
}

export async function resolveReusableHeaderMappingsForDataFlow(options: {
  format: DataQueryInputFormat;
  headerMappingPath: string;
  inputPath: string;
  runtime: CliRuntime;
  shape: DataWorkflowHeaderMappingShape;
}): Promise<DataHeaderMappingEntry[]> {
  const artifact = await readDataHeaderMappingArtifact(options.headerMappingPath);
  const currentInput = createHeaderMappingInputReference({
    cwd: options.runtime.cwd,
    format: options.format,
    inputPath: options.inputPath,
    shape: options.shape,
  });
  return resolveReusableHeaderMappings({
    artifact,
    currentInput,
  });
}

export async function runCodexHeaderSuggestionFlow(options: {
  runtime: CliRuntime;
  format: DataQueryInputFormat;
  inputPath: string;
  shape: DataWorkflowHeaderMappingShape;
  overwrite?: boolean;
  writeHeaderMapping?: string;
  headerSuggestionRunner?: DataHeaderSuggestionRunner;
  collectIntrospection: () => Promise<DataQuerySourceIntrospection>;
  failureCode: string;
  failurePrefix: string;
  reviewMessage: string;
  followUpCommandPath: readonly string[];
  followUpTailArgs: readonly string[];
}): Promise<void> {
  const artifactPath = options.writeHeaderMapping?.trim()
    ? resolveFromCwd(options.runtime, options.writeHeaderMapping.trim())
    : join(options.runtime.cwd, generateDataHeaderMappingFileName());
  const introspection = await options.collectIntrospection();
  const suggestionResult = await suggestDataHeaderMappingsWithCodex({
    format: options.format,
    introspection,
    runner: options.headerSuggestionRunner,
    workingDirectory: options.runtime.cwd,
  });

  if (suggestionResult.errorMessage) {
    const failure = classifyHeaderSuggestionFailure(suggestionResult.errorMessage, {
      failureCode: options.failureCode,
      failurePrefix: options.failurePrefix,
    });
    throw new CliError(`${failure.prefix}: ${suggestionResult.errorMessage}`, {
      code: failure.code,
      exitCode: 2,
    });
  }

  const artifact = createDataHeaderMappingArtifact({
    input: createHeaderMappingInputReference({
      cwd: options.runtime.cwd,
      format: options.format,
      inputPath: options.inputPath,
      shape: options.shape,
    }),
    mappings: suggestionResult.mappings,
    now: options.runtime.now(),
  });
  await writeDataHeaderMappingArtifact(artifactPath, artifact, {
    overwrite: options.overwrite,
  });

  renderHeaderSuggestionSummary(options.runtime, suggestionResult.mappings);
  printLine(options.runtime.stderr, `Wrote header mapping: ${displayPath(options.runtime, artifactPath)}`);
  printLine(options.runtime.stderr, options.reviewMessage);
  printLine(
    options.runtime.stderr,
    buildHeaderSuggestionFollowUpCommand({
      artifactPath,
      commandPath: options.followUpCommandPath,
      format: options.format,
      inputPath: options.inputPath,
      runtime: options.runtime,
      shape: options.shape,
      tailArgs: options.followUpTailArgs,
    }),
  );
}
