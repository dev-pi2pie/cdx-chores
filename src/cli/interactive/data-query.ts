import { stat } from "node:fs/promises";
import { extname } from "node:path";

import { confirm, editor, input, select } from "@inquirer/prompts";

import { actionDataQuery, type DataQueryOptions } from "../actions";
import { printLine, displayPath } from "../actions/shared";
import { getCliColors } from "../colors";
import {
  buildDataQueryCodexIntentEditorTemplate,
  draftDataQueryWithCodex,
  normalizeDataQueryCodexEditorIntent,
  normalizeDataQueryCodexIntent,
} from "../data-query/codex";
import {
  DATA_QUERY_INPUT_FORMAT_VALUES,
  collectDataQuerySourceIntrospection,
  createDuckDbConnection,
  detectDataQueryInputFormat,
  listDataQuerySources,
  quoteSqlIdentifier,
  type DataQueryInputFormat,
  type DataQuerySourceIntrospection,
} from "../duckdb/query";
import { CliError } from "../errors";
import { resolveFromCwd } from "../fs-utils";
import { createInteractiveAnalyzerStatus } from "./analyzer-status";
import type { InteractivePathPromptContext } from "./shared";
import { promptRequiredPathWithConfig } from "../prompts/path";
import type { CliRuntime } from "../types";

const DATA_QUERY_INTERACTIVE_SAMPLE_ROWS = 5;

type DataQueryInteractiveMode = "manual" | "formal-guide" | "Codex Assistant";
type OutputPromptSelection = Pick<DataQueryOptions, "json" | "output" | "overwrite" | "pretty" | "rows">;
type FormalGuideFilterOperator = "=" | "!=" | ">" | ">=" | "<" | "<=" | "contains";
type FormalGuideAggregateKind = "none" | "count" | "sum" | "avg" | "min" | "max";

interface FormalGuideFilter {
  column: string;
  operator: FormalGuideFilterOperator;
  value: string;
}

interface FormalGuideAnswers {
  aggregateColumn?: string;
  aggregateKind: FormalGuideAggregateKind;
  filters: FormalGuideFilter[];
  groupByColumns: string[];
  orderBySpecs: OrderBySpec[];
  selectAllColumns: boolean;
  selectedColumns: string[];
}

interface OrderBySpec {
  column: string;
  direction: "asc" | "desc";
}

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

function escapeSqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function parseCommaSeparatedColumns(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function validateKnownColumns(value: string, allowedColumns: readonly string[]): true | string {
  const columns = parseCommaSeparatedColumns(value);
  if (columns.length === 0) {
    return "Enter one or more columns.";
  }

  for (const column of columns) {
    if (!allowedColumns.includes(column)) {
      return `Unknown column: ${column}.`;
    }
  }

  return true;
}

function parseOrderBySpecs(value: string, allowedColumns: readonly string[]): OrderBySpec[] {
  const specs: OrderBySpec[] = [];
  for (const rawToken of value.split(",").map((item) => item.trim()).filter((item) => item.length > 0)) {
    const parts = rawToken.split(":").map((part) => part.trim());
    const column = parts[0] ?? "";
    if (!allowedColumns.includes(column)) {
      throw new Error(`Unknown order-by column: ${column}.`);
    }

    const directionValue = (parts[1] ?? "asc").toLowerCase();
    if (directionValue !== "asc" && directionValue !== "desc") {
      throw new Error(`Invalid order direction for ${column}: ${directionValue}. Use asc or desc.`);
    }

    specs.push({
      column,
      direction: directionValue,
    });
  }

  return specs;
}

function getFormalGuideOrderableColumns(
  knownColumns: readonly string[],
  answers: Pick<FormalGuideAnswers, "aggregateKind" | "groupByColumns">,
): string[] {
  if (answers.aggregateKind === "none") {
    return [...knownColumns];
  }

  const aggregateAlias = answers.aggregateKind === "count" ? "row_count" : "summary_value";
  return [...new Set([...answers.groupByColumns, aggregateAlias])];
}

function buildFormalGuideSql(answers: FormalGuideAnswers): string {
  const statements: string[] = [];
  if (answers.aggregateKind === "none") {
    const selectClause = answers.selectAllColumns
      ? "*"
      : answers.selectedColumns.map((column) => quoteSqlIdentifier(column)).join(", ");
    statements.push(`select ${selectClause}`);
  } else {
    const groupByClause = answers.groupByColumns.map((column) => quoteSqlIdentifier(column));
    const aggregateExpression =
      answers.aggregateKind === "count"
        ? "count(*) as row_count"
        : `${answers.aggregateKind}(${quoteSqlIdentifier(answers.aggregateColumn ?? "")}) as summary_value`;
    statements.push(`select ${[...groupByClause, aggregateExpression].join(", ")}`);
  }

  statements.push("from file");

  if (answers.filters.length > 0) {
    const whereClause = answers.filters
      .map((filter) => {
        const column = quoteSqlIdentifier(filter.column);
        const value = escapeSqlString(filter.value);
        if (filter.operator === "contains") {
          return `lower(cast(${column} as varchar)) like '%' || lower(${value}) || '%'`;
        }
        return `${column} ${filter.operator} ${value}`;
      })
      .join(" and ");
    statements.push(`where ${whereClause}`);
  }

  if (answers.aggregateKind !== "none" && answers.groupByColumns.length > 0) {
    statements.push(`group by ${answers.groupByColumns.map((column) => quoteSqlIdentifier(column)).join(", ")}`);
  }

  if (answers.orderBySpecs.length > 0) {
    statements.push(
      `order by ${answers.orderBySpecs
        .map((spec) => `${quoteSqlIdentifier(spec.column)} ${spec.direction}`)
        .join(", ")}`,
    );
  }

  return statements.join("\n");
}

function renderIntrospectionSummary(
  runtime: CliRuntime,
  options: {
    format: DataQueryInputFormat;
    inputPath: string;
    introspection: DataQuerySourceIntrospection;
  },
): void {
  const pc = getCliColors(runtime);
  const lines = [
    `${pc.bold(pc.cyan("Input"))}: ${pc.white(displayPath(runtime, options.inputPath))}`,
    `${pc.bold(pc.cyan("Format"))}: ${pc.white(options.format)}`,
    ...(options.introspection.selectedSource
      ? [`${pc.bold(pc.cyan("Source"))}: ${pc.white(options.introspection.selectedSource)}`]
      : []),
    `${pc.bold(pc.cyan("Schema"))}:`,
    ...(options.introspection.columns.length > 0
      ? options.introspection.columns.map((column) => `- ${pc.bold(column.name)}: ${pc.dim(column.type)}`)
      : [`- ${pc.dim("(no columns available)")}`]),
    `${pc.bold(pc.cyan("Sample Rows"))}:`,
    ...(options.introspection.sampleRows.length > 0
      ? options.introspection.sampleRows.map(
          (row, index) => `- ${pc.dim(`${index + 1}.`)} ${pc.white(JSON.stringify(row))}`,
        )
      : [`- ${pc.dim("(no sample rows available)")}`]),
  ];

  for (const line of lines) {
    printLine(runtime.stdout, line);
  }
}

function renderCandidateSql(runtime: CliRuntime, sql: string): void {
  const pc = getCliColors(runtime);
  printLine(runtime.stdout, "");
  printLine(runtime.stdout, `${pc.bold(pc.green("SQL"))}:`);
  printLine(runtime.stdout, pc.yellow(sql));
}

function renderCodexIntentPreview(runtime: CliRuntime, intent: string): void {
  const pc = getCliColors(runtime);
  printLine(runtime.stdout, "");
  printLine(runtime.stdout, `${pc.bold(pc.cyan("Intent"))}: ${pc.white(intent)}`);
}

async function promptInteractiveInputFormat(
  runtime: CliRuntime,
  inputPath: string,
): Promise<DataQueryInputFormat> {
  let detected: DataQueryInputFormat | undefined;
  try {
    detected = detectDataQueryInputFormat(inputPath);
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }
  }

  if (!detected) {
    printLine(runtime.stdout, "Automatic format detection could not determine the query input type.");
    return await select<DataQueryInputFormat>({
      message: "Input format",
      choices: DATA_QUERY_INPUT_FORMAT_VALUES.map((format) => ({
        name: format,
        value: format,
      })),
    });
  }

  const useDetected = await confirm({
    message: `Use detected input format: ${detected}?`,
    default: true,
  });
  if (useDetected) {
    return detected;
  }

  return await select<DataQueryInputFormat>({
    message: "Override input format",
    choices: DATA_QUERY_INPUT_FORMAT_VALUES.map((format) => ({
      name: format,
      value: format,
    })),
  });
}

async function promptOptionalSourceSelection(
  format: DataQueryInputFormat,
  sources: readonly string[] | undefined,
): Promise<string | undefined> {
  if (!sources || sources.length === 0) {
    return undefined;
  }

  return await select<string>({
    message: format === "sqlite" ? "Choose a SQLite source" : "Choose an Excel sheet",
    choices: sources.map((source) => ({
      name: source,
      value: source,
    })),
  });
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

  let outputPath = "";
  let overwrite = false;
  while (true) {
    const nextPath = await promptRequiredPathWithConfig("Output file path", {
      kind: "file",
      ...pathPromptContext,
    });
    const extension = extname(nextPath).toLowerCase();
    if (extension === ".json" || extension === ".csv") {
      outputPath = nextPath;
      const normalizedOutputPath = resolveFromCwd(runtime, outputPath);
      try {
        await stat(normalizedOutputPath);
        overwrite = await confirm({ message: "Overwrite if exists?", default: false });
        if (overwrite) {
          break;
        }
        printLine(runtime.stdout, "Choose a different output file path.");
        continue;
      } catch {
        overwrite = false;
        break;
      }
    }
    printLine(runtime.stdout, "Output file must end with .json or .csv.");
  }

  const pretty = extname(outputPath).toLowerCase() === ".json"
    ? await confirm({ message: "Pretty-print JSON?", default: true })
    : undefined;

  return {
    output: outputPath,
    overwrite,
    pretty,
  };
}

async function executeInteractiveCandidate(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: {
    format: DataQueryInputFormat;
    input: string;
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
        source: options.selectedSource,
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

async function runManualInteractiveQuery(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: {
    format: DataQueryInputFormat;
    input: string;
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

async function promptFormalGuideAnswers(
  introspection: DataQuerySourceIntrospection,
): Promise<FormalGuideAnswers> {
  const knownColumns = introspection.columns.map((column) => column.name);
  const selectedColumnsInput = await input({
    message: "Columns to select (`all` or comma-separated)",
    default: "all",
    validate: (value) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed.toLowerCase() === "all") {
        return true;
      }
      return validateKnownColumns(trimmed, knownColumns);
    },
  });

  const filters: FormalGuideFilter[] = [];
  let addAnotherFilter = await confirm({ message: "Add a filter?", default: false });
  while (addAnotherFilter) {
    const column = await select<string>({
      message: "Filter column",
      choices: knownColumns.map((name) => ({ name, value: name })),
    });
    const operator = await select<FormalGuideFilterOperator>({
      message: "Filter operator",
      choices: [
        { name: "=", value: "=" },
        { name: "!=", value: "!=" },
        { name: ">", value: ">" },
        { name: ">=", value: ">=" },
        { name: "<", value: "<" },
        { name: "<=", value: "<=" },
        { name: "contains", value: "contains" },
      ],
    });
    const value = await input({
      message: "Filter value",
      validate: (nextValue) => (nextValue.trim().length > 0 ? true : "Enter a filter value."),
    });
    filters.push({
      column,
      operator,
      value: value.trim(),
    });
    addAnotherFilter = await confirm({ message: "Add another filter?", default: false });
  }

  const aggregateKind = await select<FormalGuideAggregateKind>({
    message: "Aggregate summary",
    choices: [
      { name: "none", value: "none" },
      { name: "count rows", value: "count" },
      { name: "sum column", value: "sum" },
      { name: "average column", value: "avg" },
      { name: "minimum column", value: "min" },
      { name: "maximum column", value: "max" },
    ],
  });

  let aggregateColumn: string | undefined;
  let groupByColumns: string[] = [];
  if (aggregateKind !== "none") {
    if (aggregateKind !== "count") {
      aggregateColumn = await select<string>({
        message: "Aggregate column",
        choices: knownColumns.map((name) => ({ name, value: name })),
      });
    }

    const groupByInput = await input({
      message: "Group by columns (comma-separated, optional)",
      default: "",
      validate: (value) => {
        const trimmed = value.trim();
        if (!trimmed) {
          return true;
        }
        return validateKnownColumns(trimmed, knownColumns);
      },
    });
    groupByColumns = parseCommaSeparatedColumns(groupByInput);
  }

  const allowedOrderByColumns = getFormalGuideOrderableColumns(knownColumns, {
    aggregateKind,
    groupByColumns,
  });

  const orderByInput = await input({
    message: "Order by (column[:asc|desc], comma-separated, optional)",
    default: "",
    validate: (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return true;
      }
      try {
        parseOrderBySpecs(trimmed, allowedOrderByColumns);
        return true;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
  });

  const selectedColumns = parseCommaSeparatedColumns(selectedColumnsInput);
  return {
    aggregateColumn,
    aggregateKind,
    filters,
    groupByColumns,
    orderBySpecs:
      orderByInput.trim().length > 0 ? parseOrderBySpecs(orderByInput, allowedOrderByColumns) : [],
    selectedColumns,
    selectAllColumns:
      selectedColumnsInput.trim().length === 0 || selectedColumnsInput.trim().toLowerCase() === "all",
  };
}

async function runFormalGuideInteractiveQuery(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: {
    format: DataQueryInputFormat;
    input: string;
    introspection: DataQuerySourceIntrospection;
    selectedSource?: string;
  },
): Promise<void> {
  while (true) {
    const answers = await promptFormalGuideAnswers(options.introspection);
    const sql = buildFormalGuideSql(answers);
    const result = await executeInteractiveCandidate(runtime, pathPromptContext, {
      format: options.format,
      input: options.input,
      selectedSource: options.selectedSource,
      sql,
    });
    if (result === "executed") {
      return;
    }
  }
}

async function runCodexInteractiveQuery(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  options: {
    format: DataQueryInputFormat;
    input: string;
    introspection: DataQuerySourceIntrospection;
    selectedSource?: string;
  },
): Promise<void> {
  let lastIntent = "";
  let preferMultilineEditor = false;

  while (true) {
    const useMultilineEditor = await confirm({
      message: "Use multiline editor?",
      default: preferMultilineEditor,
    });
    preferMultilineEditor = useMultilineEditor;
    const intent = useMultilineEditor
      ? await (async (): Promise<string> => {
          while (true) {
            const intentValue = await editor({
              default: buildDataQueryCodexIntentEditorTemplate({
                format: options.format,
                intent: lastIntent,
                introspection: options.introspection,
              }),
              message: "Describe the query intent",
              postfix: ".md",
              validate: (value) =>
                normalizeDataQueryCodexEditorIntent(value).length > 0 ? true : "Enter a query intent.",
            });
            const cleanedIntent = normalizeDataQueryCodexEditorIntent(intentValue);
            renderCodexIntentPreview(runtime, cleanedIntent);
            const confirmed = await confirm({
              message: "Send this intent to Codex drafting?",
              default: true,
            });
            if (confirmed) {
              return cleanedIntent;
            }
            lastIntent = cleanedIntent;
          }
        })()
      : normalizeDataQueryCodexIntent(
          await input({
            default: lastIntent,
            message: "Describe the query intent",
            validate: (value) =>
              normalizeDataQueryCodexIntent(value).length > 0 ? true : "Enter a query intent.",
          }),
        );
    lastIntent = intent;

    while (true) {
      const statusStream = runtime.stdout as NodeJS.WritableStream & { isTTY?: boolean };
      const status = statusStream.isTTY
        ? createInteractiveAnalyzerStatus(runtime.stdout, runtime.colorEnabled)
        : {
            start() {},
            update() {},
            wait() {},
            stop() {},
          };

      try {
        status.wait("Drafting SQL with Codex");
        const draftResult = await draftDataQueryWithCodex({
          format: options.format,
          intent,
          introspection: options.introspection,
          workingDirectory: runtime.cwd,
        });
        status.stop();

        if (!draftResult.draft) {
          printLine(runtime.stderr, `Codex drafting failed: ${draftResult.errorMessage ?? "Unknown error."}`);
        } else {
          const executionResult = await executeInteractiveCandidate(runtime, pathPromptContext, {
            format: options.format,
            input: options.input,
            selectedSource: options.selectedSource,
            sql: draftResult.draft.sql,
          });
          if (executionResult === "executed") {
            return;
          }
        }
      } finally {
        status.stop();
      }

      const nextStep = await select<"regenerate" | "revise" | "cancel">({
        message: "Codex Assistant next step",
        choices: [
          { name: "regenerate SQL", value: "regenerate" },
          { name: "revise intent", value: "revise" },
          { name: "cancel", value: "cancel" },
        ],
      });
      if (nextStep === "regenerate") {
        continue;
      }
      if (nextStep === "cancel") {
        return;
      }
      break;
    }
  }
}

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

  let connection;
  try {
    connection = await createDuckDbConnection();
    const sources = await listDataQuerySources(connection, inputPath, format);
    const selectedSource = await promptOptionalSourceSelection(format, sources);
    const introspection = await collectDataQuerySourceIntrospection(
      connection,
      inputPath,
      format,
      selectedSource,
      DATA_QUERY_INTERACTIVE_SAMPLE_ROWS,
    );
    renderIntrospectionSummary(runtime, {
      format,
      inputPath,
      introspection,
    });

    const mode = await select<DataQueryInteractiveMode>({
      message: "Choose mode",
      choices: [
        { name: "manual", value: "manual" },
        { name: "formal-guide", value: "formal-guide" },
        { name: "Codex Assistant", value: "Codex Assistant" },
      ],
    });

    if (mode === "manual") {
      await runManualInteractiveQuery(runtime, pathPromptContext, {
        format,
        input,
        selectedSource,
      });
      return;
    }

    if (mode === "formal-guide") {
      await runFormalGuideInteractiveQuery(runtime, pathPromptContext, {
        format,
        input,
        introspection,
        selectedSource,
      });
      return;
    }

    await runCodexInteractiveQuery(runtime, pathPromptContext, {
      format,
      input,
      introspection,
      selectedSource,
    });
  } finally {
    connection?.closeSync();
  }
}
