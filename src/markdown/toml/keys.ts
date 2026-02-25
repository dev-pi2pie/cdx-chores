function stripKeyQuotes(key: string): string {
  const trimmed = key.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function normalizeKeyPath(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = stripKeyQuotes(trimmed);
    return unquoted ? unquoted : null;
  }

  const segments = trimmed.split(".").map((segment) => segment.trim());
  if (segments.some((segment) => !segment)) {
    return null;
  }
  return segments.join(".");
}
