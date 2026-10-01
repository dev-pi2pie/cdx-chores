import { expect, test } from "bun:test";
import { validateVideoFramesOptions } from "../../../src/cli/video-frames/options";

const validate = (options: Record<string, unknown>) =>
  validateVideoFramesOptions({ input: "clip.mp4", ...options }, "/fixture");
test("frames selectors are mutually exclusive and explicit values retain strict grammar", () => {
  for (const options of [
    {},
    { firstFrame: true, lastFrame: true },
    { frameSet: "first-last", fps: "24" },
    { fps: "24", interval: "2s" },
    { frameNumber: "0" },
    { frameNumber: "1.5" },
    { frameNumber: "9007199254740992" },
    { at: "12.5" },
    { at: "00:60:00" },
    { frameSet: "all" },
    { fps: "24000/1001" },
    { fps: "0" },
    { interval: "0.5s" },
    { interval: " 2s" },
  ])
    expect(() => validate(options)).toThrow();
  expect(validate({ at: "00:00:00" }).request).toEqual({
    kind: "time",
    timeMs: { numerator: 0n, denominator: 1n },
  });
  expect(validate({ fps: "23.976" }).cadence?.value).toBe("23.976");
  expect(validate({ frameNumber: "25" }).request).toEqual({ kind: "frame", frameNumber: 25 });
});
test("image and naming conflicts fail before media inspection", () => {
  for (const options of [
    { firstFrame: true, quality: "high" },
    { firstFrame: true, scale: "1.1" },
    { firstFrame: true, scale: "0" },
    { firstFrame: true, scale: "NaN" },
    { firstFrame: true, pattern: "{stem}" },
    { firstFrame: true, output: "wrong.webp" },
    { frameSet: "first-last", pattern: "{stem}-{frame}" },
    { frameSet: "first-last", serialWidth: "4" },
    { fps: "24", pattern: "{stem}" },
    { fps: "24", serialStart: "-1" },
    { fps: "24", serialWidth: "0" },
  ])
    expect(() => validate(options)).toThrow();
  const literal = validate({
    firstFrame: true,
    format: "jpg",
    output: "Literal Image.JPEG",
    scale: "0.5",
  });
  expect(literal.output).toBe("/fixture/Literal Image.JPEG");
  expect(literal.image).toEqual({ format: "jpg", quality: "full", scale: 0.5 });
  expect(
    validate({ fps: "24", pattern: "{stem}-{serial_start_3_####}", serialWidth: "6" }).naming
      ?.serialWidth,
  ).toBe(6);
});
