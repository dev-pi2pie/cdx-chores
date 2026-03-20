import { confirm, input, select } from "@inquirer/prompts";

import type { DataHeaderMappingEntry } from "../../../duckdb/header-mapping";
import { quoteSqlIdentifier, type DataQueryInputFormat, type DataQuerySourceIntrospection } from "../../../duckdb/query";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";
import { executeInteractiveCandidate } from "../execution";
import type { FormalGuideAnswers, FormalGuideAggregateKind, FormalGuideFilterOperator, OrderBySpec } from "../types";

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

  const filters = [];
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
): Promise<void> {
  while (true) {
    const answers = await promptFormalGuideAnswers(options.introspection);
    const sql = buildFormalGuideSql(answers);
    const result = await executeInteractiveCandidate(runtime, pathPromptContext, {
      format: options.format,
      headerMappings: options.headerMappings,
      input: options.input,
      selectedBodyStartRow: options.selectedBodyStartRow,
      selectedHeaderRow: options.selectedHeaderRow,
      selectedNoHeader: options.selectedNoHeader,
      selectedRange: options.selectedRange,
      selectedSource: options.selectedSource,
      sql,
    });
    if (result === "executed") {
      return;
    }
  }
}
