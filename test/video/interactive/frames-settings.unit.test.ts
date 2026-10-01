import { describe, expect, test } from "bun:test";
import {
  frameCadenceFeedback,
  frameIntervalEstimate,
  frameIntervalDetails,
  frameFormatChoices,
  frameQualityChoices,
  frameQualityLabel,
  validateFrameCadenceValue,
  validateFrameScale,
} from "../../../src/cli/interactive/video-frames/settings-values";
import { unknownImageEncoders, type ImageEncoders } from "../../../src/cli/video-frames/encoders";
import { exact } from "../../../src/cli/video-frames/exact";

const supported: ImageEncoders = {
  png: "supported",
  jpg: "supported",
  webp: "supported",
  webpEncoder: "supported",
  webpBgra: "supported",
  webpLossless: "supported",
};

describe("frame image setting choices", () => {
  test("unavailable and unknown formats remain visible and cannot be selected", () => {
    const choices = frameFormatChoices({
      ...unknownImageEncoders(),
      png: "supported",
      jpg: "unsupported",
    });
    expect(choices.find((choice) => choice.value === "png")?.disabled).toBeUndefined();
    expect(choices.find((choice) => choice.value === "jpg")?.disabled).toContain("Unavailable");
    expect(choices.find((choice) => choice.value === "webp")?.disabled).toContain(
      "could not be verified",
    );
    expect(choices.map((choice) => choice.value)).toEqual(["png", "jpg", "webp"]);
  });

  test("WebP full needs affirmative lossless support and leaves lossy modes available", () => {
    for (const webpLossless of ["unsupported", "unknown"] as const) {
      const choices = frameQualityChoices("webp", { ...supported, webpLossless });
      expect(choices.find((choice) => choice.value === "full")?.disabled).toBeDefined();
      expect(choices.filter((choice) => !choice.disabled).map((choice) => choice.value)).toEqual([
        "high",
        "medium",
        "low",
      ]);
    }
    expect(frameQualityChoices("webp", supported).every((choice) => !choice.disabled)).toBe(true);
  });

  test("PNG exposes only full while JPEG full explicitly remains lossy", () => {
    expect(frameQualityChoices("png", supported).map((choice) => choice.value)).toEqual(["full"]);
    expect(frameQualityLabel("jpg", "full")).toContain("lossy");
    expect(frameQualityLabel("webp", "full")).toContain("lossless");
  });
});

describe("cadence input feedback", () => {
  test("interval rows retain compact count estimates and natural plurals", () => {
    const duration = exact(5_100n);
    expect(frameIntervalEstimate("1s", duration)).toBe("~6 images");
    expect(frameIntervalEstimate("10s", duration)).toBe("~1 image");
    expect(frameIntervalDetails("1s", duration)).toBe(
      "Duration 00:00:05.100 (metadata estimate)\nCounts confirmed during export",
    );
    expect(frameIntervalDetails("1s", duration, false, false)).toBe(
      "Duration 00:00:05.100 (decoded end)\nCounts confirmed during export",
    );
    expect(frameIntervalDetails("1s", duration, true, false)).toBe(
      "Decoded duration 5.1s\nCounts confirmed at export",
    );
    for (const missing of [undefined, exact(0n), exact(-1n)]) {
      expect(frameIntervalEstimate("1s", missing)).toBe("estimate unavailable");
      expect(frameIntervalDetails("1s", missing)).toBe(
        "Duration unavailable\nCounts confirmed during export",
      );
    }
  });

  test("starting-image boundary wording follows rational periods rather than displayed rounding", () => {
    expect(frameIntervalDetails("1s", exact(1_000n))).toContain(
      "Matches duration — starting image only",
    );
    expect(frameIntervalDetails("1s", exact(999_999n, 1_000n))).toContain(
      "Beyond duration — starting image only",
    );
    expect(frameIntervalDetails("1s", exact(1_000_001n, 1_000n))).not.toContain(
      "starting image only",
    );
    expect(frameIntervalEstimate("1s", exact(1_000_001n, 1_000n))).toBe("~2 images");
    expect(frameIntervalDetails("10s", exact(5_100n), true)).toBe(
      "Metadata duration ~5.1s\nCounts confirmed at export\nBeyond: start image only",
    );
    for (const invalid of ["0s", "1.5s", "bad"]) {
      expect(frameIntervalEstimate(invalid, exact(1_000n))).toBeUndefined();
      expect(frameIntervalDetails(invalid, exact(1_000n))).toBeUndefined();
    }
  });
  test("decimal FPS estimates use exact arithmetic at a fractional boundary", () => {
    expect(frameCadenceFeedback("fps", "23.976", exact(1000n))).toContain("Expected 24 images");
    expect(frameCadenceFeedback("fps", "0.5", exact(2000n))).toContain(
      "Expected 1 image at the start",
    );
    expect(frameCadenceFeedback("fps", "0.5", exact(2000001n, 1000n))).toContain(
      "Expected 2 images",
    );
  });

  test("oversized valid intervals show a preliminary one-image notice without rejection", () => {
    expect(validateFrameCadenceValue("interval", "15m")).toBe(true);
    expect(frameCadenceFeedback("interval", "10s", exact(8000n))).toContain(
      "Expected 1 image at the start",
    );
    expect(frameCadenceFeedback("interval", "7s", exact(8000n))).toContain("Expected 2 images");
  });

  test("unknown or nonpositive metadata never becomes an invented one-image guarantee", () => {
    for (const duration of [undefined, exact(0n), exact(-1n)]) {
      const message = frameCadenceFeedback("interval", "10s", duration);
      expect(message).toContain("count unavailable");
      expect(message).not.toContain("1 image");
    }
  });

  test("custom values keep FPS, intervals, and timestamp languages separate", () => {
    for (const value of ["0", "-1", "24/1", "1e2", ".5", "24 ", "00:00:01", "1s"])
      expect(validateFrameCadenceValue("fps", value)).not.toBe(true);
    for (const value of [
      "0ms",
      "0s",
      "0m",
      "1.5s",
      "500",
      "1S",
      "1 s",
      "00:00:01",
      "9007199254740992ms",
    ])
      expect(validateFrameCadenceValue("interval", value)).not.toBe(true);
    expect(frameCadenceFeedback("interval", "0s", exact(8000n))).toBeUndefined();
  });

  test("scale cannot accept coercible nondecimals or cross the supported boundary", () => {
    for (const value of ["0.1", "0.5", "1", "1.0"]) expect(validateFrameScale(value)).toBe(true);
    for (const value of ["", "0", "0.099", "1.01", "0x1", "1e0", "Infinity", " 0.5 "])
      expect(validateFrameScale(value)).not.toBe(true);
  });
});
