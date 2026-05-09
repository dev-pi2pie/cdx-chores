import type { DataHeaderMappingEntry } from "../../../../duckdb/header-mapping";
import type { DataQueryInputFormat, DataQuerySourceIntrospection } from "../../../../duckdb/query";
import type { CliRuntime } from "../../../../types";
import type { InteractivePathPromptContext } from "../../../shared";
import { executeInteractiveCandidate } from "../../execution";
import type { InteractiveQueryRunResult } from "../../types";
import { getFormalGuideFilterOperatorChoices } from "./operators";
import { promptFormalGuideAnswers } from "./prompt-collection";
import { buildFormalGuideSql } from "./sql-builder";

export { getFormalGuideFilterOperatorChoices, buildFormalGuideSql };

export async function runFormalGuideInteractiveQuery(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: {
    format: DataQueryInputFormat;
    headerMappings?: DataHeaderMappingEntry[];
    input: string;
    introspection: DataQuerySourceIntrospection;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedNoHeader?: boolean;
    selectedRange?: string;
    selectedSource?: string;
  },
): Promise<InteractiveQueryRunResult> {
  while (true) {
    const answers = await promptFormalGuideAnswers(options.introspection);
    const sql = buildFormalGuideSql(answers);
    const result = await executeInteractiveCandidate(runtime, pathPromptContext, {
      format: options.format,
      headerMappings: options.headerMappings,
      input: options.input,
      reviewMode: "formal-guide",
      selectedBodyStartRow: options.selectedBodyStartRow,
      selectedHeaderRow: options.selectedHeaderRow,
      selectedNoHeader: options.selectedNoHeader,
      selectedRange: options.selectedRange,
      selectedSource: options.selectedSource,
      sql,
      sqlLimit: answers.limit,
    });
    if (result === "executed") {
      return "executed";
    }
    if (result === "change-mode") {
      return "change-mode";
    }
    if (result === "cancel") {
      return "cancel";
    }
  }
}
