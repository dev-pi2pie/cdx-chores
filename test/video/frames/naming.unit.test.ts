import { expect, test } from "bun:test";
import {
  FrameNamer,
  sourceStem,
  effectiveFrameSerial,
  validateFrameTemplate,
} from "../../../src/cli/video-frames/naming";
test("one normalized source stem is shared across every naming mode", () => {
  expect(sourceStem("/source/Crème Clip.MOV")).toBe("creme-clip");
  expect(sourceStem("/source/影片.mp4")).toBe("file");
  expect(sourceStem(`${"a".repeat(70)}.mp4`)).toHaveLength(48);
  const single = new FrameNamer("single", "Crème Clip.MOV", {
    template: "Title__{stem}--{selection}__{frame}",
  });
  expect(single.name({ frameNumber: 1, selection: "custom", format: "png" })).toBe(
    "Title_creme-clip-custom_1.png",
  );
});
test("set roles retain different names when all resolve to the same frame", () => {
  const names = new FrameNamer("set", "clip.mp4");
  expect(
    ["first", "middle", "last"].map((selection) =>
      names.name({
        frameNumber: 1,
        selection: selection as "first" | "middle" | "last",
        format: "webp",
      }),
    ),
  ).toEqual(["clip-first-frame.webp", "clip-middle-frame.webp", "clip-last-frame.webp"]);
  expect(() => names.name({ frameNumber: 1, selection: "custom", format: "png" })).toThrow(
    "selection label",
  );
  expect(() =>
    new FrameNamer("single", "clip").name({ frameNumber: 1, selection: "middle", format: "png" }),
  ).toThrow("selection label");
});
test("serial settings use explicit over embedded over default and grow minimum width per value", () => {
  expect(effectiveFrameSerial({ template: "{stem}-{serial}" })).toEqual({ start: 1, width: 6 });
  expect(effectiveFrameSerial({ template: "{serial_###_start_0}" })).toEqual({
    start: 0,
    width: 3,
  });
  expect(
    effectiveFrameSerial({ template: "{serial_start_8_#####}", serialStart: 0, serialWidth: 2 }),
  ).toEqual({ start: 0, width: 2 });
  const names = new FrameNamer("sequence", "clip.mp4", {
    template: "{stem}-{serial_##_start_98}-f{frame}",
  });
  expect([0, 1, 2].map((index) => names.name({ frameNumber: 7, index, format: "jpg" }))).toEqual([
    "clip-98-f7.jpg",
    "clip-99-f7.jpg",
    "clip-100-f7.jpg",
  ]);
});
test("invalid tokens, scopes and serial parameters reject before rendering", () => {
  for (const template of [
    "{frame}",
    "{serial}{serial}",
    "{serial_order_path_asc}",
    "{serial_start_0_start_1}",
    "{serial_#_##}",
    "{serial_}",
    "{selection}-{serial}",
    "../{serial}",
    "{{serial}",
    "{unknown}-{serial}",
  ])
    expect(validateFrameTemplate("sequence", template)).not.toBe(true);
  expect(validateFrameTemplate("set", "{stem}-{frame}")).not.toBe(true);
  expect(() => new FrameNamer("single", "clip", { template: "{stem}", serialStart: 1 })).toThrow(
    "only for sequences",
  );
  for (const [start, width] of [
    [-1, 1],
    [1.5, 1],
    [1, 0],
    [1, 251],
    [Number.MAX_SAFE_INTEGER + 1, 1],
  ])
    expect(() =>
      effectiveFrameSerial({ template: "{serial}", serialStart: start, serialWidth: width }),
    ).toThrow("safe integers");
});
test("name length and numeric exhaustion are errors rather than changed settings", () => {
  const overflow = new FrameNamer("sequence", "clip", {
    template: "{serial}",
    serialStart: Number.MAX_SAFE_INTEGER,
  });
  expect(overflow.name({ frameNumber: 1, index: 0, format: "png" })).toBe("9007199254740991.png");
  expect(() => overflow.name({ frameNumber: 1, index: 1, format: "png" })).toThrow("safe integer");
  expect(() =>
    new FrameNamer("sequence", "clip", { template: "{stem}-{serial}", serialWidth: 250 }).name({
      frameNumber: 1,
      index: 0,
      format: "png",
    }),
  ).toThrow("filesystem limits");
  expect(() =>
    new FrameNamer("single", "clip", { template: "NUL" }).name({
      frameNumber: 1,
      selection: "custom",
      format: "png",
    }),
  ).toThrow("reserved");
  expect(() => overflow.name({ frameNumber: 0, index: 0, format: "png" })).toThrow("verified");
});
