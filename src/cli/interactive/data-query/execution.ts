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
import type {
  DataQueryReviewMode,
  ExecuteInteractiveCandidateResult,
  OutputPromptSelection,
} from "./types";

function isDataQuerySqlExecutionError(error: unknown): boolean {
  return (
    error instanceof CliError &&
    (error.code === "DATA_QUERY_FAILED" ||
      (error.code === "INVALID_INPUT" &&
        /data query requires a sql statement that returns rows/i.test(error.message)))
  );
}

function isOutputExistsError(error: unknown): boolean {
  return error instanceof CliError ||
    (typeof error === "object" && error !== null && "code" in error)
    ? (error as { code?: unknown }).code === "OUTPUT_EXISTS"
    : false;
}

function renderCandidateSql(runtime: CliRuntime, sql: string, sqlLimit?: number): void {
  const pc = getCliColors(runtime);
  printLine(runtime.stderr, "");
  printLine(runtime.stderr, `${pc.bold(pc.green("SQL"))}:`);
  printLine(runtime.stderr, pc.yellow(sql));
  if (sqlLimit !== undefined) {
    printLine(runtime.stderr, `${pc.bold(pc.cyan("SQL limit"))}: ${sqlLimit}`);
  }
}

function renderOutputReview(runtime: CliRuntime, options: { rows?: number; sqlLimit?: number }): void {
  const pc = getCliColors(runtime);
  printLine(runtime.stderr, "");
  printLine(
    runtime.stderr,
    `${pc.bold(pc.cyan("Table preview rows"))}: ${options.rows ?? "default bounded"}`,
  );
  if (options.sqlLimit !== undefined) {
    printLine(runtime.stderr, `${pc.bold(pc.cyan("SQL limit"))}: ${options.sqlLimit}`);
  }
}

async function promptCandidateReviewOutcome(
  runtime: CliRuntime,
  options: {
    reviewMode: DataQueryReviewMode;
    sql: string;
    sqlLimit?: number;
  },
): Promise<Exclude<ExecuteInteractiveCandidateResult, "executed"> | "confirm"> {
  renderCandidateSql(runtime, options.sql, options.sqlLimit);
  const confirmed = await confirm({ message: "Execute this SQL?", default: true });
  if (confirmed) {
    return "confirm";
  }
  return await promptSqlReviewAction(options.reviewMode);
}

async function promptSqlReviewAction(
  mode: DataQueryReviewMode,
): Promise<Exclude<ExecuteInteractiveCandidateResult, "executed">> {
  if (mode === "manual") {
    return await select<"revise" | "change-mode" | "cancel">({
      message: "SQL review next step",
      choices: [
        { name: "Edit SQL", value: "revise" },
        { name: "Change mode", value: "change-mode" },
        { name: "Cancel", value: "cancel" },
      ],
    });
  }

  if (mode === "formal-guide") {
    return await select<"revise" | "change-mode" | "cancel">({
      message: "SQL review next step",
      choices: [
        { name: "Edit formal-guide answers", value: "revise" },
        { name: "Change mode", value: "change-mode" },
        { name: "Cancel", value: "cancel" },
      ],
    });
  }

  return await select<"revise" | "regenerate" | "change-mode" | "cancel">({
    message: "SQL review next step",
    choices: [
      { name: "Revise intent", value: "revise" },
      { name: "Regenerate SQL", value: "regenerate" },
      { name: "Change mode", value: "change-mode" },
      { name: "Cancel", value: "cancel" },
    ],
  });
}

async function promptOutputSelection(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<OutputPromptSelection> {
  const selection = await select<"table" | "json" | "file" | "back" | "cancel">({
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
      {
        name: "Back to SQL review",
        value: "back",
      },
      {
        name: "Cancel",
        value: "cancel",
      },
    ],
  });

  if (selection === "back") {
    return { kind: "back" };
  }

  if (selection === "cancel") {
    return { kind: "cancel" };
  }

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
      kind: "table",
      rows: rowsInput.trim().length > 0 ? Number(rowsInput) : undefined,
    };
  }

  if (selection === "json") {
    return {
      kind: "json",
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

  const pretty =
    target.extension === ".json"
      ? await confirm({ message: "Pretty-print JSON?", default: true })
      : undefined;

  return {
    kind: "file",
    output: target.output,
    overwrite: target.overwrite,
    pretty,
  };
}

async function runOutputSelectionLoop(
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
    sql: string;
    sqlLimit?: number;
    reviewMode: DataQueryReviewMode;
  },
): Promise<ExecuteInteractiveCandidateResult> {
  while (true) {
    const outputOptions = await promptOutputSelection(runtime, pathPromptContext);
    if (outputOptions.kind === "back") {
      return "revise";
    }
    if (outputOptions.kind === "cancel") {
      return "cancel";
    }
    if (outputOptions.kind === "table") {
      renderOutputReview(runtime, {
        rows: outputOptions.rows,
        sqlLimit: options.sqlLimit,
      });
    }

    try {
      await actionDataQuery(runtime, {
        input: options.input,
        inputFormat: options.format,
        json: outputOptions.kind === "json" ? outputOptions.json : undefined,
        output: outputOptions.kind === "file" ? outputOptions.output : undefined,
        overwrite: outputOptions.kind === "file" ? outputOptions.overwrite : undefined,
        pretty:
          outputOptions.kind === "json" || outputOptions.kind === "file"
            ? outputOptions.pretty
            : undefined,
        rows: outputOptions.kind === "table" ? outputOptions.rows : undefined,
        ...(options.headerMappings ? { headerMappings: options.headerMappings } : {}),
        ...(options.selectedBodyStartRow !== undefined
          ? { bodyStartRow: options.selectedBodyStartRow }
          : {}),
        ...(options.selectedHeaderRow !== undefined ? { headerRow: options.selectedHeaderRow } : {}),
        ...(options.selectedNoHeader ? { noHeader: true } : {}),
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
      return await promptSqlReviewAction(options.reviewMode);
    }
  }
}

export async function executeInteractiveCandidate(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: {
    format: DataQueryInputFormat;
    headerMappings?: DataHeaderMappingEntry[];
    input: string;
    reviewMode: DataQueryReviewMode;
    selectedBodyStartRow?: number;
    selectedHeaderRow?: number;
    selectedNoHeader?: boolean;
    selectedRange?: string;
    selectedSource?: string;
    sql: string;
    sqlLimit?: number;
  },
): Promise<ExecuteInteractiveCandidateResult> {
  while (true) {
    const reviewOutcome = await promptCandidateReviewOutcome(runtime, {
      reviewMode: options.reviewMode,
      sql: options.sql,
      sqlLimit: options.sqlLimit,
    });
    if (reviewOutcome !== "confirm") {
      return reviewOutcome;
    }

    const executionOutcome = await runOutputSelectionLoop(runtime, pathPromptContext, options);
    if (executionOutcome === "revise") {
      continue;
    }
    return executionOutcome;
  }
}
