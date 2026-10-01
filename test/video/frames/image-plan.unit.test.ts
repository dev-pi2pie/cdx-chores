import { expect, test } from "bun:test";
import { exact } from "../../../src/cli/video-frames/exact";
import {
  imageOptions,
  encoderArguments,
  assertOpaque,
} from "../../../src/cli/video-frames/image-options";
import { imagePlan } from "../../../src/cli/video-frames/image-plan";
import { displayGeometry } from "../../../src/cli/video-frames/display";
import { imageColor } from "../../../src/cli/video-frames/color";
import {
  parseEncoderNames,
  parseWebpHelp,
  requireImageEncoder,
} from "../../../src/cli/video-frames/encoders";
import { parseMetadata } from "../../../src/cli/video-frames/metadata";
import type { VideoStream } from "../../../src/cli/video-frames/types";
const stream = (values: Partial<VideoStream> = {}): VideoStream => ({
  index: 2,
  codec: "ffv1",
  width: 96,
  height: 64,
  pixelFormat: "rgba",
  timeBase: exact(1n, 1000n),
  fingerprint: "synthetic",
  eligibleStreams: 1,
  image: { sampleAspectRatio: "1:1", display: [] },
  ...values,
});
const matrix = (a: number, b: number, c: number, d: number) =>
  `\n00000000: ${a * 65536} ${b * 65536} 0\n00000001: ${c * 65536} ${d * 65536} 0\n00000002: 0 0 1073741824\n`;

test("image options preserve explicit format/quality and bound scale", () => {
  expect(imageOptions()).toEqual({ format: "png", quality: "full", scale: 1 });
  expect(imageOptions({ format: " WebP ", quality: " High ", scale: 0.5 })).toEqual({
    format: "webp",
    quality: "high",
    scale: 0.5,
  });
  for (const input of [
    { format: "jpeg" },
    { format: null },
    { quality: "lossless" },
    { quality: "" },
    { quality: 90 },
    { quality: "low" },
    { scale: 0 },
    { scale: 1.1 },
    { scale: "0.5" },
    { scale: NaN },
  ])
    expect(() => imageOptions(input)).toThrow();
});
test("encoder policies use tested native quality mappings and lossless mode", () => {
  expect(encoderArguments(imageOptions())).toContain("9");
  for (const [quality, q] of [
    ["low", 12],
    ["medium", 6],
    ["high", 3],
    ["full", 1],
  ] as const)
    expect(encoderArguments(imageOptions({ format: "jpg", quality })).slice(-6)).toEqual([
      "-q:v",
      String(q),
      "-qmin",
      "1",
      "-qmax",
      "31",
    ]);
  expect(encoderArguments(imageOptions({ format: "webp" }))).toContain("-lossless");
  expect(encoderArguments(imageOptions({ format: "webp", quality: "low" }))).toContain("40");
});
test("JPG accepts opaque alpha-capable pixels and rejects actual transparency", () => {
  expect(() => assertOpaque(Buffer.from([10, 20, 30, 255, 40, 50, 60, 255]))).not.toThrow();
  expect(() => assertOpaque(Buffer.from([10, 20, 30, 254]))).toThrow("transparency");
});
test("aspect precedes display transform and exact half-up scale preserves odd dimensions", () => {
  const result = displayGeometry(
    stream({
      image: { sampleAspectRatio: "2:1", display: [{ matrix: matrix(0, -1, 1, 0), rotation: 90 }] },
    }),
    0.5,
  );
  expect([result.width, result.height]).toEqual([32, 96]);
  expect(result.filters.slice(0, 3)).toEqual([
    "scale=192:64:flags=neighbor",
    "setsar=1",
    "transpose=cclock",
  ]);
  const odd = displayGeometry(stream({ width: 101, height: 51 }), 0.5);
  expect([odd.width, odd.height]).toEqual([51, 26]);
});
test("all orthogonal display matrices map once and unsupported/conflicting transforms fail", () => {
  for (const [axes, filters] of [
    [[1, 0, 0, 1], []],
    [[-1, 0, 0, 1], ["hflip"]],
    [[1, 0, 0, -1], ["vflip"]],
    [
      [-1, 0, 0, -1],
      ["hflip", "vflip"],
    ],
    [[0, -1, 1, 0], ["transpose=cclock"]],
    [[0, 1, -1, 0], ["transpose=clock"]],
    [
      [0, -1, -1, 0],
      ["transpose=cclock", "hflip"],
    ],
    [
      [0, 1, 1, 0],
      ["transpose=clock", "hflip"],
    ],
  ] as [number[], string[]][]) {
    const shape = displayGeometry(
      stream({ image: { display: [{ matrix: matrix(axes[0]!, axes[1]!, axes[2]!, axes[3]!) }] } }),
      1,
    );
    expect(shape.filters.slice(2, -2)).toEqual(filters);
  }
  for (const display of [
    [{ rotation: 45 }],
    [{ matrix: "invalid" }],
    [{ matrix: matrix(0, -1, 1, 0), rotation: -90 }],
    [{ rotation: 90 }, { rotation: 0 }],
  ])
    expect(() => displayGeometry(stream({ image: { display } }), 1)).toThrow("display transform");
});
test("unspecified aspect is disclosed; invalid aspect and expanded pixel guard fail", () => {
  for (const sampleAspectRatio of [undefined, "N/A", "0:1", "0:0"])
    expect(
      displayGeometry(stream({ image: { sampleAspectRatio, display: [] } }), 1).notices,
    ).toContain("Pixel aspect ratio unavailable; assuming square pixels.");
  for (const sampleAspectRatio of ["1:0", "-1:1", "bad"])
    expect(() => displayGeometry(stream({ image: { sampleAspectRatio, display: [] } }), 1)).toThrow(
      "aspect ratio",
    );
  expect(() =>
    displayGeometry(
      stream({ width: 4096, height: 4096, image: { sampleAspectRatio: "2:1", display: [] } }),
      0.1,
    ),
  ).toThrow("pixel guard");
});
test("color policy separates disclosed inference from unsupported and conflicting metadata", () => {
  const inferred = imageColor(stream());
  expect(inferred.notices).toHaveLength(4);
  expect(inferred.alpha).toBe(true);
  const yuv = imageColor(
    stream({
      pixelFormat: "yuv420p",
      image: {
        display: [],
        colorSpace: "bt709",
        colorRange: "tv",
        colorPrimaries: "bt709",
        colorTransfer: "bt709",
      },
    }),
  );
  expect(yuv.notices).toHaveLength(0);
  expect(yuv.filters[0]).toContain("itrc=bt709");
  for (const values of [
    { pixelFormat: "yuv420p10le" },
    { image: { display: [], colorPrimaries: "bt2020" } },
    { image: { display: [], colorTransfer: "smpte2084" } },
    { image: { display: [], colorRange: "tv" } },
    { image: { display: [], colorSpace: "bt709" } },
  ] as Partial<VideoStream>[])
    expect(() => imageColor(stream(values))).toThrow();
});
test("image graph selects the exact stream and transforms alpha separately", () => {
  const plan = imagePlan(stream(), imageOptions(), "select='eq(n,2)'");
  expect(plan.filters).toStartWith("[0:2]select='eq(n,2)',split");
  expect(plan.filters).toContain("alphaextract");
  expect(plan.filters).toContain("alphamerge");
  expect(plan.frameBytes).toBe(96 * 64 * 4);
});
test("metadata retains immutable color/aspect/display fields for image planning", () => {
  const parsed = parseMetadata(
    JSON.stringify({
      streams: [
        {
          index: 0,
          codec_type: "video",
          codec_name: "qtrle",
          width: 96,
          height: 64,
          pix_fmt: "argb",
          time_base: "1/1000",
          sample_aspect_ratio: "2:1",
          color_range: "pc",
          side_data_list: [
            { side_data_type: "Display Matrix", displaymatrix: matrix(0, -1, 1, 0), rotation: 90 },
          ],
        },
      ],
    }),
  );
  expect(parsed.image?.colorRange).toBe("pc");
  expect(parsed.image?.display[0]?.rotation).toBe(90);
  expect(Object.isFrozen(parsed.image?.display[0])).toBe(true);
});
test("encoder inventory/help matches exact encoders and required modes", () => {
  expect(
    parseEncoderNames(
      "Encoders:\n V..... png PNG\n V..... libwebp_anim animated\n ...D.. webp decoder\n",
    ).has("libwebp"),
  ).toBe(false);
  expect(() => parseEncoderNames("unrelated")).toThrow("inspection failed");
  expect(parseWebpHelp("Codec libwebp not recognized. lossless")).toEqual({
    bgra: false,
    lossless: undefined,
  });
  expect(
    parseWebpHelp(
      "Encoder libwebp [WebP]\n Supported pixel formats: bgra yuv420p\n -lossless <int> mode (from 0 to 1)\n",
    ),
  ).toEqual({ bgra: true, lossless: true });
  expect(() =>
    requireImageEncoder(
      { png: true, jpg: true, webp: true, webpLossless: false },
      imageOptions({ format: "webp" }),
    ),
  ).toThrow("encoder mode");
});
