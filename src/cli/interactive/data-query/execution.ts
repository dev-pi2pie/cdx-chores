import { confirm, input, select } from "@inquirer/prompts";

import { actionDataQuery } from "../../actions";
import { printLine } from "../../actions/shared";
import { getCliColors } from "../../colors";
import { promptFileOutputTarget } from "../../data-workflows/output";
import type { DataHeaderMappingEntry } from "../../duckdb/header-mapping";
import type { DataQueryInputFormat } from "../../duckdb/query";
import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";
import type { OutputPromptSelection } from "./types";

function isDataQuerySqlExecutionError(error: unknown): boolean {
  return (
    error instanceof CliError &&
    (error.code === "DATA_QUERY_FAILED" ||
      (error.code === "INVALID_INPUT" &&
        /data query requires a sql statement that returns rows/i.test(error.message)))
  );
}

function isOutputExistsError(error: unknown): boolean {
  return (
    error instanceof CliError ||
    (typeof error === "object" && error !== null && "code" in error)
  )
    ? (error as { code?: unknown }).code === "OUTPUT_EXISTS"
    : false;
}

function renderCandidateSql(runtime: CliRuntime, sql: string): void {
  const pc = getCliColors(runtime);
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `${pc.bold(pc.green("SQL"))}:`);
  printLine(runtime.stderr, pc.yellow(sql));
}

async function promptOutputSelection(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<OutputPromptSelection> {
  const selection = await select<"table" | "json" | "file">({
    message: "Output mode",
    choices: [
      {
        name: "table",
        value: "table",
        description: "Bounded terminal table output",
      },
      {
        name: "json stdout",
        value: "json",
        description: "Write full JSON results to stdout",
      },
      {
        name: "file output",
        value: "file",
        description: "Write full results to a .json or .csv file",
      },
    ],
  });

  if (selection === "table") {
    const rowsInput = await input({
      message: "Rows to show (optional)",
      default: "",
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return true;
        }
        const parsed = Number(trimmed);
        return Number.isInteger(parsed) && parsed > 0 ? true : "Enter a positive integer.";
      },
    });
    return {
      rows: rowsInput.trim().length > 0 ? Number(rowsInput) : undefined,
    };
  }

  if (selection === "json") {
    return {
      json: true,
      pretty: await confirm({ message: "Pretty-print JSON?", default: true }),
    };
  }

  const target = await promptFileOutputTarget({
    runtime,
    pathPromptContext,
    message: "Output file path",
    allowedExtensions: [".json", ".csv"],
    invalidExtensionMessage: "Output file must end with .json or .csv.",
  });

  const pretty = target.extension === ".json"
    ? await confirm({ message: "Pretty-print JSON?", default: true })
    : undefined;

  return {
    output: target.output,
    overwrite: target.overwrite,
    pretty,
  };
}

export async function executeInteractiveCandidate(
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
    sql: string;
  },
): Promise<"executed" | "revise"> {
  renderCandidateSql(runtime, options.sql);
  const confirmed = await confirm({ message: "Execute this SQL?", default: true });
  if (!confirmed) {
    return "revise";
  }

  while (true) {
    const outputOptions = await promptOutputSelection(runtime, pathPromptContext);
    try {
      await actionDataQuery(runtime, {
        input: options.input,
        inputFormat: options.format,
        json: outputOptions.json,
        output: outputOptions.output,
        overwrite: outputOptions.overwrite,
        pretty: outputOptions.pretty,
        rows: outputOptions.rows,
        ...(options.headerMappings ? { headerMappings: options.headerMappings } : {}),
        ...(options.selectedBodyStartRow !== undefined ? { bodyStartRow: options.selectedBodyStartRow } : {}),
        ...(options.selectedHeaderRow !== undefined ? { headerRow: options.selectedHeaderRow } : {}),
        ...(options.selectedRange ? { range: options.selectedRange } : {}),
        ...(options.selectedSource ? { source: options.selectedSource } : {}),
        sql: options.sql,
      });
      return "executed";
    } catch (error) {
      if (isOutputExistsError(error)) {
        runtime.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        continue;
      }
      if (!isDataQuerySqlExecutionError(error)) {
        throw error;
      }
      runtime.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      return "revise";
    }
  }
}
