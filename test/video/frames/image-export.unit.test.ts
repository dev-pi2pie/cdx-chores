import { expect, test } from "bun:test";
import { validateImageFrame } from "../../../src/cli/video-frames/export";
import { imageOptions } from "../../../src/cli/video-frames/image-options";
import { parseFrameRecord, parseMetadata } from "../../../src/cli/video-frames/metadata";
const stream = parseMetadata(
  JSON.stringify({
    streams: [
      {
        index: 2,
        codec_name: "ffv1",
        codec_type: "video",
        width: 2,
        height: 2,
        pix_fmt: "bgra",
        time_base: "1/1000",
        sample_aspect_ratio: "1:1",
        color_range: "pc",
        color_space: "gbr",
        color_primaries: "bt709",
        color_transfer: "iec61966-2-1",
      },
    ],
  }),
);
const binding = {
  sourcePath: "synthetic",
  source: { canonicalPath: "synthetic", fingerprint: "source" },
  stream,
};
const frame = parseFrameRecord(
  "frame|stream_index=2|width=2|height=2|pix_fmt=bgra|sample_aspect_ratio=1:1|color_range=pc|color_space=gbr|color_primaries=bt709|color_transfer=iec61966-2-1",
  2,
)!;
test("actual frame fields retain checked geometry and explicit color/aspect metadata", () => {
  expect(frame.width).toBe(2);
  expect(frame.image?.colorTransfer).toBe("iec61966-2-1");
  expect(() => validateImageFrame(frame, binding, imageOptions())).not.toThrow();
  for (const width of ["0", "9007199254740992", "1.5"])
    expect(() => parseFrameRecord(`frame|stream_index=2|width=${width}`, 2)).toThrow();
});
test("dynamic unsupported geometry, bit depth, transfer, range, and aspect cannot silently change conversion", () => {
  for (const changed of [
    { streamIndex: 1 },
    { width: 3 },
    { pixelFormat: undefined },
    { pixelFormat: "yuv444p10le" },
    { image: { ...frame.image, colorTransfer: "smpte2084" } },
    { image: { ...frame.image, colorRange: "tv" } },
    { image: { ...frame.image, sampleAspectRatio: "2:1" } },
  ])
    expect(() => validateImageFrame({ ...frame, ...changed }, binding, imageOptions())).toThrow();
});
test("frame-only ICC descriptions cannot bypass the source-profile refusal", () => {
  for (const [key, value] of [
    ["side_data_type", "ICC profile"],
    ["side_datum/icc_profile:side_data_type", "ICC Profile"],
  ]) {
    const described = parseFrameRecord(
      `frame|stream_index=2|width=2|height=2|pix_fmt=bgra|sample_aspect_ratio=1:1|color_range=pc|color_space=gbr|color_primaries=bt709|color_transfer=iec61966-2-1|${key}=${value}`,
      2,
    )!;
    expect(described.image?.colorProfile).toBe(true);
    expect(() => validateImageFrame(described, binding, imageOptions())).toThrow(
      "Embedded source ICC interpretation",
    );
  }
  const ordinary = parseFrameRecord(
    "frame|stream_index=2|side_datum/h_26_45__user_data_unregistered_sei_message:side_data_type=H.26[45] User Data Unregistered SEI message|side_datum/exif_metadata:side_data_type=EXIF metadata",
    2,
  )!;
  expect(ordinary.image?.colorProfile).toBeUndefined();
});
