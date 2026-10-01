import { expectedSamplingTargets } from "./fixtures";

// Development smoke limits; these are not production source or cadence limits.
export const SMOKE_LIMITS = {
  caseMs: 300_000,
  runMs: 900_000,
  concurrentCases: 1,
  imagesPerCase: 1_000,
  imagesPerRun: 1_500,
  scratchBytes: 512 * 1024 * 1024,
} as const;

export function preflightSmokeCase(options: {
  durationSeconds: number;
  fpsNumerator: number;
  fpsDenominator?: number;
  previousImages?: number;
  estimatedScratchBytes: number;
}): number {
  const previous = options.previousImages ?? 0;
  if (
    !Number.isSafeInteger(previous) ||
    previous < 0 ||
    !Number.isSafeInteger(options.estimatedScratchBytes) ||
    options.estimatedScratchBytes < 0
  )
    throw new Error("Smoke estimates must be non-negative safe integers.");
  const images = expectedSamplingTargets(
    options.durationSeconds,
    options.fpsNumerator,
    options.fpsDenominator,
  );
  if (images > SMOKE_LIMITS.imagesPerCase || images + previous > SMOKE_LIMITS.imagesPerRun)
    throw new Error("Smoke image budget exceeded; verification is incomplete.");
  if (options.estimatedScratchBytes >= SMOKE_LIMITS.scratchBytes)
    throw new Error("Smoke scratch budget exceeded; verification is incomplete.");
  return images;
}

export function checkSmokeProgress(options: {
  caseElapsedMs: number;
  runElapsedMs: number;
  scratchBytes: number;
}): void {
  for (const value of Object.values(options)) {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error("Smoke observations must be non-negative safe integers.");
  }
  if (
    options.caseElapsedMs >= SMOKE_LIMITS.caseMs ||
    options.runElapsedMs >= SMOKE_LIMITS.runMs ||
    options.scratchBytes >= SMOKE_LIMITS.scratchBytes
  )
    throw new Error("Smoke budget exceeded; stop owned work and report incomplete verification.");
}
