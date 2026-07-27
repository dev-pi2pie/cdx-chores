import { describe, expect, test } from "bun:test";

import type { DiscoverFontsResult, FontFace } from "../src/fonts";
import {
  collectFontDiscoveryEvidence,
  parseEvidenceSpikeArgs,
  summarizeDurations,
} from "../scripts/spikes/markdown-pdf-font-discovery-evidence-spike";

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
): DiscoverFontsResult {
  return {
    faces: status === "success" ? [sensitiveFace()] : [],
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
  });

  test("collects serial public-safe first and subsequent-run evidence", async () => {
    const results = [
      discoveryResult("success", 8),
      discoveryResult("timeout", 20),
      discoveryResult("failed", 28),
    ];
    const clock = [0, 10, 10, 30, 30, 60];
    let callIndex = 0;
    let clockIndex = 0;
    let inFlight = 0;
    let maxInFlight = 0;

    const report = await collectFontDiscoveryEvidence(
      { runs: 3, timeoutMs: 1_000 },
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
    expect(report.parameters).toEqual({
      discovery: "fontconfig",
      runs: 3,
      timeoutMs: 1_000,
      serial: true,
    });
    expect(report.firstRun).toEqual({
      outcome: "success",
      totalDurationMs: 10,
      adapterDurationMs: 8,
      emptyResult: false,
    });
    expect(report.subsequentRuns).toEqual({
      runCount: 2,
      totalDurationMs: {
        sampleCount: 2,
        p50: 20,
        p95: 30,
        max: 30,
      },
      adapterDurationMs: {
        sampleCount: 2,
        p50: 20,
        p95: 28,
        max: 28,
      },
    });
    expect(report.outcomes).toEqual({
      success: 1,
      failed: 1,
      timeout: 1,
      emptyResult: 0,
    });

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("Private Family");
    expect(serialized).not.toContain("/private/");
    expect(serialized).not.toContain("fc-list");
    expect(serialized).not.toContain("raw command error");
  });
});
