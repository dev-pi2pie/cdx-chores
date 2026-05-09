import { quoteSqlIdentifier } from "../../../../duckdb/query";
import type { FormalGuideAnswers, OrderBySpec } from "../../types";
import { renderFormalGuideFilterCondition } from "./operators";

function escapeSqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function parseCommaSeparatedColumns(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function validateKnownColumns(
  value: string,
  allowedColumns: readonly string[],
): true | string {
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

export function parseOrderBySpecs(value: string, allowedColumns: readonly string[]): OrderBySpec[] {
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

export function getFormalGuideOrderableColumns(
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
        return renderFormalGuideFilterCondition(filter.operator, column, value);
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
