export function normalizeMarkdownPdfInteractiveFontHintText(value: string): string {
  return value.trim();
}

export function normalizeMarkdownPdfInteractiveFontHintFamilyName(value: string): string {
  return normalizeMarkdownPdfInteractiveFontHintText(value).toLowerCase();
}

export function compareMarkdownPdfInteractiveFontHintFamilies(left: string, right: string): number {
  const normalizedLeft = normalizeMarkdownPdfInteractiveFontHintFamilyName(left);
  const normalizedRight = normalizeMarkdownPdfInteractiveFontHintFamilyName(right);
  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft < normalizedRight ? -1 : 1;
  }
  return left === right ? 0 : left < right ? -1 : 1;
}
