/** Frozen thresholds for whole-package resource fixtures; production uses separate reader limits. */
export const PROPOSED_DOCX_BUDGETS = {
  compressedInputBytes: 8 * 1024 * 1024,
  entryCount: 256,
  maxPartDecompressedBytes: 1024 * 1024,
  totalDecompressedBytes: 4 * 1024 * 1024,
  xmlElementCount: 100_000,
  maxXmlDepth: 64,
  maxStyleTraversalSteps: 128,
  elapsedMilliseconds: 5_000,
  peakRssBytes: 256 * 1024 * 1024,
} as const;

export function countXmlDimensions(
  xml: string,
  checkDepth?: (depth: number) => void,
): { elementCount: number; maxDepth: number } {
  // A forward-only scan avoids regex backtracking on bounded but malformed XML.
  // This is instrumentation only; validation and content interpretation are separate.
  let depth = 0;
  let elementCount = 0;
  let maxDepth = 0;
  let cursor = 0;
  while (cursor < xml.length) {
    const start = xml.indexOf("<", cursor);
    if (start < 0) break;
    const ignoredEnd = xml.startsWith("<!--", start)
      ? "-->"
      : xml.startsWith("<![CDATA[", start)
        ? "]]>"
        : xml.startsWith("<?", start)
          ? "?>"
          : undefined;
    if (ignoredEnd) {
      const end = xml.indexOf(ignoredEnd, start + 2);
      if (end < 0) break;
      cursor = end + ignoredEnd.length;
      continue;
    }
    let quote: string | undefined;
    let end = start + 1;
    for (; end < xml.length; end += 1) {
      const character = xml[end];
      if (quote) {
        if (character === quote) quote = undefined;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      }
    }
    if (end === xml.length) break;
    cursor = end + 1;
    if (xml[start + 1] === "!") continue;
    if (xml[start + 1] === "/") {
      depth = Math.max(0, depth - 1);
    } else if (/[A-Za-z_:]/.test(xml[start + 1] ?? "")) {
      elementCount += 1;
      maxDepth = Math.max(maxDepth, depth + 1);
      checkDepth?.(maxDepth);
      if (xml[end - 1] !== "/") depth += 1;
    }
  }
  return { elementCount, maxDepth };
}
