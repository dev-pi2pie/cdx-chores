import { input } from "@inquirer/prompts";

import type { DataHeaderMappingEntry } from "../../../duckdb/header-mapping";
import type { DataQueryInputFormat } from "../../../duckdb/query";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";
import { executeInteractiveCandidate } from "../execution";
import type { InteractiveQueryRunResult } from "../types";

export async function runManualInteractiveQuery(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: {
    format: DataQueryInputFormat;
    headerMappings?: DataHeaderMappingEntry[];
    input: string;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedNoHeader?: boolean;
    selectedRange?: string;
    selectedSource?: string;
  },
): Promise<InteractiveQueryRunResult> {
  let lastSql = "";
  while (true) {
    const sql = await input({
      message: "SQL query",
      default: lastSql,
      validate: (value) => (value.trim().length > 0 ? true : "Enter a SQL query."),
    });
    lastSql = sql.trim();
    const result = await executeInteractiveCandidate(runtime, pathPromptContext, {
      ...options,
      reviewMode: "manual",
      sql: lastSql,
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
