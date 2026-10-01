// Expectations are declared independently of the production frame resolver.
// These recipes describe future explicit media experiments; importing this file generates nothing.
export const SYNTHETIC_SCAN_RECIPES = [
  { id: "scan-30s", durationSeconds: 30, width: 320, height: 180, sourceFps: 15, frames: 450 },
  { id: "scan-120s", durationSeconds: 120, width: 320, height: 180, sourceFps: 15, frames: 1_800 },
  { id: "scan-300s", durationSeconds: 300, width: 320, height: 180, sourceFps: 15, frames: 4_500 },
] as const;

export interface SyntheticTimingFixture {
  id: string;
  metadataDurationMs: number | null;
  metadataFrameCount: number | null;
  absoluteStartsMs: readonly (number | null)[];
  verifiedFrameCount: number;
  reliableEndMs: number | null;
  timeQueries: readonly { relativeMs: number; expectedOrdinal: number }[];
  firstLast: readonly [number, number];
  firstMiddleLast: readonly [number, number, number] | null;
}

export const SMALL_TIMING_FIXTURES: readonly SyntheticTimingFixture[] = [
  {
    id: "constant-rate-unknown-count",
    metadataDurationMs: 4_000,
    metadataFrameCount: null,
    absoluteStartsMs: [0, 1_000, 2_000, 3_000],
    verifiedFrameCount: 4,
    reliableEndMs: 4_000,
    timeQueries: [
      { relativeMs: 0, expectedOrdinal: 1 },
      { relativeMs: 999, expectedOrdinal: 1 },
      { relativeMs: 1_000, expectedOrdinal: 2 },
      { relativeMs: 1_001, expectedOrdinal: 2 },
      { relativeMs: 2_000, expectedOrdinal: 3 },
      { relativeMs: 3_999, expectedOrdinal: 4 },
    ],
    firstLast: [1, 4],
    firstMiddleLast: [1, 3, 4],
  },
  {
    id: "shifted-variable-timing",
    metadataDurationMs: 3_000,
    metadataFrameCount: 4,
    absoluteStartsMs: [5_000, 5_100, 6_200, 7_700],
    verifiedFrameCount: 4,
    reliableEndMs: 3_000,
    timeQueries: [
      { relativeMs: 99, expectedOrdinal: 1 },
      { relativeMs: 100, expectedOrdinal: 2 },
      { relativeMs: 1_234, expectedOrdinal: 3 },
      { relativeMs: 1_500, expectedOrdinal: 3 },
      { relativeMs: 2_699, expectedOrdinal: 3 },
      { relativeMs: 2_700, expectedOrdinal: 4 },
    ],
    firstLast: [1, 4],
    firstMiddleLast: [1, 3, 4],
  },
  {
    id: "repeated-preset-roles",
    metadataDurationMs: 2_000,
    metadataFrameCount: 1,
    absoluteStartsMs: [0],
    verifiedFrameCount: 1,
    reliableEndMs: 2_000,
    timeQueries: [{ relativeMs: 1_000, expectedOrdinal: 1 }],
    firstLast: [1, 1],
    firstMiddleLast: [1, 1, 1],
  },
  {
    id: "unknown-duration-and-end",
    metadataDurationMs: null,
    metadataFrameCount: null,
    absoluteStartsMs: [0, 125, 900],
    verifiedFrameCount: 3,
    reliableEndMs: null,
    timeQueries: [
      { relativeMs: 124, expectedOrdinal: 1 },
      { relativeMs: 125, expectedOrdinal: 2 },
      { relativeMs: 899, expectedOrdinal: 2 },
    ],
    firstLast: [1, 3],
    firstMiddleLast: null,
  },
  {
    id: "missing-timing-frame-ordinals-only",
    metadataDurationMs: null,
    metadataFrameCount: null,
    absoluteStartsMs: [null, null],
    verifiedFrameCount: 2,
    reliableEndMs: null,
    timeQueries: [],
    firstLast: [1, 2],
    firstMiddleLast: null,
  },
];

export function expectedConstantFrameStart(frameNumber: number): {
  numerator: bigint;
  denominator: bigint;
} {
  if (!Number.isSafeInteger(frameNumber) || frameNumber < 1) {
    throw new Error("Synthetic frame number must be a positive safe integer.");
  }
  return { numerator: BigInt(frameNumber - 1), denominator: 15n };
}

// Duration is an integer number of seconds; a target at the reliable end is excluded.
export function expectedSamplingTargets(
  durationSeconds: number,
  rateNumerator: number,
  rateDenominator = 1,
): number {
  for (const value of [durationSeconds, rateNumerator, rateDenominator]) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error("Synthetic sampling inputs must be positive safe integers.");
    }
  }
  const denominator = BigInt(rateDenominator);
  const count = (BigInt(durationSeconds) * BigInt(rateNumerator) + denominator - 1n) / denominator;
  if (count > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Synthetic output count exceeds a safe integer.");
  }
  return Number(count);
}
