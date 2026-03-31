import { select } from "@inquirer/prompts";

import { maybeRenderDuckDbExtensionRemediationCommand } from "../../data-workflows/duckdb-remediation";
import {
  collectDataQueryWorkspaceIntrospection,
  createDuckDbConnection,
  listDataQuerySources,
} from "../../duckdb/query";
import { resolveFromCwd } from "../../path-utils";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import { printLine } from "../../actions/shared";
import { writeInteractiveFlowTip } from "../contextual-tip";
import type { InteractivePathPromptContext } from "../shared";
import { reviewInteractiveHeaderMappings } from "./header-review";
import { collectInteractiveIntrospection } from "./source-shape";
import {
  promptDelimitedHeaderMode,
  promptInteractiveInputFormat,
  promptInteractiveQueryScope,
  promptOptionalSourceSelection,
  promptWorkspaceRelationBindings,
} from "./source-selection";
import { runCodexInteractiveQuery } from "./sql/codex";
import { runFormalGuideInteractiveQuery } from "./sql/formal-guide";
import { runManualInteractiveQuery } from "./sql/manual";
import type { DataQueryInteractiveMode, DataQueryInteractiveScope } from "./types";
import { QUERY_CONTINUATION_LABELS } from "./types";

export {
  promptInteractiveInputFormat,
  promptInteractiveQueryScope,
  promptDelimitedHeaderMode,
  promptOptionalSourceSelection,
  promptWorkspaceRelationBindings,
  collectInteractiveIntrospection,
  reviewInteractiveHeaderMappings,
};

async function runInteractiveModeLoop(options: {
  pathPromptContext: InteractivePathPromptContext;
  runtime: CliRuntime;
  availableModes: DataQueryInteractiveMode[];
  runMode: (mode: DataQueryInteractiveMode) => Promise<"executed" | "change-mode" | "cancel">;
}): Promise<void> {
  while (true) {
    const mode = await select<DataQueryInteractiveMode>({
      message: "Choose mode",
      choices: options.availableModes.map((nextMode) => ({
        name: nextMode,
        value: nextMode,
      })),
    });

    const result = await options.runMode(mode);
    if (result === "change-mode") {
      continue;
    }
    return;
  }
}

async function prepareInteractiveQueryScopeContext(options: {
  connection: Awaited<ReturnType<typeof createDuckDbConnection>>;
  format: Awaited<ReturnType<typeof promptInteractiveInputFormat>>;
  input: string;
  inputPath: string;
  noHeader: boolean | undefined;
  pathPromptContext: InteractivePathPromptContext;
  runtime: CliRuntime;
  scope: DataQueryInteractiveScope;
  sources: readonly string[] | undefined;
}): Promise<{
  availableModes: DataQueryInteractiveMode[];
  runMode: (mode: DataQueryInteractiveMode) => Promise<"executed" | "change-mode" | "cancel">;
}> {
  return options.scope === "workspace"
    ? await prepareWorkspaceQueryScopeContext(options)
    : await prepareSingleSourceQueryScopeContext(options);
}

async function prepareWorkspaceQueryScopeContext(options: {
  connection: Awaited<ReturnType<typeof createDuckDbConnection>>;
  format: Awaited<ReturnType<typeof promptInteractiveInputFormat>>;
  input: string;
  inputPath: string;
  pathPromptContext: InteractivePathPromptContext;
  runtime: CliRuntime;
  sources: readonly string[] | undefined;
}): Promise<{
  availableModes: DataQueryInteractiveMode[];
  runMode: (mode: DataQueryInteractiveMode) => Promise<"executed" | "change-mode" | "cancel">;
}> {
  const relations = await promptWorkspaceRelationBindings(options.format, options.sources);
  const workspaceIntrospection = await collectDataQueryWorkspaceIntrospection(
    options.connection,
    options.inputPath,
    options.format,
    relations,
    5,
  );
  printLine(
    options.runtime.stderr,
    `Workspace relations: ${relations.map((relation) => relation.alias).join(", ")}`,
  );

  return {
    availableModes: ["manual", "Codex Assistant"],
    runMode: async (mode) =>
      mode === "manual"
        ? await runManualInteractiveQuery(options.runtime, options.pathPromptContext, {
            format: options.format,
            input: options.input,
            relations,
          })
        : await runCodexInteractiveQuery(options.runtime, options.pathPromptContext, {
            format: options.format,
            input: options.input,
            introspection: workspaceIntrospection,
            mode: "workspace",
            relations,
          }),
  };
}

async function prepareSingleSourceQueryScopeContext(options: {
  connection: Awaited<ReturnType<typeof createDuckDbConnection>>;
  format: Awaited<ReturnType<typeof promptInteractiveInputFormat>>;
  input: string;
  inputPath: string;
  noHeader: boolean | undefined;
  pathPromptContext: InteractivePathPromptContext;
  runtime: CliRuntime;
  sources: readonly string[] | undefined;
}): Promise<{
  availableModes: DataQueryInteractiveMode[];
  runMode: (mode: DataQueryInteractiveMode) => Promise<"executed" | "change-mode" | "cancel">;
}> {
  const selectedSource = await promptOptionalSourceSelection(options.format, options.sources);
  const { introspection, sourceShape } = await collectInteractiveIntrospection({
    connection: options.connection,
    format: options.format,
    initialNoHeader: options.noHeader,
    inputPath: options.inputPath,
    labels: QUERY_CONTINUATION_LABELS,
    runtime: options.runtime,
    selectedSource,
  });
  const reviewedHeaders = await reviewInteractiveHeaderMappings({
    connection: options.connection,
    format: options.format,
    inputPath: options.inputPath,
    introspection,
    labels: QUERY_CONTINUATION_LABELS,
    runtime: options.runtime,
    selectedBodyStartRow: sourceShape.selectedBodyStartRow,
    selectedHeaderRow: sourceShape.selectedHeaderRow,
    selectedNoHeader: sourceShape.selectedNoHeader,
    selectedRange: sourceShape.selectedRange,
    selectedSource,
  });

  return {
    availableModes: ["manual", "formal-guide", "Codex Assistant"],
    runMode: async (mode) =>
      mode === "manual"
        ? await runManualInteractiveQuery(options.runtime, options.pathPromptContext, {
            format: options.format,
            headerMappings: reviewedHeaders.headerMappings,
            input: options.input,
            selectedBodyStartRow: sourceShape.selectedBodyStartRow,
            selectedHeaderRow: sourceShape.selectedHeaderRow,
            selectedNoHeader: sourceShape.selectedNoHeader,
            selectedRange: sourceShape.selectedRange,
            selectedSource,
          })
        : mode === "formal-guide"
          ? await runFormalGuideInteractiveQuery(options.runtime, options.pathPromptContext, {
              format: options.format,
              input: options.input,
              introspection: reviewedHeaders.introspection,
              headerMappings: reviewedHeaders.headerMappings,
              selectedBodyStartRow: sourceShape.selectedBodyStartRow,
              selectedHeaderRow: sourceShape.selectedHeaderRow,
              selectedNoHeader: sourceShape.selectedNoHeader,
              selectedRange: sourceShape.selectedRange,
              selectedSource,
            })
          : await runCodexInteractiveQuery(options.runtime, options.pathPromptContext, {
              format: options.format,
              input: options.input,
              introspection: reviewedHeaders.introspection,
              mode: "single-source",
              headerMappings: reviewedHeaders.headerMappings,
              selectedBodyStartRow: sourceShape.selectedBodyStartRow,
              selectedHeaderRow: sourceShape.selectedHeaderRow,
              selectedNoHeader: sourceShape.selectedNoHeader,
              selectedRange: sourceShape.selectedRange,
              selectedSource,
            }),
  };
}

export async function runInteractiveDataQuery(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  writeInteractiveFlowTip(runtime, "data-query");
  const input = await promptRequiredPathWithConfig("Input data file", {
    kind: "file",
    ...pathPromptContext,
  });
  const inputPath = resolveFromCwd(runtime, input);
  const format = await promptInteractiveInputFormat(runtime, inputPath);
  const noHeader = await promptDelimitedHeaderMode(format);

  let connection;
  try {
    connection = await createDuckDbConnection();
    const sources = await listDataQuerySources(connection, inputPath, format);
    const scope = await promptInteractiveQueryScope(format, sources);
    const scopeContext = await prepareInteractiveQueryScopeContext({
      connection,
      format,
      input,
      inputPath,
      noHeader,
      pathPromptContext,
      runtime,
      scope,
      sources,
    });

    await runInteractiveModeLoop({
      availableModes: scopeContext.availableModes,
      pathPromptContext,
      runMode: scopeContext.runMode,
      runtime,
    });
    return;
  } catch (error) {
    maybeRenderDuckDbExtensionRemediationCommand(runtime, format, error);
    throw error;
  } finally {
    connection?.closeSync();
  }
}
