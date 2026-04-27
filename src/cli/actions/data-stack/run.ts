import { readTextFileRequired } from "../../file-io";
import { resolveFromCwd } from "../../path-utils";
import { writeDataStackCodexReportArtifact } from "../../data-stack/codex-report";
import { suggestDataStackWithCodex } from "../../data-stack/codex-assist";
import { resolveDataStackDryRunArtifactPaths } from "../../data-stack/artifact-paths";
import {
  computeDataStackDiagnostics,
  enforceDataStackDuplicatePolicy,
} from "../../data-stack/diagnostics";
import { normalizeDataStackOutputFormat } from "../../data-stack/formats";
import { prepareDataStackExecution } from "../../data-stack/prepare";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import { assertNonEmpty, displayPath } from "../shared";
import {
  assertDataStackDryRunArtifactPathsDoNotOverlapInputs,
  writePreparedDataStackPlan,
} from "./plan-write";
import { writePreparedDataStackOutput } from "./output-write";
import { resolveDataStackSchemaModeOption, validateDataStackOptions } from "./options";
import type { DataStackOptions } from "./options";
import {
  renderDataStackCodexReportSummary,
  renderDataStackUnionByNameAliasWarning,
  renderDryRunSummary,
} from "./reporting";

export async function actionDataStack(
  runtime: CliRuntime,
  options: DataStackOptions,
): Promise<void> {
  validateDataStackOptions(options);

  const outputPath = resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path"));
  const dryRunArtifactPaths = options.dryRun
    ? resolveDataStackDryRunArtifactPaths({
        codexAssist: options.codexAssist,
        codexReportOutput: options.codexReportOutput,
        outputPath,
        planOutput: options.planOutput,
        runtime,
      })
    : undefined;
  const codexReportPath = dryRunArtifactPaths?.codexReportPath;
  const sourcePaths = options.sources.map((source) =>
    resolveFromCwd(runtime, assertNonEmpty(source, "Input source")),
  );
  const outputFormat = normalizeDataStackOutputFormat(outputPath);
  const uniqueBy = options.uniqueBy ?? [];
  const duplicatePolicy = options.onDuplicate ?? "preserve";
  const schemaMode = resolveDataStackSchemaModeOption(options);
  const prepared = await prepareDataStackExecution({
    columns: options.columns,
    excludeColumns: options.excludeColumns,
    inputFormat: options.inputFormat,
    maxDepth: options.maxDepth,
    noHeader: options.noHeader,
    outputPath,
    pattern: options.pattern?.trim() || undefined,
    readText: readTextFileRequired,
    recursive: options.recursive,
    renderPath: (path) => displayPath(runtime, path),
    schemaMode,
    sources: sourcePaths,
  });
  if (options.unionByName === true) {
    renderDataStackUnionByNameAliasWarning(runtime);
  }

  const diagnostics = computeDataStackDiagnostics({
    header: prepared.header,
    matchedFileCount: prepared.files.length,
    reportPath: codexReportPath,
    rows: prepared.rows,
    uniqueBy,
  });
  if (!options.dryRun) {
    enforceDataStackDuplicatePolicy({
      diagnostics,
      policy: duplicatePolicy,
      uniqueBy,
    });
  }

  if (options.dryRun) {
    const planPath = assertNonEmpty(dryRunArtifactPaths?.planPath, "Plan path");
    assertDataStackDryRunArtifactPathsDoNotOverlapInputs(runtime, {
      paths: [
        { label: "--plan-output", path: planPath },
        { label: "--codex-report-output", path: codexReportPath },
      ],
      prepared,
    });
    const plan = await writePreparedDataStackPlan(runtime, {
      diagnostics,
      duplicatePolicy,
      inputColumns: options.columns?.length ? options.columns : prepared.header,
      outputFormat,
      outputPath,
      overwrite: options.overwrite,
      planPath,
      prepared,
      sourcePaths,
      stackOptions: options,
      uniqueBy,
    });
    if (options.codexAssist) {
      const reportPath = assertNonEmpty(codexReportPath, "Codex report path");
      let report;
      try {
        report = await suggestDataStackWithCodex({
          diagnostics,
          now: runtime.now(),
          plan,
          runner: options.codexRunner,
          timeoutMs: options.codexTimeoutMs,
          workingDirectory: runtime.cwd,
        });
      } catch (error) {
        if (error instanceof CliError) {
          throw error;
        }
        throw new CliError(
          `Codex stack assist failed: ${error instanceof Error ? error.message : String(error)}`,
          {
            code: "DATA_STACK_CODEX_FAILED",
            exitCode: 2,
          },
        );
      }
      await writeDataStackCodexReportArtifact(reportPath, report, { overwrite: options.overwrite });
      renderDataStackCodexReportSummary(runtime, { reportPath });
    }
    renderDryRunSummary(runtime, {
      diagnostics,
      duplicatePolicy,
      outputFormat,
      outputPath,
      planPath,
      prepared,
      uniqueBy,
    });
    return;
  }

  await writePreparedDataStackOutput(runtime, {
    diagnostics,
    outputFormat,
    outputPath,
    overwrite: options.overwrite,
    prepared,
    uniqueBy,
  });
}
