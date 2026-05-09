import { confirm, input, select } from "@inquirer/prompts";

import type { DataQuerySourceIntrospection } from "../../../../duckdb/query";
import type {
  FormalGuideAggregateKind,
  FormalGuideAnswers,
  FormalGuideFilterOperator,
} from "../../types";
import { getFormalGuideFilterOperatorChoices } from "./operators";
import {
  getFormalGuideOrderableColumns,
  parseCommaSeparatedColumns,
  parseOrderBySpecs,
  validateKnownColumns,
} from "./sql-builder";

export async function promptFormalGuideAnswers(
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
