import { describe, expect, test } from "bun:test";

import {
  buildTemporalCleanupStem,
  matchCleanupDate,
  matchCleanupSerial,
  matchCleanupTimestamp,
  matchCleanupUid,
} from "../src/cli/actions/rename/cleanup-matchers";

describe("rename cleanup matcher internals", () => {
  test("matchCleanupTimestamp extracts prefix, suffix, and normalized timestamp", () => {
    const result = matchCleanupTimestamp("Screenshot 2026-03-02 at 4.53.04 PM final");

    expect(result).toEqual({
      prefix: "Screenshot",
      suffix: "final",
      normalizedTimestamp: "20260302-165304",
    });
  });

  test("matchCleanupDate extracts date-only fragments and ignores timestamp-shaped input", () => {
    expect(matchCleanupDate("Meeting Notes 2026-03-02")).toEqual({
      prefix: "Meeting Notes",
      suffix: "",
      normalizedDate: "20260302",
    });

    expect(matchCleanupDate("Screenshot 2026-03-02 at 4.53.04 PM")).toBeUndefined();
  });

  test("matchCleanupDate still detects standalone dates when a timestamp also exists elsewhere", () => {
    expect(matchCleanupDate("release 2026-03-01 Screenshot 2026-03-02 at 4.53.04 PM")).toEqual({
      prefix: "release",
      suffix: "Screenshot 2026-03-02 at 4.53.04 PM",
      normalizedDate: "20260301",
    });
  });

  test("matchCleanupSerial accepts the v1 trailing-counter shapes", () => {
    expect(matchCleanupSerial("scan (12)")).toEqual({
      prefix: "scan",
    });

    expect(matchCleanupSerial("scan_003")).toEqual({
      prefix: "scan",
    });
  });

  test("matchCleanupSerial rejects camera stems and trailing date fragments", () => {
    expect(matchCleanupSerial("IMG_1234")).toBeUndefined();
    expect(matchCleanupSerial("DSC_0123")).toBeUndefined();
    expect(matchCleanupSerial("Meeting Notes 2026-03-02")).toBeUndefined();
  });

  test("matchCleanupUid matches uid fragments case-insensitively and preserves surrounding text", () => {
    expect(matchCleanupUid("report uid-7k3m9q2x4t final")).toEqual({
      prefix: "report",
      suffix: "final",
    });

    expect(matchCleanupUid("report UID-7K3M9Q2X4T final")).toEqual({
      prefix: "report",
      suffix: "final",
    });
  });

  test("buildTemporalCleanupStem applies timestamp before date and reports combined no-match reason", () => {
    expect(
      buildTemporalCleanupStem(
        "Screenshot 2026-03-02 at 4.53.04 PM",
        ["date", "timestamp"],
        "preserve",
        "keep",
      ),
    ).toEqual({
      nextStem: "Screenshot 20260302-165304",
    });

    expect(
      buildTemporalCleanupStem("plain-note", ["date", "timestamp"], "preserve", "keep"),
    ).toEqual({
      nextStem: "plain-note",
      reason: "no date or timestamp match",
    });
  });

  test("buildTemporalCleanupStem applies multiple selected hints sequentially", () => {
    expect(
      buildTemporalCleanupStem(
        "report 2026-03-02 uid-7k3m9q2x4t final",
        ["date", "uid"],
        "preserve",
        "keep",
      ),
    ).toEqual({
      nextStem: "report 20260302 final",
    });
  });

  test("buildTemporalCleanupStem removes matched serial and uid fragments without rewriting surrounding text", () => {
    expect(buildTemporalCleanupStem("app-00001", ["serial"], "slug", "keep")).toEqual({
      nextStem: "app",
    });

    expect(
      buildTemporalCleanupStem("report uid-7k3m9q2x4t final", ["uid"], "preserve", "keep"),
    ).toEqual({
      nextStem: "report final",
    });
  });
});
