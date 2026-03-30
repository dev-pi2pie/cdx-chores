import { confirm, input, select } from "@inquirer/prompts";

import type { DataHeaderMappingEntry } from "../../../duckdb/header-mapping";
import {
  quoteSqlIdentifier,
  type DataQueryInputFormat,
  type DataQuerySourceIntrospection,
} from "../../../duckdb/query";
import type { CliRuntime } from "../../../types";
import type { InteractivePathPromptContext } from "../../shared";
import { executeInteractiveCandidate } from "../execution";
import type {
  FormalGuideAnswers,
  FormalGuideAggregateKind,
  FormalGuideFilterOperator,
  InteractiveQueryRunResult,
  OrderBySpec,
} from "../types";

interface FormalGuideOperatorChoice {
  name: string;
  requiresValue: boolean;
  value: FormalGuideFilterOperator;
}

type FormalGuideColumnKind = "boolean" | "numeric" | "temporal" | "text" | "unknown";

interface FormalGuideOperatorSpec {
  label: string;
  requiresValue: boolean;
  render: (column: string, value?: string) => string;
}

const FORMAL_GUIDE_OPERATOR_SPECS: Record<FormalGuideFilterOperator, FormalGuideOperatorSpec> = {
  "=": {
    label: "=",
    requiresValue: true,
    render: (column, value) => `${column} = ${value ?? "''"}`,
  },
  "!=": {
    label: "!=",
    requiresValue: true,
    render: (column, value) => `${column} != ${value ?? "''"}`,
  },
  ">": {
    label: ">",
    requiresValue: true,
    render: (column, value) => `${column} > ${value ?? "''"}`,
  },
  ">=": {
    label: ">=",
    requiresValue: true,
    render: (column, value) => `${column} >= ${value ?? "''"}`,
  },
  "<": {
    label: "<",
    requiresValue: true,
    render: (column, value) => `${column} < ${value ?? "''"}`,
  },
  "<=": {
    label: "<=",
    requiresValue: true,
    render: (column, value) => `${column} <= ${value ?? "''"}`,
  },
  contains: {
    label: "contains",
    requiresValue: true,
    render: (column, value) =>
      `lower(cast(${column} as varchar)) like '%' || lower(${value ?? "''"}) || '%'`,
  },
  "starts-with": {
    label: "starts with",
    requiresValue: true,
    render: (column, value) =>
      `lower(cast(${column} as varchar)) like lower(${value ?? "''"}) || '%'`,
  },
  "ends-with": {
    label: "ends with",
    requiresValue: true,
    render: (column, value) =>
      `lower(cast(${column} as varchar)) like '%' || lower(${value ?? "''"})`,
  },
  "is-null": {
    label: "is null",
    requiresValue: false,
    render: (column) => `${column} is null`,
  },
  "is-not-null": {
    label: "is not null",
    requiresValue: false,
    render: (column) => `${column} is not null`,
  },
  "is-true": {
    label: "is true",
    requiresValue: false,
    render: (column) => `${column} is true`,
  },
  "is-false": {
    label: "is false",
    requiresValue: false,
    render: (column) => `${column} is false`,
  },
  "is-empty": {
    label: "is empty",
    requiresValue: false,
    render: (column) => `cast(${column} as varchar) = ''`,
  },
  "is-not-empty": {
    label: "is not empty",
    requiresValue: false,
    render: (column) => `cast(${column} as varchar) <> ''`,
  },
};

function buildFormalGuideOperatorChoices(
  values: FormalGuideFilterOperator[],
): FormalGuideOperatorChoice[] {
  return values.map((value) => {
    const spec = FORMAL_GUIDE_OPERATOR_SPECS[value];
    return {
      name: spec.label,
      requiresValue: spec.requiresValue,
      value,
    };
  });
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
  for (const rawToken of value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)) {
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

function classifyFormalGuideColumnKind(typeName: string | undefined): FormalGuideColumnKind {
  const normalized = typeName?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return "unknown";
  }

  if (normalized.includes("bool")) {
    return "boolean";
  }

  if (
    normalized.includes("date") ||
    normalized.includes("time") ||
    normalized.includes("interval")
  ) {
    return "temporal";
  }

  if (
    normalized.includes("int") ||
    normalized.includes("dec") ||
    normalized.includes("num") ||
    normalized.includes("double") ||
    normalized.includes("real") ||
    normalized.includes("float")
  ) {
    return "numeric";
  }

  if (
    normalized.includes("char") ||
    normalized.includes("text") ||
    normalized.includes("string") ||
    normalized.includes("json") ||
    normalized.includes("uuid")
  ) {
    return "text";
  }

  return "unknown";
}

export function getFormalGuideFilterOperatorChoices(
  columnType: string | undefined,
): FormalGuideOperatorChoice[] {
  const columnKind = classifyFormalGuideColumnKind(columnType);
  const nullOperators: FormalGuideFilterOperator[] = ["is-null", "is-not-null"];

  if (columnKind === "boolean") {
    return buildFormalGuideOperatorChoices(["is-true", "is-false", ...nullOperators]);
  }

  if (columnKind === "text") {
    return buildFormalGuideOperatorChoices([
      "=",
      "!=",
      "contains",
      "starts-with",
      "ends-with",
      "is-empty",
      "is-not-empty",
      ...nullOperators,
    ]);
  }

  if (columnKind === "numeric" || columnKind === "temporal") {
    return buildFormalGuideOperatorChoices(["=", "!=", ">", ">=", "<", "<=", ...nullOperators]);
  }

  return buildFormalGuideOperatorChoices([
    "=",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "contains",
    "starts-with",
    "ends-with",
    "is-empty",
    "is-not-empty",
    ...nullOperators,
  ]);
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

export function buildFormalGuideSql(answers: FormalGuideAnswers): string {
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
        const value = filter.value === undefined ? undefined : escapeSqlString(filter.value);
        return FORMAL_GUIDE_OPERATOR_SPECS[filter.operator].render(column, value);
      })
      .join(" and ");
    statements.push(`where ${whereClause}`);
  }

  if (answers.aggregateKind !== "none" && answers.groupByColumns.length > 0) {
    statements.push(
      `group by ${answers.groupByColumns.map((column) => quoteSqlIdentifier(column)).join(", ")}`,
    );
  }

  if (answers.orderBySpecs.length > 0) {
    statements.push(
      `order by ${answers.orderBySpecs
        .map((spec) => `${quoteSqlIdentifier(spec.column)} ${spec.direction}`)
        .join(", ")}`,
    );
  }

  if (answers.limit !== undefined) {
    statements.push(`limit ${answers.limit}`);
  }

  return statements.join("\n");
}

async function promptFormalGuideAnswers(
  introspection: DataQuerySourceIntrospection,
): Promise<FormalGuideAnswers> {
  const columns = introspection.columns;
  const knownColumns = columns.map((column) => column.name);
  const columnTypes = new Map(columns.map((column) => [column.name, column.type]));
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
      choices: columns.map((entry) => ({
        name: `${entry.name} (${entry.type})`,
        value: entry.name,
      })),
    });
    const operatorChoices = getFormalGuideFilterOperatorChoices(columnTypes.get(column));
    const operator = await select<FormalGuideFilterOperator>({
      message: "Filter operator",
      choices: operatorChoices.map((choice) => ({ name: choice.name, value: choice.value })),
    });
    const selectedOperator = operatorChoices.find((choice) => choice.value === operator);
    const value = selectedOperator?.requiresValue
      ? await input({
          message: "Filter value",
          validate: (nextValue) => (nextValue.trim().length > 0 ? true : "Enter a filter value."),
        })
      : undefined;
    filters.push({
      column,
      operator,
      ...(value !== undefined ? { value: value.trim() } : {}),
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

  const limitInput = await input({
    message: "Maximum result rows (optional)",
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

  const selectedColumns = parseCommaSeparatedColumns(selectedColumnsInput);
  return {
    aggregateColumn,
    aggregateKind,
    filters,
    groupByColumns,
    limit: limitInput.trim().length > 0 ? Number(limitInput) : undefined,
    orderBySpecs:
      orderByInput.trim().length > 0 ? parseOrderBySpecs(orderByInput, allowedOrderByColumns) : [],
    selectedColumns,
    selectAllColumns:
      selectedColumnsInput.trim().length === 0 ||
      selectedColumnsInput.trim().toLowerCase() === "all",
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
