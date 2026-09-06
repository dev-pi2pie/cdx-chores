import { describe, expect, test } from "bun:test";

import type { DiscoverFontsResult, FontFace } from "../../../src/fonts";
import {
  collectFontDiscoveryEvidence,
  parseEvidenceSpikeArgs,
  summarizeDurations,
} from "../../../scripts/spikes/markdown-pdf-font-discovery-evidence-spike";

function sensitiveFace(): FontFace {
  return {
    family: "Private Family",
    fullName: "Private Family Regular",
    style: "normal",
    path: "/private/fonts/private-family.ttf",
    source: "system",
  };
}

function discoveryResult(
  status: "success" | "failed" | "timeout",
  durationMs: number,
  emptyResult = false,
): DiscoverFontsResult {
  return {
    faces: status === "success" && !emptyResult ? [sensitiveFace()] : [],
    warnings: status === "success" ? [] : ["/private/raw command error"],
    adapter: "fontconfig",
    discovery: "fontconfig",
    attempts: [
      {
        adapter: "fontconfig",
        command: "fc-list",
        status,
        durationMs,
        message:
          status === "success"
            ? "fontconfig discovery succeeded."
            : status === "timeout"
              ? "fontconfig discovery timed out."
              : "fc-list was not available or failed.",
      },
    ],
  };
}

describe("Markdown PDF font discovery evidence spike", () => {
  test("defaults to 30 runs and requires an explicit timeout", () => {
    expect(parseEvidenceSpikeArgs(["--timeout-ms", "10000"])).toEqual({
      runs: 30,
      timeoutMs: 10_000,
    });
    expect(parseEvidenceSpikeArgs(["--runs", "3", "--timeout-ms", "1000"])).toEqual({
      runs: 3,
      timeoutMs: 1_000,
    });
    expect(parseEvidenceSpikeArgs(["--timeout-ms", "2147483647"])).toEqual({
      runs: 30,
      timeoutMs: 2_147_483_647,
    });
    expect(() => parseEvidenceSpikeArgs([])).toThrow("--timeout-ms is required.");
  });

  test("rejects malformed, duplicate, unsafe, and unknown arguments", () => {
    const invalidArguments = [
      ["--runs", "0", "--timeout-ms", "1000"],
      ["--runs", "-1", "--timeout-ms", "1000"],
      ["--runs", "1.5", "--timeout-ms", "1000"],
      ["--runs", "9007199254740992", "--timeout-ms", "1000"],
      ["--runs", "--timeout-ms", "1000"],
      ["--timeout-ms", "0"],
      ["--timeout-ms", "2147483648"],
      ["--timeout-ms", "1000", "--timeout-ms", "3000"],
      ["--unknown", "1", "--timeout-ms", "1000"],
    ];

    for (const args of invalidArguments) {
      expect(() => parseEvidenceSpikeArgs(args)).toThrow();
    }
  });

  test("uses documented nearest-rank percentiles", () => {
    expect(summarizeDurations([])).toEqual({
      sampleCount: 0,
      p50: null,
      p95: null,
      max: null,
    });
    expect(summarizeDurations([40, 10, 30, 20])).toEqual({
      sampleCount: 4,
      p50: 20,
      p95: 40,
      max: 40,
    });
    expect(summarizeDurations([7])).toEqual({
      sampleCount: 1,
      p50: 7,
      p95: 7,
      max: 7,
    });
    expect(summarizeDurations([2, 1])).toEqual({
      sampleCount: 2,
      p50: 1,
      p95: 2,
      max: 2,
    });
    expect(summarizeDurations([3, 1, 2])).toEqual({
      sampleCount: 3,
      p50: 2,
      p95: 3,
      max: 3,
    });
  });

  test("collects serial public-safe first and subsequent-run evidence", async () => {
    const results = [
      discoveryResult("success", 8),
      discoveryResult("timeout", 20),
      discoveryResult("failed", 28),
      discoveryResult("success", 900, true),
    ];
    const clock = [0, 10, 10, 30, 30, 60, 60, 1_060];
    let callIndex = 0;
    let clockIndex = 0;
    let inFlight = 0;
    let maxInFlight = 0;

    const report = await collectFontDiscoveryEvidence(
      { runs: 4, timeoutMs: 1_000 },
      {
        discover: async (input) => {
          expect(input).toEqual({
            discovery: "fontconfig",
            includeAttempts: true,
            timeoutMs: 1_000,
          });
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await Promise.resolve();
          inFlight -= 1;
          const result = results[callIndex];
          callIndex += 1;
          if (!result) {
            throw new Error("missing fixture result");
          }
          return result;
        },
        now: () => clock[clockIndex++] ?? 60,
      },
    );

    expect(maxInFlight).toBe(1);
    expect(report).not.toHaveProperty("schemaVersion");
    expect(report.environment).toMatchObject({
      platform: process.platform,
      arch: process.arch,
    });
    expect(report.percentileMethod).toBe("nearest-rank");
    expect(report.parameters).toEqual({
      discovery: "fontconfig",
      runs: 4,
      timeoutMs: 1_000,
      serial: true,
    });
    expect(report.firstRun).toEqual({
      outcome: "success",
      totalDurationMs: 10,
      adapterDurationMs: 8,
      faceCount: 1,
      emptyResult: false,
    });
    expect(report.successfulSubsequentRuns).toEqual({
      runCount: 1,
      totalDurationMs: {
        sampleCount: 1,
        p50: 1_000,
        p95: 1_000,
        max: 1_000,
      },
      adapterDurationMs: {
        sampleCount: 1,
        p50: 900,
        p95: 900,
        max: 900,
      },
    });
    expect(report.outcomes).toEqual({
      success: 2,
      failed: 1,
      timeout: 1,
      emptyResult: 1,
    });
    expect(report.successfulRuns).toEqual({
      runCount: 2,
      totalDurationMs: {
        sampleCount: 2,
        p50: 10,
        p95: 1_000,
        max: 1_000,
      },
      adapterDurationMs: {
        sampleCount: 2,
        p50: 8,
        p95: 900,
        max: 900,
      },
      faceCountRange: {
        sampleCount: 2,
        min: 0,
        max: 1,
      },
    });
    expect(report.thresholds).toEqual([
      { thresholdMs: 1_000, runsAtOrAbove: 1 },
      { thresholdMs: 3_000, runsAtOrAbove: 0 },
      { thresholdMs: 10_000, runsAtOrAbove: 0 },
    ]);

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("Private Family");
    expect(serialized).not.toContain("/private/");
    expect(serialized).not.toContain("fc-list");
    expect(serialized).not.toContain("raw command error");
  });

  test("keeps unsuccessful first runs out of success summaries", async () => {
    const clock = [0, 5, 5, 15];
    let clockIndex = 0;
    let callIndex = 0;

    const report = await collectFontDiscoveryEvidence(
      { runs: 2, timeoutMs: 1_000 },
      {
        discover: async () => {
          callIndex += 1;
          if (callIndex === 1) {
            throw new Error("private first-run failure");
          }
          return discoveryResult("timeout", 10);
        },
        now: () => clock[clockIndex++] ?? 15,
      },
    );

    expect(report.firstRun).toEqual({
      outcome: "failed",
      totalDurationMs: 5,
      emptyResult: false,
    });
    expect(report.successfulSubsequentRuns).toEqual({
      runCount: 0,
      totalDurationMs: {
        sampleCount: 0,
        p50: null,
        p95: null,
        max: null,
      },
      adapterDurationMs: {
        sampleCount: 0,
        p50: null,
        p95: null,
        max: null,
      },
    });
    expect(report.successfulRuns).toEqual({
      runCount: 0,
      totalDurationMs: {
        sampleCount: 0,
        p50: null,
        p95: null,
        max: null,
      },
      adapterDurationMs: {
        sampleCount: 0,
        p50: null,
        p95: null,
        max: null,
      },
      faceCountRange: {
        sampleCount: 0,
        min: null,
        max: null,
      },
    });
    expect(report.outcomes).toEqual({
      success: 0,
      failed: 1,
      timeout: 1,
      emptyResult: 0,
    });
    expect(JSON.stringify(report)).not.toContain("private first-run failure");
  });
});
