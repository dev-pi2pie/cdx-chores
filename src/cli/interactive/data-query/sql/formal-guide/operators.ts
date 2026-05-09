import type { FormalGuideFilterOperator } from "../../types";

export interface FormalGuideOperatorChoice {
  name: string;
  requiresValue: boolean;
  value: FormalGuideFilterOperator;
}

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

type FormalGuideColumnKind = "boolean" | "numeric" | "temporal" | "text" | "unknown";

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

export function renderFormalGuideFilterCondition(
  operator: FormalGuideFilterOperator,
  column: string,
  value?: string,
): string {
  return FORMAL_GUIDE_OPERATOR_SPECS[operator].render(column, value);
}
