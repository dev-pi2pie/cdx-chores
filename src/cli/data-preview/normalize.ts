export type JsonRow = Record<string, unknown>;

export function normalizeRowsFromJson(input: unknown): JsonRow[] {
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return [];
    }
    if (input.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))) {
      return input as JsonRow[];
    }
    return input.map((item) => ({ value: item }));
  }

  if (input !== null && typeof input === "object") {
    return [input as JsonRow];
  }

  return [{ value: input }];
}

export function collectFirstSeenColumns(rows: readonly JsonRow[]): string[] {
  const columns: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      columns.push(key);
    }
  }

  return columns;
}

export function stringifyPreviewValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value) || typeof value === "object") {
    const json = JSON.stringify(value);
    return json ?? "";
  }
  return String(value);
}
