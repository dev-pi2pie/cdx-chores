// Opt-in public synthetic comparison of video-native and external display interpretations.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { exportResolvedFrames } from "../../../src/cli/video-frames/export";
import { FrameResolver } from "../../../src/cli/video-frames/resolver";
import { extractedProfile } from "./color-profile-proof";
import { createLab, type Experiment } from "./lab";
import { FFMPEG, FFPROBE } from "./tools";

const HEIGHT = 32;
const COLOR_CONTROLS_RGB = [
  [192, 32, 32],
  [32, 192, 32],
  [32, 32, 192],
] as const;
const PATCHES: [number, number, number][] = [
  [16, 128, 128],
  [20, 128, 128],
  [24, 128, 128],
  [32, 128, 128],
  [48, 128, 128],
  [80, 128, 128],
  [128, 128, 128],
  [235, 128, 128],
  [24, 130, 128],
  [32, 132, 126],
  [48, 124, 132],
  [64, 128, 136],
  [64, 136, 128],
  ...COLOR_CONTROLS_RGB.map<[number, number, number]>(([r, g, b]) => {
    // Independent BT.709 NCL limited-range encoding, before H.264 quantization.
    const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return [
      Math.round(16 + 219 * y),
      Math.round(128 + (224 * (b / 255 - y)) / (2 * (1 - 0.0722))),
      Math.round(128 + (224 * (r / 255 - y)) / (2 * (1 - 0.2126))),
    ];
  }),
];
const WIDTH = PATCHES.length * 32;
const NATIVE_MATRIX_ROUNDING_TOLERANCE = 2;
const EXTERNAL_PROFILE =
  "https://registry.color.org/profile-library/profiles/ITU-RBT709ReferenceDisplay.icc";
const TOOL = ["-nostdin", "-v", "error", "-threads", "1", "-filter_threads", "1"];

export async function proveDisplayInterpretations(
  e: Experiment,
  nativeHelper: string,
  transfer: "bt709" | "iec61966-2-1",
) {
  const yuv = Buffer.alloc((WIDTH * HEIGHT * 3) / 2, 128);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) yuv[y * WIDTH + x] = PATCHES[Math.floor(x / 32)]![0];
  for (let y = 0; y < HEIGHT / 2; y++)
    for (let x = 0; x < WIDTH / 2; x++) {
      yuv[WIDTH * HEIGHT + (y * WIDTH) / 2 + x] = PATCHES[Math.floor(x / 16)]![1];
      yuv[(WIDTH * HEIGHT * 5) / 4 + (y * WIDTH) / 2 + x] = PATCHES[Math.floor(x / 16)]![2];
    }
  const sourceRaw = join(e.path, "source.yuv");
  const source = join(e.path, "source.mp4");
  await writeFile(sourceRaw, yuv);
  await e.tool(FFMPEG, [
    ...TOOL,
    "-f",
    "rawvideo",
    "-pixel_format",
    "yuv420p",
    "-video_size",
    `${WIDTH}x${HEIGHT}`,
    "-framerate",
    "1",
    "-color_range",
    "tv",
    "-i",
    sourceRaw,
    "-vf",
    `setparams=range=tv:color_primaries=bt709:color_trc=${transfer}:colorspace=bt709`,
    "-frames:v",
    "1",
    "-c:v",
    "libx264",
    "-crf",
    "1",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-color_range",
    "tv",
    "-colorspace",
    "bt709",
    "-color_primaries",
    "bt709",
    "-color_trc",
    transfer,
    "-threads",
    "1",
    "-y",
    source,
  ]);
  const metadata = JSON.parse(
    (
      await e.tool(FFPROBE, [
        "-v",
        "error",
        "-show_entries",
        "stream=profile,pix_fmt,width,height,color_space,color_range,color_primaries,color_transfer",
        "-of",
        "json",
        source,
      ])
    ).stdout.toString("utf8"),
  ).streams[0];
  assert.equal(metadata.profile, "High");
  assert.equal(metadata.color_transfer, transfer);
  assert.equal(metadata.color_space, "bt709");
  assert.equal(metadata.color_range, "tv");
  assert.equal(metadata.color_primaries, "bt709");
  const decodedYuv = (
    await e.tool(FFMPEG, [
      ...TOOL,
      "-i",
      source,
      "-frames:v",
      "1",
      "-pix_fmt",
      "yuv420p",
      "-f",
      "rawvideo",
      "pipe:1",
    ])
  ).stdout;
  const decodedYuvValues = PATCHES.map((_, patch) => [
    decodedYuv[16 * WIDTH + patch * 32 + 16]!,
    decodedYuv[WIDTH * HEIGHT + (8 * WIDTH) / 2 + patch * 16 + 8]!,
    decodedYuv[(WIDTH * HEIGHT * 5) / 4 + (8 * WIDTH) / 2 + patch * 16 + 8]!,
  ]);
  const equationRgb = decodedYuvValues.map(([y, cb, cr]) => {
    const yy = ((y! - 16) * 255) / 219;
    const u = ((cb! - 128) * 255) / 224;
    const v = ((cr! - 128) * 255) / 224;
    const rgb = [
      yy + 2 * (1 - 0.2126) * v,
      yy - ((2 * 0.0722 * (1 - 0.0722)) / 0.7152) * u - ((2 * 0.2126 * (1 - 0.2126)) / 0.7152) * v,
      yy + 2 * (1 - 0.0722) * u,
    ];
    assert.ok(
      rgb.every((value) => value >= 0 && value <= 255),
      "Native decoder acceptance controls must remain in gamut after source decoding",
    );
    return rgb.map(Math.round);
  });
  const nativeDirectory = join(e.path, "native");
  await mkdir(nativeDirectory);
  await e.tool(nativeHelper, [
    "--input",
    source,
    "--output-dir",
    nativeDirectory,
    "--seconds",
    "0",
  ]);
  e.images(1);
  const nativeDescription = JSON.parse(
    await readFile(join(nativeDirectory, "native-reference.json"), "utf8"),
  );
  assert.equal(nativeDescription.actualTimeValue, 0);
  assert.deepEqual([nativeDescription.width, nativeDescription.height], [WIDTH, HEIGHT]);
  assert.equal(nativeDescription.bitsPerComponent, 8);
  assert.equal(nativeDescription.profileSubstitutionRequested, false);
  const nativeProfile = await readFile(join(nativeDirectory, "native-color-space.icc"));
  const pngProfile = extractedProfile(
    await readFile(join(nativeDirectory, "native-frame.png")),
    "png",
  );
  assert.ok(pngProfile, "Native ImageIO PNG must carry a saved profile for this evidence");
  const nativePixels = (
    await e.tool(FFMPEG, [
      ...TOOL,
      "-i",
      join(nativeDirectory, "native-frame.png"),
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "pipe:1",
    ])
  ).stdout;
  const nativePatchValues = PATCHES.map((_, patch) => [
    ...nativePixels.subarray(
      (16 * WIDTH + patch * 32 + 16) * 3,
      (16 * WIDTH + patch * 32 + 16) * 3 + 3,
    ),
  ]);
  const resolver = new FrameResolver(source, { ffprobe: FFPROBE });
  const identity = await resolver.resolve({ kind: "first" }, e.signal);
  const output = await exportResolvedFrames(resolver, [{ identity, name: "production.png" }], {
    folder: e.path,
    image: { format: "png" },
    ffmpeg: FFMPEG,
    ffprobe: FFPROBE,
    signal: e.signal,
  });
  e.images(output.written);
  assert.equal(output.completed, true);
  const productionProfile = extractedProfile(
    await readFile(join(e.path, "production.png")),
    "png",
  )!;
  const productionPixels = (
    await e.tool(FFMPEG, [
      ...TOOL,
      "-i",
      join(e.path, "production.png"),
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "pipe:1",
    ])
  ).stdout;
  const productionPatchValues = PATCHES.map((_, patch) => [
    ...productionPixels.subarray(
      (16 * WIDTH + patch * 32 + 16) * 3,
      (16 * WIDTH + patch * 32 + 16) * 3 + 3,
    ),
  ]);
  const maximumNativeEquationDifference = maximumDifference(nativePatchValues, equationRgb);
  const maximumProductionEquationDifference = maximumDifference(productionPatchValues, equationRgb);
  const maximumNativeProductionDifference = maximumDifference(
    nativePatchValues,
    productionPatchValues,
  );
  assert.ok(
    maximumNativeEquationDifference <= NATIVE_MATRIX_ROUNDING_TOLERANCE,
    "Native decoded centers exceed predeclared matrix rounding bound",
  );
  assert.ok(
    maximumProductionEquationDifference <= 1,
    "Production decoded centers exceed specified matrix arithmetic precision",
  );
  assert.ok(
    maximumNativeProductionDifference <= NATIVE_MATRIX_ROUNDING_TOLERANCE,
    "Native and production coded samples exceed predeclared matrix rounding bound",
  );
  const response = await fetch(EXTERNAL_PROFILE, { signal: e.signal });
  assert.ok(response.ok);
  const externalProfile = Buffer.from(await response.arrayBuffer());
  assert.ok(externalProfile.length < 1024 * 1024);
  assert.equal(externalProfile.toString("ascii", 36, 40), "acsp");
  const profiles: Record<string, Buffer> = {
    native: nativeProfile,
    nativePNG: pngProfile,
    externalDisplay: externalProfile,
    production: productionProfile,
  };
  const samples = [
    ...equationRgb,
    ...Array.from({ length: 256 }, (_, value) => [value, value, value]),
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [0, 255, 255],
    [255, 0, 255],
    [19, 32, 48],
    [64, 128, 192],
    [192, 64, 128],
    [240, 160, 80],
  ];
  const interpretations = [];
  for (const [name, profile] of Object.entries(profiles)) {
    const file = join(e.path, `${name}.icc`);
    await writeFile(file, profile);
    const xyzFile = join(e.path, `${name}-xyz.json`);
    const srgbFile = join(e.path, `${name}-srgb.json`);
    const base = [
      resolve("scripts/spikes/video-frames/color-cmm-reference.py"),
      "--source-icc",
      file,
      "--samples-rgb",
      JSON.stringify(samples),
      "--intent",
      "relative",
    ];
    await e.tool("python3", [...base, "--target", "xyz", "--output", xyzFile]);
    await e.tool("python3", [...base, "--target", "srgb", "--output", srgbFile]);
    interpretations.push({
      name,
      bytes: profile.length,
      sha256: createHash("sha256").update(profile).digest("hex"),
      curves: profileCurves(profile),
      xyz: JSON.parse(await readFile(xyzFile, "utf8")),
      srgb: JSON.parse(await readFile(srgbFile, "utf8")),
    });
  }
  const nativeInterpretation = interpretations.find((profile) => profile.name === "native")!;
  const productionInterpretation = interpretations.find(
    (profile) => profile.name === "production",
  )!;
  const maximumNativeDisplayDifference = Math.max(
    ...samples.flatMap((_, sample) =>
      [0, 1, 2].map((channel) =>
        Math.abs(
          productionInterpretation.srgb[sample][channel] -
            nativeInterpretation.srgb[sample][channel],
        ),
      ),
    ),
  );
  assert.ok(
    maximumNativeDisplayDifference <= 1,
    "Production image interpretation must agree with native ICC within 8-bit rounding",
  );
  const actualDisplayPixels: number[][][] = [];
  for (const [name, pixels] of [
    ["native", nativePatchValues],
    ["production", productionPatchValues],
  ] as const) {
    const file = join(e.path, `${name}-actual-srgb.json`);
    await e.tool("python3", [
      resolve("scripts/spikes/video-frames/color-cmm-reference.py"),
      "--source-icc",
      join(e.path, `${name}.icc`),
      "--samples-rgb",
      JSON.stringify(pixels),
      "--intent",
      "relative",
      "--target",
      "srgb",
      "--output",
      file,
    ]);
    actualDisplayPixels.push(JSON.parse(await readFile(file, "utf8")));
  }
  const maximumActualDisplayDifference = maximumDifference(
    actualDisplayPixels[0]!,
    actualDisplayPixels[1]!,
  );
  assert.ok(
    maximumActualDisplayDifference <= NATIVE_MATRIX_ROUNDING_TOLERANCE,
    "Actual native and production display pixels exceed the declared 8-bit rounding bound",
  );
  const sourceProfileDetection = await proveSourceIcc(e, source, nativeProfile);
  const frameProfileDetection = await proveFrameOnlyIcc(
    e,
    join(nativeDirectory, "native-frame.png"),
  );
  return {
    sourceMetadata: metadata,
    acceptanceScope:
      "In-gamut flat patch centers only, independent matrix arithmetic and ICC interpretation",
    excludedDiagnostic:
      "Earlier out-of-gamut BT.601-like green/blue triples tagged BT.709 differed radically in native decoding. Native output is not an oracle for clipping or an arbitrary-gamut rendering policy.",
    colorControlsRgb: COLOR_CONTROLS_RGB,
    requestedYuv: PATCHES,
    actualYuv: decodedYuvValues,
    equationRgb,
    nativePatchValues,
    productionPatchValues,
    maximumNativeEquationDifference,
    maximumProductionEquationDifference,
    maximumNativeProductionDifference,
    nativeMatrixRoundingTolerance: NATIVE_MATRIX_ROUNDING_TOLERANCE,
    nativeDescription,
    externalProfileSource: EXTERNAL_PROFILE,
    interpretations,
    interpretationSamples: samples,
    maximumNativeDisplayDifference,
    actualDisplayPixels,
    maximumActualDisplayDifference,
    sourceProfileDetection,
    frameProfileDetection,
  };
}

async function proveSourceIcc(e: Experiment, source: string, profile: Buffer) {
  const input = await readFile(source);
  const boxes = readBoxes(input);
  assert.equal(
    boxes.at(-1)!.type,
    "moov",
    "Fixture requires moov last to keep existing chunk offsets valid",
  );
  let replaced = 0;
  const rewrite = (box: Box): Buffer => {
    if (["moov", "trak", "mdia", "minf", "stbl"].includes(box.type))
      return makeBox(box.type, Buffer.concat(readBoxes(box.data).map(rewrite)));
    if (box.type === "stsd")
      return makeBox(
        box.type,
        Buffer.concat([box.data.subarray(0, 8), ...readBoxes(box.data.subarray(8)).map(rewrite)]),
      );
    if (box.type === "avc1" || box.type === "avc3") {
      const children = readBoxes(box.data.subarray(78));
      const color = makeBox("colr", Buffer.concat([Buffer.from("prof", "ascii"), profile]));
      replaced++;
      return makeBox(
        box.type,
        Buffer.concat([
          box.data.subarray(0, 78),
          ...children.filter((child) => child.type !== "colr").map(rewrite),
          color,
        ]),
      );
    }
    return makeBox(box.type, box.data);
  };
  const output = join(e.path, "source-with-icc.mp4");
  await writeFile(
    output,
    Buffer.concat(
      boxes.map((box) => (box.type === "moov" ? rewrite(box) : makeBox(box.type, box.data))),
    ),
  );
  assert.equal(replaced, 1);
  const metadata = JSON.parse(
    (
      await e.tool(FFPROBE, [
        "-v",
        "error",
        "-show_entries",
        "stream_side_data=side_data_type",
        "-of",
        "json",
        output,
      ])
    ).stdout.toString("utf8"),
  );
  const exposed = metadata.streams[0].side_data_list.some(
    (side: { side_data_type: string }) => side.side_data_type.toLowerCase() === "icc profile",
  );
  assert.equal(exposed, true, "FFprobe must expose embedded video ICC data");
  const resolver = new FrameResolver(output, { ffprobe: FFPROBE });
  const identity = await resolver.resolve({ kind: "first" }, e.signal);
  await assert.rejects(
    exportResolvedFrames(resolver, [{ identity, name: "must-not-publish.png" }], {
      folder: e.path,
      image: { format: "png" },
      signal: e.signal,
      ffprobe: FFPROBE,
      ffmpeg: FFMPEG,
    }),
    (error: unknown) => (error as { code?: string }).code === "FRAME_COLOR_UNSUPPORTED",
  );
  await assertMissing(join(e.path, "must-not-publish.png"));
  return { containerProfile: "MP4 colr/prof", ffprobeExposed: true, productionRejected: true };
}

async function proveFrameOnlyIcc(e: Experiment, source: string) {
  const streamMetadata = JSON.parse(
    (
      await e.tool(FFPROBE, [
        "-v",
        "error",
        "-show_entries",
        "stream_side_data=side_data_type",
        "-of",
        "json",
        source,
      ])
    ).stdout.toString("utf8"),
  );
  assert.equal(streamMetadata.streams.length, 1);
  assert.equal(
    hasIccDescription(streamMetadata.streams),
    false,
    "Frame-only ICC fixture must not expose a stream ICC",
  );
  const frameMetadata = JSON.parse(
    (
      await e.tool(FFPROBE, [
        "-v",
        "error",
        "-show_frames",
        "-show_entries",
        "frame=stream_index:frame_tags=:frame_side_data=side_data_type",
        "-of",
        "json",
        source,
      ])
    ).stdout.toString("utf8"),
  );
  assert.equal(frameMetadata.frames.length, 1);
  assert.equal(
    hasIccDescription(frameMetadata.frames),
    true,
    "Native PNG must expose its ICC through decoded-frame side data",
  );
  const resolver = new FrameResolver(source, { ffprobe: FFPROBE });
  const identity = await resolver.resolve({ kind: "first" }, e.signal);
  const name = "must-not-publish-frame-icc.png";
  await assert.rejects(
    exportResolvedFrames(resolver, [{ identity, name }], {
      folder: e.path,
      image: { format: "png" },
      signal: e.signal,
      ffprobe: FFPROBE,
      ffmpeg: FFMPEG,
    }),
    (error: unknown) =>
      (error as { code?: string }).code === "FRAME_COLOR_UNSUPPORTED" &&
      error instanceof Error &&
      error.message.includes("Embedded source ICC interpretation"),
  );
  await assertMissing(join(e.path, name));
  return {
    fixture: "Native ImageIO PNG",
    streamIccExposed: false,
    frameIccExposed: true,
    frameIccRefusalObserved: true,
    productionRejected: true,
    imagePublished: false,
  };
}

function hasIccDescription(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasIccDescription);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) =>
      (key === "side_data_type" &&
        typeof child === "string" &&
        child.toLowerCase() === "icc profile") ||
      hasIccDescription(child),
  );
}

async function assertMissing(path: string) {
  await assert.rejects(
    access(path),
    (error: unknown) => (error as { code?: string }).code === "ENOENT",
  );
}

interface Box {
  type: string;
  data: Buffer;
}
function readBoxes(bytes: Buffer): Box[] {
  const boxes: Box[] = [];
  for (let offset = 0; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    assert.ok(size >= 8 && offset + size <= bytes.length);
    boxes.push({
      type: bytes.toString("ascii", offset + 4, offset + 8),
      data: bytes.subarray(offset + 8, offset + size),
    });
    offset += size;
  }
  return boxes;
}
function makeBox(type: string, data: Buffer) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length + 8);
  header.write(type, 4);
  return Buffer.concat([header, data]);
}

function profileCurves(profile: Buffer) {
  const curves = [];
  for (let i = 0; i < profile.readUInt32BE(128); i++) {
    const position = 132 + 12 * i;
    const name = profile.toString("ascii", position, position + 4);
    if (!name.endsWith("TRC")) continue;
    const offset = profile.readUInt32BE(position + 4);
    const size = profile.readUInt32BE(position + 8);
    const body = profile.subarray(offset, offset + size);
    const type = body.toString("ascii", 0, 4);
    if (type === "curv") {
      const count = body.readUInt32BE(8);
      curves.push({
        name,
        type,
        count,
        gamma: count === 1 ? body.readUInt16BE(12) / 256 : undefined,
      });
    } else if (type === "para")
      curves.push({
        name,
        type,
        function: body.readUInt16BE(8),
        parameters: Array.from(
          { length: (size - 12) / 4 },
          (_, index) => body.readInt32BE(12 + index * 4) / 65536,
        ),
      });
    else curves.push({ name, type });
  }
  return curves;
}

function maximumDifference(actual: number[][], expected: number[][]) {
  return Math.max(
    ...actual.flatMap((row, sample) =>
      row.map((value, channel) => Math.abs(value - expected[sample]![channel]!)),
    ),
  );
}

if (process.argv.includes("--run-display-reference")) {
  const index = process.argv.indexOf("--native-helper");
  assert.ok(index >= 0 && process.argv[index + 1]);
  const helper = resolve(process.argv[index + 1]!);
  const lab = await createLab(10);
  try {
    for (const transfer of ["bt709", "iec61966-2-1"] as const)
      await lab.check(`display-reference-${transfer}`, 2, 2 * 1024 * 1024, (e) =>
        proveDisplayInterpretations(e, helper, transfer),
      );
  } finally {
    lab.finish();
  }
}
