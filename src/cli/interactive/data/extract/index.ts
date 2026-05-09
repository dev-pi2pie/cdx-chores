import { actionDataExtract } from "../../../actions";
import { maybeRenderDuckDbExtensionRemediationCommand } from "../../../data-workflows/duckdb-remediation";
import { createDuckDbConnection, listDataQuerySources } from "../../../duckdb/query";
import { resolveFromCwd } from "../../../path-utils";
import { promptRequiredPathWithConfig } from "../../../prompts/path";
import type { CliRuntime } from "../../../types";
import { promptInteractiveInputFormat } from "../../data-query";
import { writeInteractiveFlowTip } from "../../contextual-tip";
import type { InteractivePathPromptContext } from "../../shared";
import {
  collectInteractiveExtractSessionState,
  runInteractiveExtractCheckpointFlow,
} from "./session";

export async function runInteractiveDataExtract(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  writeInteractiveFlowTip(runtime, "data-extract");
  const input = await promptRequiredPathWithConfig("Input data file", {
    kind: "file",
    ...pathPromptContext,
  });
  const inputPath = resolveFromCwd(runtime, input);
  const format = await promptInteractiveInputFormat(runtime, inputPath);

  let connection;
  try {
    connection = await createDuckDbConnection();
    const sources = await listDataQuerySources(connection, inputPath, format);
    while (true) {
      const state = await collectInteractiveExtractSessionState({
        connection,
        format,
        input,
        inputPath,
        runtime,
        sources,
      });
      const checkpointOutcome = await runInteractiveExtractCheckpointFlow(
        runtime,
        pathPromptContext,
        input,
        state,
      );
      if (checkpointOutcome.kind === "restart-setup") {
        continue;
      }
      if (checkpointOutcome.kind === "cancel") {
        return;
      }

      await actionDataExtract(runtime, {
        ...(state.headerMappings ? { headerMappings: state.headerMappings } : {}),
        input,
        inputFormat: format,
        ...(state.selectedNoHeader ? { noHeader: true } : {}),
        output: checkpointOutcome.plan.output,
        overwrite: checkpointOutcome.plan.overwrite,
        ...(state.selectedBodyStartRow !== undefined
          ? { bodyStartRow: state.selectedBodyStartRow }
          : {}),
        ...(state.selectedHeaderRow !== undefined ? { headerRow: state.selectedHeaderRow } : {}),
        ...(state.selectedRange ? { range: state.selectedRange } : {}),
        ...(state.selectedSource ? { source: state.selectedSource } : {}),
      });
      return;
    }
  } catch (error) {
    maybeRenderDuckDbExtensionRemediationCommand(runtime, format, error);
    throw error;
  } finally {
    connection?.closeSync();
  }
}
