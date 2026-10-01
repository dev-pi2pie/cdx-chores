import { expect, test } from "bun:test";
import { imageFramer } from "../../../src/cli/video-frames/image-framing";
import { png, jpg, webp } from "./fixtures/framing";
import type { ImageFormat } from "../../../src/cli/video-frames/image-options";
function capture(format: ImageFormat) {
  const completed: Buffer[] = [];
  let parts: Buffer[] = [];
  let active = false;
  const framer = imageFramer(format, {
    async begin() {
      expect(active).toBe(false);
      active = true;
      parts = [];
    },
    async write(bytes) {
      expect(active).toBe(true);
      parts.push(Buffer.from(bytes));
    },
    async complete() {
      completed.push(Buffer.concat(parts));
      active = false;
    },
  });
  return { framer, completed };
}
for (const [format, fixture] of [
  ["png", png],
  ["jpg", jpg],
  ["webp", webp],
] as [ImageFormat, () => Buffer][]) {
  test(`${format} streams preserve complete bytes at every chunk boundary`, async () => {
    const source = Buffer.concat([fixture(), fixture()]);
    for (const width of [1, 2, 3, 7, 64, source.length]) {
      const { framer, completed } = capture(format);
      for (let offset = 0; offset < source.length; offset += width)
        await framer.chunk(source.subarray(offset, offset + width));
      framer.finish();
      expect(completed).toEqual([fixture(), fixture()]);
    }
  });
  test(`${format} incomplete or invalid bytes never establish another completed image`, async () => {
    const { framer, completed } = capture(format);
    await framer.chunk(Buffer.concat([fixture(), fixture().subarray(0, -1)]));
    expect(() => framer.finish()).toThrow("incomplete");
    expect(completed).toHaveLength(1);
    await expect(capture(format).framer.chunk(Buffer.alloc(20))).rejects.toThrow("image stream");
  });
}
test("WebP animation packets cannot be published as still images", async () => {
  await expect(capture("webp").framer.chunk(webp("ANMF"))).rejects.toThrow("image stream");
});
