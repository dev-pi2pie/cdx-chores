import { printLine, displayPath } from "../actions/shared";
import { CliError } from "../errors";
import type { CliRuntime } from "../types";
import type { DataQueryInputFormat } from "../duckdb/query";
import { createSourceShapeInputReference } from "../duckdb/source-shape/normalize";
import {
  readDataSourceShapeArtifact,
  resolveReusableSourceShape,
} from "../duckdb/source-shape/artifact";

export function isSourceShapeFormat(format: DataQueryInputFormat): format is "excel" {
  return format === "excel";
}

export function classifySourceShapeSuggestionFailure(message: string): { code: string; prefix: string } {
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
      prefix: "Codex source-shape suggestions unavailable",
    };
  }

  return {
    code: "DATA_EXTRACT_SOURCE_SHAPE_SUGGESTION_FAILED",
    prefix: "Codex source-shape suggestions failed",
  };
}

export function formatSourceShapeFlags(shape: { bodyStartRow?: number; headerRow?: number; range?: string }): string {
  return [
    ...(shape.range ? [`--range ${shape.range}`] : []),
    ...(shape.bodyStartRow !== undefined ? [`--body-start-row ${shape.bodyStartRow}`] : []),
    ...(shape.headerRow !== undefined ? [`--header-row ${shape.headerRow}`] : []),
  ].join(" ");
}

export function renderSuggestedSourceShape(
  runtime: CliRuntime,
  options: {
    bodyStartRow?: number;
    headerRow?: number;
    range?: string;
    reasoningSummary: string;
    stream?: "stdout" | "stderr";
  },
): void {
  const stream = options.stream === "stdout" ? runtime.stdout : runtime.stderr;
  printLine(stream, "");
  printLine(stream, "Suggested source shape");
  printLine(stream, "");
  if (options.range) {
    printLine(stream, `- --range ${options.range}`);
  }
  if (options.bodyStartRow !== undefined) {
    printLine(stream, `- --body-start-row ${options.bodyStartRow}`);
  }
  if (options.headerRow !== undefined) {
    printLine(stream, `- --header-row ${options.headerRow}`);
  }
  printLine(stream, `- reasoning: ${options.reasoningSummary}`);
}

export function buildSourceShapeFollowUpCommand(options: {
  artifactPath: string;
  format: DataQueryInputFormat;
  inputPath: string;
  runtime: CliRuntime;
}): string {
  const parts = [
    "cdx-chores",
    "data",
    "extract",
    JSON.stringify(displayPath(options.runtime, options.inputPath)),
    "--input-format",
    options.format,
    "--source-shape",
    JSON.stringify(displayPath(options.runtime, options.artifactPath)),
    "--output",
    JSON.stringify("<output.csv|.tsv|.json>"),
  ];
  return parts.join(" ");
}

export async function resolveReusableSourceShapeForDataFlow(options: {
  format: DataQueryInputFormat;
  inputPath: string;
  runtime: CliRuntime;
  source?: string;
  sourceShapePath: string;
}): Promise<{ bodyStartRow?: number; headerRow?: number; range?: string; source: string }> {
  if (!isSourceShapeFormat(options.format)) {
    throw new CliError("--source-shape is only valid for Excel extract inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const artifact = await readDataSourceShapeArtifact(options.sourceShapePath);
  return resolveReusableSourceShape({
    artifact,
    currentInput: createSourceShapeInputReference({
      cwd: options.runtime.cwd,
      format: "excel",
      inputPath: options.inputPath,
      source: options.source?.trim() || artifact.input.source,
    }),
  });
}
