import { select } from "@inquirer/prompts";

import { maybeRenderDuckDbExtensionRemediationCommand } from "../../data-workflows/duckdb-remediation";
import { createDuckDbConnection, listDataQuerySources } from "../../duckdb/query";
import { resolveFromCwd } from "../../path-utils";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import { writeInteractiveAbortNotice } from "../notice";
import type { InteractivePathPromptContext } from "../shared";
import { reviewInteractiveHeaderMappings } from "./header-review";
import { collectInteractiveIntrospection } from "./source-shape";
import {
  promptDelimitedHeaderMode,
  promptInteractiveInputFormat,
  promptOptionalSourceSelection,
} from "./source-selection";
import { runCodexInteractiveQuery } from "./sql/codex";
import { runFormalGuideInteractiveQuery } from "./sql/formal-guide";
import { runManualInteractiveQuery } from "./sql/manual";
import type { DataQueryInteractiveMode } from "./types";
import { QUERY_CONTINUATION_LABELS } from "./types";

export {
  promptInteractiveInputFormat,
  promptDelimitedHeaderMode,
  promptOptionalSourceSelection,
  collectInteractiveIntrospection,
  reviewInteractiveHeaderMappings,
};

export async function runInteractiveDataQuery(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  const input = await promptRequiredPathWithConfig("Input data file", {
    kind: "file",
    ...pathPromptContext,
  });
  const inputPath = resolveFromCwd(runtime, input);
  const format = await promptInteractiveInputFormat(runtime, inputPath);
  const noHeader = await promptDelimitedHeaderMode(format);
  writeInteractiveAbortNotice(runtime);

  let connection;
  try {
    connection = await createDuckDbConnection();
    const sources = await listDataQuerySources(connection, inputPath, format);
    const selectedSource = await promptOptionalSourceSelection(format, sources);
    const { introspection, sourceShape } = await collectInteractiveIntrospection({
      connection,
      format,
      initialNoHeader: noHeader,
      inputPath,
      labels: QUERY_CONTINUATION_LABELS,
      runtime,
      selectedSource,
    });
    const reviewedHeaders = await reviewInteractiveHeaderMappings({
      connection,
      format,
      inputPath,
      introspection,
      labels: QUERY_CONTINUATION_LABELS,
      runtime,
      selectedBodyStartRow: sourceShape.selectedBodyStartRow,
      selectedHeaderRow: sourceShape.selectedHeaderRow,
      selectedNoHeader: sourceShape.selectedNoHeader,
      selectedRange: sourceShape.selectedRange,
      selectedSource,
    });

    while (true) {
      const mode = await select<DataQueryInteractiveMode>({
        message: "Choose mode",
        choices: [
          { name: "manual", value: "manual" },
          { name: "formal-guide", value: "formal-guide" },
          { name: "Codex Assistant", value: "Codex Assistant" },
        ],
      });

      const result =
        mode === "manual"
          ? await runManualInteractiveQuery(runtime, pathPromptContext, {
              format,
              headerMappings: reviewedHeaders.headerMappings,
              input,
              selectedBodyStartRow: sourceShape.selectedBodyStartRow,
              selectedHeaderRow: sourceShape.selectedHeaderRow,
              selectedNoHeader: sourceShape.selectedNoHeader,
              selectedRange: sourceShape.selectedRange,
              selectedSource,
            })
          : mode === "formal-guide"
            ? await runFormalGuideInteractiveQuery(runtime, pathPromptContext, {
                format,
                input,
                introspection: reviewedHeaders.introspection,
                headerMappings: reviewedHeaders.headerMappings,
                selectedBodyStartRow: sourceShape.selectedBodyStartRow,
                selectedHeaderRow: sourceShape.selectedHeaderRow,
                selectedNoHeader: sourceShape.selectedNoHeader,
                selectedRange: sourceShape.selectedRange,
                selectedSource,
              })
            : await runCodexInteractiveQuery(runtime, pathPromptContext, {
                format,
                input,
                introspection: reviewedHeaders.introspection,
                headerMappings: reviewedHeaders.headerMappings,
                selectedBodyStartRow: sourceShape.selectedBodyStartRow,
                selectedHeaderRow: sourceShape.selectedHeaderRow,
                selectedNoHeader: sourceShape.selectedNoHeader,
                selectedRange: sourceShape.selectedRange,
                selectedSource,
              });

      if (result === "change-mode") {
        continue;
      }
      return;
    }
  } catch (error) {
    maybeRenderDuckDbExtensionRemediationCommand(runtime, format, error);
    throw error;
  } finally {
    connection?.closeSync();
  }
}
