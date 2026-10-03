import { expect, test } from "bun:test";
import { exact } from "../../../src/cli/video-frames/exact";
import {
  imageOptions,
  encoderArguments,
  assertOpaque,
  requireExactWebpPixels,
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
    "scale=192:64:flags=neighbor+full_chroma_int+full_chroma_inp",
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
  expect(yuv.transfer).toBe("bt709");
  expect(yuv.interpretation).toBe("coremedia709");
  expect(yuv.filters[0]).toBe(
    "scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int+full_chroma_inp",
  );
  expect(yuv.filters.join(",")).not.toContain("trc=");
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
test("source-transfer preservation keeps declared alpha on packed RGB", () => {
  for (const pixelFormat of ["rgba", "bgra"]) {
    const result = imageColor(
      stream({
        pixelFormat,
        sourceAlpha: true,
        image: {
          display: [],
          colorSpace: "gbr",
          colorRange: "pc",
          colorPrimaries: "bt709",
          colorTransfer: "bt709",
        },
      }),
    );
    expect(result.transfer).toBe("bt709");
    expect(result.interpretation).toBe("coremedia709");
    expect(result.alpha).toBe(true);
    expect(result.notices).toEqual([]);
    expect(result.filters).toEqual(["format=rgb24"]);
  }
});
test("sRGB YUVA retains source transfer and separate alpha interpretation", () => {
  const source = stream({
    pixelFormat: "yuva420p",
    sourceAlpha: true,
    image: {
      display: [],
      colorSpace: "bt709",
      colorRange: "tv",
      colorPrimaries: "bt709",
      colorTransfer: "iec61966-2-1",
    },
  });
  const result = imageColor(source);
  expect(result.transfer).toBe("iec61966-2-1");
  expect(result.interpretation).toBe("srgb");
  expect(result.alpha).toBe(true);
  expect(result.notices).toEqual([]);
  expect(result.filters).toEqual([
    "scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int+full_chroma_inp",
    "format=rgb24",
  ]);
  expect(imagePlan(source, imageOptions()).filters).toContain("alphaextract");
});
test("semiplanar sources disclose defaults rather than guessing color from layout", () => {
  for (const pixelFormat of ["nv12", "nv21"]) {
    const result = imageColor(stream({ pixelFormat }));
    expect(result.transfer).toBe("bt709");
    expect(result.alpha).toBe(false);
    expect(result.filters[0]).toBe(
      "scale=in_color_matrix=bt601:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int+full_chroma_inp",
    );
    expect(result.notices).toEqual([
      "Color matrix unavailable; assuming smpte170m.",
      "Color range unavailable; assuming tv.",
      "Color primaries unavailable; assuming bt709.",
      "Color transfer unavailable; assuming bt709.",
    ]);
  }
});
test("RGB padding does not satisfy a declared source alpha channel", () => {
  expect(() => imageColor(stream({ pixelFormat: "rgb0", sourceAlpha: true }))).toThrow(
    "default decoder",
  );
});
test("declared source alpha requires an alpha-capable decoded format", () => {
  expect(imageColor(stream({ sourceAlpha: true })).alpha).toBe(true);
  expect(() => imageColor(stream({ pixelFormat: "yuv420p", sourceAlpha: true }))).toThrow(
    "default decoder",
  );
  const selected = {
    index: 0,
    codec_type: "video",
    codec_name: "vp9",
    width: 96,
    height: 64,
    pix_fmt: "yuv420p",
    time_base: "1/1000",
  };
  expect(
    parseMetadata(JSON.stringify({ streams: [{ ...selected, tags: { alpha_mode: "1" } }] }))
      .sourceAlpha,
  ).toBe(true);
  expect(
    parseMetadata(JSON.stringify({ streams: [{ ...selected, tags: { alpha_mode: "0" } }] }))
      .sourceAlpha,
  ).toBe(false);
  for (const alpha_mode of ["2", "true", 1, null])
    expect(() =>
      parseMetadata(JSON.stringify({ streams: [{ ...selected, tags: { alpha_mode } }] })),
    ).toThrow("alpha declaration");
});
test("WebP full rejects fully transparent pixels when exact hidden RGB cannot be preserved", () => {
  const pixels = Buffer.from([70, 110, 60, 0, 40, 50, 60, 128]);
  expect(() => requireExactWebpPixels(pixels, imageOptions({ format: "webp" }))).toThrow(
    "choose PNG",
  );
  expect(() => requireExactWebpPixels(pixels, imageOptions({ format: "png" }))).not.toThrow();
  for (const quality of ["low", "medium", "high"] as const)
    expect(() =>
      requireExactWebpPixels(pixels, imageOptions({ format: "webp", quality })),
    ).not.toThrow();
  for (const alpha of [1, 127, 128, 254, 255])
    expect(() =>
      requireExactWebpPixels(Buffer.from([70, 110, 60, alpha]), imageOptions({ format: "webp" })),
    ).not.toThrow();
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
    )?.has("libwebp"),
  ).toBe(false);
  expect(parseEncoderNames("unrelated")).toBeUndefined();
  expect(parseWebpHelp("Codec libwebp not recognized. lossless")).toEqual({
    bgra: "unknown",
    lossless: "unknown",
  });
  expect(
    parseWebpHelp(
      "Encoder libwebp [WebP]\n Supported pixel formats: bgra yuv420p\n -lossless <int> mode (from 0 to 1)\n",
    ),
  ).toEqual({ bgra: "supported", lossless: "supported" });
  expect(() =>
    requireImageEncoder(
      {
        png: "supported",
        jpg: "supported",
        webp: "supported",
        webpEncoder: "supported",
        webpBgra: "supported",
        webpLossless: "unsupported",
      },
      imageOptions({ format: "webp" }),
    ),
  ).toThrow("encoder mode");
});

test("encoder checks keep unknown support distinct and require only the requested mode", () => {
  const encoders = {
    png: "supported" as const,
    jpg: "unsupported" as const,
    webp: "supported" as const,
    webpEncoder: "supported" as const,
    webpBgra: "supported" as const,
    webpLossless: "unknown" as const,
  };
  expect(() => requireImageEncoder(encoders, imageOptions())).not.toThrow();
  expect(() =>
    requireImageEncoder(encoders, imageOptions({ format: "webp", quality: "high" })),
  ).not.toThrow();
  expect(() =>
    requireImageEncoder(encoders, imageOptions({ format: "webp", quality: "full" })),
  ).toThrow("could not be verified");
  expect(() =>
    requireImageEncoder({ ...encoders, webp: "unsupported" }, imageOptions({ format: "webp" })),
  ).toThrow("is unavailable");
  expect(
    parseWebpHelp(
      "Encoder libwebp_anim [WebP]:\n Supported pixel formats: bgra\n -lossless <int> (from 0 to 1)\n",
    ),
  ).toEqual({ bgra: "unknown", lossless: "unknown" });
  expect(
    parseWebpHelp(
      "Encoder libwebp [WebP]:\n Supported pixel formats: \nlibwebp AVOptions:\n -lossless <int> (from 0 to 1)\n",
    ),
  ).toEqual({ bgra: "unknown", lossless: "supported" });
  expect(parseEncoderNames("Encoders:\n A..... pcm_s16le PCM\n")?.has("png")).toBe(false);
  expect(parseEncoderNames("Encoders:\n unknown successful format\n")).toBeUndefined();
});
