/** Internal resource envelope accepted in Phase 7. */
export const DEFAULT_DOCX_LIMITS = {
  compressedInputBytes: 8 * 1024 * 1024,
  entryCount: 256,
  maxPartDecompressedBytes: 1024 * 1024,
  totalDecompressedBytes: 4 * 1024 * 1024,
  xmlElementCount: 100_000,
  maxXmlDepth: 64,
  maxStyleTraversalSteps: 128,
  elapsedMilliseconds: 5_000,
  peakRssBytes: 256 * 1024 * 1024,
  requestMetadataBytes: 4 * 1024,
  resultBytes: 8 * 1024 * 1024,
  rssSampleMilliseconds: 10,
  termGraceMilliseconds: 250,
  cleanupMilliseconds: 1_000,
} as const;

export type DocxLimits = { [Key in keyof typeof DEFAULT_DOCX_LIMITS]: number };

export class DocxLimitError extends Error {
  constructor(readonly limit: keyof DocxLimits) {
    super(`docx_limit:${limit}`);
  }
}

export function checkDocxLimit(value: number, limit: keyof DocxLimits, limits: DocxLimits): void {
  if (value > limits[limit]) throw new DocxLimitError(limit);
}

export function resolveDocxLimits(overrides: Partial<DocxLimits> = {}): DocxLimits {
  const limits = { ...DEFAULT_DOCX_LIMITS, ...overrides };
  const timers = new Set([
    "elapsedMilliseconds",
    "rssSampleMilliseconds",
    "termGraceMilliseconds",
    "cleanupMilliseconds",
  ]);
  for (const [key, value] of Object.entries(limits)) {
    if (
      !Object.hasOwn(DEFAULT_DOCX_LIMITS, key) ||
      !Number.isSafeInteger(value) ||
      value < (timers.has(key) ? 1 : 0) ||
      (timers.has(key) && value > 2_147_483_647)
    )
      throw new Error("docx_limits_invalid");
  }
  return limits;
}
