export function ensureArrayContainer(
  result: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const existing = result[key];
  if (Array.isArray(existing)) {
    return existing as Record<string, unknown>[];
  }
  const list: Record<string, unknown>[] = [];
  result[key] = list;
  return list;
}

export function flattenArrayTables(result: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(result)) {
    if (!Array.isArray(value)) {
      continue;
    }
    const flattened = value
      .map((entry) =>
        Object.entries(entry)
          .map(([entryKey, entryValue]) => `${entryKey}=${entryValue}`)
          .join(", "),
      )
      .join(" | ");
    result[key] = flattened;
  }
}
