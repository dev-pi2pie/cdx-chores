import { expect, test } from "bun:test";
import { RawFrames } from "../../../src/cli/video-frames/raw-frames";
test("raw frame parsing preserves order across fragments and reuses one frame only after consumption", async () => {
  const frames: Buffer[] = [],
    references: Buffer[] = [];
  const parser = new RawFrames(16, async (bytes) => {
    references.push(bytes);
    frames.push(Buffer.from(bytes));
    await Promise.resolve();
  });
  for (const width of [1, 5, 17, 64]) {
    const values = Buffer.from(Array.from({ length: 48 }, (_, index) => index));
    for (let index = 0; index < values.length; index += width)
      await parser.chunk(values.subarray(index, index + width));
  }
  parser.finish(12);
  expect(frames.map((frame) => frame[0])).toEqual([0, 16, 32, 0, 16, 32, 0, 16, 32, 0, 16, 32]);
  expect(references.every((frame) => frame === references[0])).toBe(true);
});
test("raw parsing rejects incomplete, extra and excessive frame capacity", async () => {
  const parser = new RawFrames(16, async () => {});
  await parser.chunk(Buffer.alloc(15));
  expect(() => parser.finish(1)).toThrow("incomplete");
  await parser.chunk(Buffer.alloc(1));
  expect(() => parser.finish(0)).toThrow("changed");
  expect(() => new RawFrames(16_777_216 * 4 + 1, async () => {})).toThrow("capacity");
});
