export function slugifyName(value: string, fallback = "file"): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function withNumericSuffix(value: string, index: number): string {
  if (index <= 0) {
    return value;
  }
  return `${value}-${String(index).padStart(2, "0")}`;
}

