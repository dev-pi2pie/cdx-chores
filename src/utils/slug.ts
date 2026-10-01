export function slugifyName(value: string, fallback = "file"): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\p{ASCII}]/gu, "")
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

export function normalizeRenderedBaseName(value: string, fallback = "file"): string {
  const sanitized = value
    .replace(/[\p{Cc}<>:"/\\|?*]/gu, "-")
    .replace(/\s+/g, " ")
    .replace(/--+/g, "-")
    .replace(/__+/g, "_")
    .replace(/-_+/g, "-")
    .replace(/_-+/g, "-")
    .replace(/^[-_.\s]+|[-_.\s]+$/g, "");
  return sanitized || fallback;
}
