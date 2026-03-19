import { input } from "@inquirer/prompts";

import type { DataHeaderMappingEntry } from "../../../duckdb/header-mapping";
import type { DataQueryInputFormat } from "../../../duckdb/query";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";
import { executeInteractiveCandidate } from "../execution";

export async function runManualInteractiveQuery(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: {
    format: DataQueryInputFormat;
    headerMappings?: DataHeaderMappingEntry[];
    input: string;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedRange?: string;
    selectedSource?: string;
  },
): Promise<void> {
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
      sql: lastSql,
    });
    if (result === "executed") {
      return;
    }
  }
}
