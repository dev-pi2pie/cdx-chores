import { stat, unlink } from "node:fs/promises";

import { readTextFileRequired } from "../file-io";
import { resolveFromCwd } from "../path-utils";
import type { CliRuntime } from "../types";
import {
  computeDataStackDiagnostics,
  enforceDataStackDuplicatePolicy,
} from "../data-stack/diagnostics";
import { normalizeDataStackOutputFormat } from "../data-stack/formats";
import { readDataStackPlanArtifact, type DataStackPlanArtifact } from "../data-stack/plan";
import { prepareDataStackExecution, type PreparedDataStackExecution } from "../data-stack/prepare";
import { CliError } from "../errors";
import { displayPath, printLine } from "./shared";
import { writePreparedDataStackOutput } from "./data-stack";

export interface DataStackReplayOptions {
  autoClean?: boolean;
  output?: string;
  record: string;
}

function assertMatchingPlanSchema(options: {
  artifact: DataStackPlanArtifact;
  prepared: PreparedDataStackExecution;
}): void {
  const expected = options.artifact.schema.includedNames;
  const actual = options.prepared.header;
  if (expected.length !== actual.length || expected.some((name, index) => name !== actual[index])) {
    throw new CliError(
      `Replay schema mismatch. Expected ${expected.join(", ")} but prepared ${actual.join(", ")}.`,
      {
        code: "INVALID_INPUT",
        exitCode: 2,
      },
    );
  }
}

async function warnOnFingerprintDrift(
  runtime: CliRuntime,
  artifact: DataStackPlanArtifact,
): Promise<void> {
  for (const source of artifact.sources.resolved) {
    if (!source.fingerprint) {
      continue;
    }
    try {
      const sourceStats = await stat(source.path);
      if (
        sourceStats.size !== source.fingerprint.sizeBytes ||
        sourceStats.mtimeMs !== source.fingerprint.mtimeMs
      ) {
        printLine(
          runtime.stderr,
          `Warning: source fingerprint changed for ${displayPath(runtime, source.path)}`,
        );
      }
    } catch {
      printLine(
        runtime.stderr,
        `Warning: source fingerprint could not be checked for ${displayPath(runtime, source.path)}`,
      );
    }
  }
}

export async function actionDataStackReplay(
  runtime: CliRuntime,
  options: DataStackReplayOptions,
): Promise<void> {
  const recordPath = resolveFromCwd(runtime, options.record);
  const artifact = await readDataStackPlanArtifact(recordPath);
  const outputPath = options.output
    ? resolveFromCwd(runtime, options.output)
    : artifact.output.path;

  if (!outputPath) {
    throw new CliError("Replay requires an output path. Use --output or a plan with output.path.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (outputPath === recordPath) {
    throw new CliError("Replay output path cannot be the stack-plan record path.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  await warnOnFingerprintDrift(runtime, artifact);

  const outputFormat = normalizeDataStackOutputFormat(outputPath);
  const prepared = await prepareDataStackExecution({
    columns: artifact.input.headerMode === "no-header" ? artifact.input.columns : undefined,
    excludeColumns: artifact.schema.excludedNames,
    inputFormat: artifact.input.format,
    noHeader: artifact.input.headerMode === "no-header",
    outputPath,
    readText: readTextFileRequired,
    renderPath: (path) => displayPath(runtime, path),
    schemaMode: artifact.schema.mode,
    sources: artifact.sources.resolved.map((source) => source.path),
  });
  assertMatchingPlanSchema({ artifact, prepared });

  const diagnostics = computeDataStackDiagnostics({
    header: prepared.header,
    matchedFileCount: prepared.files.length,
    rows: prepared.rows,
    uniqueBy: artifact.duplicates.uniqueBy,
  });
  enforceDataStackDuplicatePolicy({
    diagnostics,
    label: "Replay",
    policy: artifact.duplicates.policy,
    uniqueBy: artifact.duplicates.uniqueBy,
  });

  await writePreparedDataStackOutput(runtime, {
    diagnostics,
    outputFormat,
    outputPath,
    overwrite: artifact.output.overwrite,
    prepared,
    uniqueBy: artifact.duplicates.uniqueBy,
  });

  if (options.autoClean) {
    await unlink(recordPath);
    printLine(runtime.stderr, `Removed stack plan: ${displayPath(runtime, recordPath)}`);
  }
}
