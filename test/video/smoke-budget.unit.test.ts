import { describe, expect, test } from "bun:test";
import {
  checkSmokeProgress,
  preflightSmokeCase,
  SMOKE_LIMITS,
} from "../../scripts/spikes/video-frames/smoke-budget";

describe("development video smoke budget", () => {
  test("counts an end-exclusive cadence without truncation", () => {
    expect(
      preflightSmokeCase({ durationSeconds: 300, fpsNumerator: 1, estimatedScratchBytes: 1 }),
    ).toBe(300);
    expect(
      preflightSmokeCase({
        durationSeconds: 3,
        fpsNumerator: 1,
        fpsDenominator: 2,
        estimatedScratchBytes: 1,
      }),
    ).toBe(2);
  });
  test("rejects dense output and cumulative exhaustion", () => {
    expect(() =>
      preflightSmokeCase({ durationSeconds: 300, fpsNumerator: 15, estimatedScratchBytes: 1 }),
    ).toThrow("incomplete");
    expect(() =>
      preflightSmokeCase({
        durationSeconds: 300,
        fpsNumerator: 1,
        previousImages: 1_201,
        estimatedScratchBytes: 1,
      }),
    ).toThrow("incomplete");
  });
  test("rejects invalid estimates and the monitored disk threshold", () => {
    for (const estimate of [-1, NaN, Infinity, 0.5, SMOKE_LIMITS.scratchBytes])
      expect(() =>
        preflightSmokeCase({
          durationSeconds: 30,
          fpsNumerator: 1,
          estimatedScratchBytes: estimate,
        }),
      ).toThrow();
  });
  test("reports incomplete verification when observed time or disk is exhausted", () => {
    checkSmokeProgress({ caseElapsedMs: 1, runElapsedMs: 1, scratchBytes: 1 });
    for (const limit of [
      { caseElapsedMs: SMOKE_LIMITS.caseMs, runElapsedMs: 1, scratchBytes: 1 },
      { caseElapsedMs: 1, runElapsedMs: SMOKE_LIMITS.runMs, scratchBytes: 1 },
      { caseElapsedMs: 1, runElapsedMs: 1, scratchBytes: SMOKE_LIMITS.scratchBytes },
    ])
      expect(() => checkSmokeProgress(limit)).toThrow("incomplete");
  });
});
