import { describe, expect, test } from "bun:test";

import {
  formatFrameTime,
  isUsableDuration,
  moveFrameCandidate,
  nearestPosition,
  parseFrameNumber,
  parseFrameTime,
  selectionPosition,
  type FramePickerState,
  type FrameRequest,
} from "../../../src/cli/interactive/video-frames/selection";

function expectTime(request: FrameRequest, numerator: bigint, denominator = 1n): void {
  expect(request.kind).toBe("time");
  if (request.kind !== "time") throw new Error("Expected a time candidate.");
  expect(request.timeMs.numerator * denominator).toBe(numerator * request.timeMs.denominator);
}

describe("video frame selector grammar", () => {
  test("frame numbers are 1-based safe integers even without a known source count", () => {
    expect(parseFrameNumber("1")).toBe(1);
    expect(parseFrameNumber("0007")).toBe(7);
    expect(parseFrameNumber(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    for (const value of ["0", "-1", "+1", "1.0", "1e3", " 1", "1 ", "", "9007199254740992"]) {
      expect(() => parseFrameNumber(value)).toThrow();
    }
  });

  test("timestamp zero and one-to-three fractional digits retain their millisecond meaning", () => {
    for (const [text, milliseconds] of [
      ["00:00:00", 0n],
      ["00:00:00.1", 100n],
      ["00:00:00.01", 10n],
      ["00:00:00.001", 1n],
      ["00:00:00.999", 999n],
    ] as const) {
      expect(parseFrameTime(text)).toEqual({ numerator: milliseconds, denominator: 1n });
    }
  });

  test("hours may exceed 23 and have more than two digits", () => {
    expect(parseFrameTime("123:04:05.006")).toEqual({ numerator: 443_045_006n, denominator: 1n });
    expect(formatFrameTime(parseFrameTime("123:04:05.006"))).toBe("123:04:05.006");
    expect(parseFrameTime("000:00:01")).toEqual({ numerator: 1_000n, denominator: 1n });
  });

  test("rejects other duration grammars and malformed clock fields", () => {
    for (const value of [
      "0",
      "500ms",
      "1s",
      "0:00:00",
      "00:0:00",
      "00:00:0",
      "00:60:00",
      "00:00:60",
      "00:00:00.",
      "00:00:00.0000",
      "00:00:00,1",
      " 00:00:00",
      "00:00:00 ",
      "-01:00:00",
      "00:00:00Z",
      "99999999999999:00:00",
    ])
      expect(() => parseFrameTime(value)).toThrow();
  });

  test("an explicit time must precede a known reliable end", () => {
    expect(parseFrameTime("00:00:04.999", 5_000)).toEqual({ numerator: 4_999n, denominator: 1n });
    expect(() => parseFrameTime("00:00:05", 5_000)).toThrow(/before the video end/);
    expect(() => parseFrameTime("00:00:05.001", 5_000)).toThrow(/before the video end/);
    expect(parseFrameTime("00:00:05")).toEqual({ numerator: 5_000n, denominator: 1n });
  });

  test("unusable duration metadata cannot establish a full-span wave", () => {
    expect(isUsableDuration(1)).toBe(true);
    for (const duration of [undefined, 0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(isUsableDuration(duration)).toBe(false);
    }
  });
});

describe("video frame coarse movement", () => {
  test("projection retains a precise request between divisions and its resolved identity", () => {
    const state: FramePickerState = {
      request: { kind: "time", timeMs: { numerator: 1_234n, denominator: 1n } },
      resolved: { frameNumber: 14, startMs: 1_000 },
      glyphs: "ascii",
    };
    expect(nearestPosition(state, 6_000, 3)).toBe(0);
    expect(state.request).toEqual({ kind: "time", timeMs: { numerator: 1_234n, denominator: 1n } });
    expect(state.resolved).toEqual({ frameNumber: 14, startMs: 1_000 });
    expect(selectionPosition(state, 6_000)).toBe(
      state.request.kind === "time" ? state.request.timeMs : undefined,
    );
  });

  test("arrows choose the nearest division strictly in their requested direction", () => {
    const state: FramePickerState = {
      request: { kind: "time", timeMs: { numerator: 500n, denominator: 1n } },
      resolved: { frameNumber: 9, startMs: 480 },
      glyphs: "ascii",
    };
    expect(nearestPosition(state, 1_000, 4)).toBe(2);
    const left = moveFrameCandidate(state, 1_000, 4, "left");
    const right = moveFrameCandidate(state, 1_000, 4, "right");
    expectTime(left.request, 1_000n, 3n);
    expectTime(right.request, 2_000n, 3n);
    expect(left.glyphs).toBe("ascii");
    expect(right.glyphs).toBe("ascii");
    expect(left.resolved).toBeUndefined();
    expect(right.resolved).toBeUndefined();
    expect(state.resolved?.frameNumber).toBe(9);
  });

  test("movement from an exact division advances rather than reselecting it", () => {
    const state: FramePickerState = {
      request: { kind: "time", timeMs: { numerator: 1_000n, denominator: 3n } },
      glyphs: "unicode",
    };
    expect(moveFrameCandidate(state, 1_000, 4, "left").request).toEqual({ kind: "first" });
    expectTime(moveFrameCandidate(state, 1_000, 4, "right").request, 2_000n, 3n);
  });

  test("endpoint positions keep first/last roles rather than manufacturing EOF timestamps", () => {
    const nearEnd: FramePickerState = {
      request: { kind: "time", timeMs: { numerator: 999n, denominator: 1n } },
      glyphs: "unicode",
    };
    expect(moveFrameCandidate(nearEnd, 1_000, 5, "right").request).toEqual({ kind: "last" });
    const nearStart: FramePickerState = {
      request: { kind: "time", timeMs: { numerator: 1n, denominator: 1n } },
      glyphs: "unicode",
    };
    expect(moveFrameCandidate(nearStart, 1_000, 5, "left").request).toEqual({ kind: "first" });
  });

  test("outward endpoint movement never wraps and preserves its existing identity", () => {
    const first: FramePickerState = {
      request: { kind: "first" },
      resolved: { frameNumber: 1, startMs: 0 },
      glyphs: "ascii",
    };
    const last: FramePickerState = {
      request: { kind: "last" },
      resolved: { frameNumber: 7, startMs: 840 },
      glyphs: "ascii",
    };
    expect(moveFrameCandidate(first, 1_000, 5, "left")).toBe(first);
    expect(moveFrameCandidate(last, 1_000, 5, "right")).toBe(last);
    expect(selectionPosition(last, 1_000)).toEqual({ numerator: 1_000n, denominator: 1n });
    expectTime(moveFrameCandidate(last, 1_000, 5, "left").request, 750n);
  });

  test("resolved frame selectors use their reliable actual time for projection and movement", () => {
    const state: FramePickerState = {
      request: { kind: "frame", frameNumber: 37 },
      resolved: { frameNumber: 37, startMs: 600 },
      glyphs: "unicode",
    };
    expect(nearestPosition(state, 1_000, 5)).toBe(2);
    expectTime(moveFrameCandidate(state, 1_000, 5, "right").request, 750n);
  });

  test("frame identity without reliable timing is retained rather than given a guessed position", () => {
    const state: FramePickerState = {
      request: { kind: "frame", frameNumber: 37 },
      resolved: { frameNumber: 37 },
      glyphs: "unicode",
    };
    expect(selectionPosition(state, 1_000)).toBeUndefined();
    expect(moveFrameCandidate(state, 1_000, 5, "left")).toBe(state);
    expect(moveFrameCandidate(state, 1_000, 5, "right")).toBe(state);
  });

  test("unsupported fractional frame timing falls back without losing the identity", () => {
    const state: FramePickerState = {
      request: { kind: "frame", frameNumber: 2 },
      resolved: { frameNumber: 2, startMs: 125.5 },
      glyphs: "unicode",
    };
    expect(selectionPosition(state, 1_000)).toBeUndefined();
    expect(moveFrameCandidate(state, 1_000, 5, "right")).toBe(state);
    expect(state.resolved).toEqual({ frameNumber: 2, startMs: 125.5 });
  });
  test("exact rational decoded timing projects without rounding the retained identity", () => {
    const actual = { numerator: 251n, denominator: 2n };
    const state: FramePickerState = {
      request: { kind: "frame", frameNumber: 2 },
      resolved: { frameNumber: 2, startMs: actual },
      glyphs: "unicode",
    };
    expect(selectionPosition(state, 1000)).toBe(actual);
    expect(nearestPosition(state, 1000, 5)).toBe(1);
    expectTime(moveFrameCandidate(state, 1000, 5, "right").request, 250n);
    expect(state.resolved?.startMs).toBe(actual);
  });
});
