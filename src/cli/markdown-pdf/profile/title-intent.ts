export function hasExplicitKeepMetadataTitleIntent(intent: string): boolean {
  return /\b(keep|preserve|show|include)\s+(the\s+)?(metadata\s+)?(title block|title output|title page|duplicate title|frontmatter title)\b/i.test(
    intent,
  );
}

export function hasExplicitHideMetadataTitleIntent(intent: string): boolean {
  return /\b(hide|suppress|remove|skip|omit)\s+(the\s+)?(metadata\s+)?(title block|title output|frontmatter title)\b/i.test(
    intent,
  );
}
