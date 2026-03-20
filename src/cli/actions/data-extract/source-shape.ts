import { join } from "node:path";

import {
  buildSourceShapeHeaderSuggestionFollowUpCommand,
  buildSourceShapeFollowUpCommand,
  classifySourceShapeSuggestionFailure,
  isSourceShapeFormat,
  renderSuggestedSourceShape,
} from "../../data-workflows/source-shape-flow";
import { CliError } from "../../errors";
import { createInteractiveAnalyzerStatus } from "../../interactive/analyzer-status";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import { collectDataQuerySourceIntrospection, createDuckDbConnection, type DataQueryInputFormat } from "../../duckdb/query";
import { collectXlsxSheetSnapshot } from "../../duckdb/xlsx-sources";
import {
  createDataSourceShapeArtifact,
  createSourceShapeInputReference,
  generateDataSourceShapeFileName,
  suggestDataSourceShapeWithCodex,
  type DataSourceShapeSuggestionRunner,
  writeDataSourceShapeArtifact,
} from "../../duckdb/source-shape";
import { assertNonEmpty, displayPath, printLine } from "../shared";
import { DATA_EXTRACT_HEADER_SUGGESTION_SAMPLE_ROWS, DATA_EXTRACT_SOURCE_SHAPE_SNAPSHOT_ROWS } from "./types";

export async function runCodexSourceShapeSuggestionFlow(
  runtime: CliRuntime,
  options: {
    format: DataQueryInputFormat;
    inputPath: string;
    overwrite?: boolean;
    source?: string;
    sourceShapeSuggestionRunner?: DataSourceShapeSuggestionRunner;
    writeSourceShape?: string;
  },
): Promise<void> {
  if (!isSourceShapeFormat(options.format)) {
    throw new CliError("--codex-suggest-shape is only valid for Excel extract inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  const selectedSource = assertNonEmpty(options.source, "Source");
  const artifactPath = options.writeSourceShape?.trim()
    ? resolveFromCwd(runtime, options.writeSourceShape.trim())
    : join(runtime.cwd, generateDataSourceShapeFileName());
  const status = createInteractiveAnalyzerStatus(runtime.stdout, runtime.colorEnabled);

  let connection;
  try {
    connection = await createDuckDbConnection();
    status.start("Inspecting worksheet structure");
    const currentIntrospection = await collectDataQuerySourceIntrospection(
      connection,
      options.inputPath,
      options.format,
      {
        source: selectedSource,
      },
      DATA_EXTRACT_HEADER_SUGGESTION_SAMPLE_ROWS,
    );
    const sheetSnapshot = await collectXlsxSheetSnapshot(options.inputPath, selectedSource, {
      maxRows: DATA_EXTRACT_SOURCE_SHAPE_SNAPSHOT_ROWS,
    });
    status.wait("Waiting for Codex source-shape suggestions");
    const suggestionResult = await suggestDataSourceShapeWithCodex({
      context: {
        currentIntrospection,
        sheetSnapshot,
      },
      currentBodyStartRow: currentIntrospection.selectedBodyStartRow,
      currentHeaderRow: currentIntrospection.selectedHeaderRow,
      currentRange: currentIntrospection.selectedRange,
      runner: options.sourceShapeSuggestionRunner,
      workingDirectory: runtime.cwd,
    });
    status.stop();

    if (suggestionResult.errorMessage || !suggestionResult.shape || !suggestionResult.reasoningSummary) {
      const failure = classifySourceShapeSuggestionFailure(
        suggestionResult.errorMessage ?? "Codex did not return a valid source-shape suggestion.",
      );
      throw new CliError(`${failure.prefix}: ${suggestionResult.errorMessage ?? "Codex did not return a valid source-shape suggestion."}`, {
        code: failure.code,
        exitCode: 2,
      });
    }

    const artifact = createDataSourceShapeArtifact({
      input: createSourceShapeInputReference({
        cwd: runtime.cwd,
        format: "excel",
        inputPath: options.inputPath,
        source: selectedSource,
      }),
      now: runtime.now(),
      shape: suggestionResult.shape,
    });
    await writeDataSourceShapeArtifact(artifactPath, artifact, {
      overwrite: options.overwrite,
    });

    renderSuggestedSourceShape(runtime, {
      bodyStartRow: suggestionResult.shape.bodyStartRow,
      headerRow: suggestionResult.shape.headerRow,
      range: suggestionResult.shape.range,
      reasoningSummary: suggestionResult.reasoningSummary,
      stream: "stdout",
    });
    printLine(runtime.stderr, `Wrote source shape: ${displayPath(runtime, artifactPath)}`);
    printLine(
      runtime.stderr,
      "Review the shape artifact, then rerun with --source-shape to replay the accepted source interpretation. If the replayed columns are still positional or generic, run --codex-suggest-headers after --source-shape before final extraction.",
    );
    printLine(
      runtime.stderr,
      buildSourceShapeFollowUpCommand({
        artifactPath,
        format: options.format,
        inputPath: options.inputPath,
        runtime,
      }),
    );
    printLine(
      runtime.stderr,
      buildSourceShapeHeaderSuggestionFollowUpCommand({
        artifactPath,
        format: options.format,
        inputPath: options.inputPath,
        runtime,
      }),
    );
  } finally {
    status.stop();
    connection?.closeSync();
  }
}
