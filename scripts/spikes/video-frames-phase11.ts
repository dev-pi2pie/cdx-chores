// Opt-in built-CLI integration proof. Importing this helper starts no tools or media work.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, link, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createLab, type Experiment } from "./video-frames/lab";
import {
  extractedProfile,
  inspectProfile,
  type Transfer,
} from "./video-frames/color-profile-proof";
import { FFMPEG, FFPROBE, scratchBytes } from "./video-frames/tools";

const WIDTH = 128;
const HEIGHT = 16;
const TOOL = ["-nostdin", "-v", "error", "-threads", "1", "-filter_threads", "1"];
const CLI = resolve("dist/esm/bin.mjs");
const MAX_RETAINED = 3 * 1024 * 1024;
type Format = "png" | "jpg" | "webp";
type Quality = "full" | "high" | "medium";

function patches(frame: number, width = WIDTH, height = HEIGHT) {
  const colors = [
    [0, 0, 0],
    [19 + frame, 19 + frame, 19 + frame],
    [64, 64, 64],
    [128, 128, 128],
    [255, 255, 255],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
  ];
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const color = colors[Math.min(7, Math.floor((x * 8) / width))]!;
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = color[channel]!;
      pixels[offset + 3] = 255;
    }
  return pixels;
}

// Independent nearest-neighbor coordinates, using the documented center mapping and rounding.
function scaled(
  source: Buffer,
  width: number,
  height: number,
  outputWidth: number,
  outputHeight: number,
) {
  const pixels = Buffer.alloc(outputWidth * outputHeight * 4);
  for (let y = 0; y < outputHeight; y++)
    for (let x = 0; x < outputWidth; x++) {
      const sourceX = Math.min(width - 1, Math.floor(((x + 0.5) * width) / outputWidth));
      const sourceY = Math.min(height - 1, Math.floor(((y + 0.5) * height) / outputHeight));
      const offset = (sourceY * width + sourceX) * 4;
      source.copy(pixels, (y * outputWidth + x) * 4, offset, offset + 4);
    }
  return pixels;
}

function digest(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function source(
  e: Experiment,
  name: string,
  transfer: string,
  primaries = "bt709",
  width = WIDTH,
  height = HEIGHT,
  frames = 4,
) {
  const raw = join(e.path, name + ".rgba");
  await writeFile(
    raw,
    Buffer.concat(Array.from({ length: frames }, (_, frame) => patches(frame, width, height))),
  );
  const movie = join(e.path, name + ".mkv");
  await e.tool(FFMPEG, [
    ...TOOL,
    "-f",
    "rawvideo",
    "-pixel_format",
    "rgba",
    "-video_size",
    `${width}x${height}`,
    "-framerate",
    "2",
    "-i",
    raw,
    "-vf",
    `setparams=range=pc:color_primaries=${primaries}:color_trc=${transfer}:colorspace=gbr`,
    "-frames:v",
    String(frames),
    "-c:v",
    "ffv1",
    "-pix_fmt",
    "bgra",
    "-color_range",
    "pc",
    "-colorspace",
    "rgb",
    "-color_primaries",
    primaries,
    "-color_trc",
    transfer,
    "-threads",
    "1",
    "-y",
    movie,
  ]);
  const metadata = JSON.parse(
    (await e.tool(FFPROBE, ["-v", "error", "-show_streams", "-of", "json", movie])).stdout.toString(
      "utf8",
    ),
  ).streams[0];
  assert.deepEqual([metadata.width, metadata.height], [width, height]);
  assert.equal(metadata.color_primaries, primaries);
  assert.equal(metadata.color_transfer, transfer);
  assert.equal(metadata.color_space, "gbr");
  assert.equal(metadata.color_range, "pc");
  return movie;
}

async function invoke(e: Experiment, node: string, input: string, args: string[], success = true) {
  const result = await e.tool(node, [CLI, "video", "frames", "--input", input, ...args], {
    allowFailure: true,
    outputLimit: 65_536,
  });
  const text = result.stdout.toString("utf8") + result.stderr;
  assert.equal(result.code, success ? 0 : 1, text);
  assert.equal(result.signal, null);
  assert(!/Available space|Available-space check|statfs/i.test(text));
  return text;
}

async function inspect(
  e: Experiment,
  file: string,
  format: Format,
  reference: Buffer,
  width: number,
  height: number,
  transfer: Transfer,
  quality: Quality = "full",
) {
  const profile = extractedProfile(await readFile(file), format);
  assert.ok(profile, "Built output must contain an embedded ICC profile");
  const profileResult = inspectProfile(profile, transfer);
  const metadata = JSON.parse(
    (
      await e.tool(FFPROBE, [
        "-v",
        "error",
        "-show_entries",
        "stream=width,height",
        "-of",
        "json",
        file,
      ])
    ).stdout.toString("utf8"),
  ).streams[0];
  assert.deepEqual([metadata.width, metadata.height], [width, height]);
  const pixels = (
    await e.tool(FFMPEG, [
      ...TOOL,
      "-i",
      file,
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgba",
      "-f",
      "rawvideo",
      "pipe:1",
    ])
  ).stdout;
  assert.equal(pixels.length, reference.length);
  let maximumError = 0;
  for (let offset = 0; offset < pixels.length; offset++)
    maximumError = Math.max(maximumError, Math.abs(pixels[offset]! - reference[offset]!));
  // These constant patches align to JPEG 8x8 blocks, and the encoder uses 4:4:4 sampling.
  // This is a bounded codec tolerance for this recipe, not an arbitrary-image quality claim.
  const tolerance = format === "jpg" ? { full: 3, high: 4, medium: 8 }[quality] : 0;
  assert.ok(
    maximumError <= tolerance,
    `${format}/${quality} error ${maximumError} exceeds ${tolerance}`,
  );
  if (format !== "jpg") assert.deepEqual(pixels, reference);
  for (let offset = 3; offset < pixels.length; offset += 4) assert.equal(pixels[offset], 255);
  return { format, quality, width, height, maximumError, tolerance, ...profileResult };
}

const modes = [
  { name: "one", args: ["--frame-number", "2"], ordinals: [2] },
  { name: "first-last", args: ["--frame-set", "first-last"], ordinals: [1, 4] },
  { name: "first-middle-last", args: ["--frame-set", "first-middle-last"], ordinals: [1, 3, 4] },
  { name: "sequence", args: ["--interval", "500ms"], ordinals: [1, 2, 3, 4] },
  { name: "one-image-sequence", args: ["--interval", "5s"], ordinals: [1] },
] as const;

async function exportMatrix(e: Experiment, node: string) {
  const movie = await source(e, "clip", "bt709");
  const original = digest(await readFile(movie));
  const results = [];
  for (const format of ["png", "jpg", "webp"] as const)
    for (const mode of modes) {
      const scale = mode.name === "one" || mode.name === "one-image-sequence" ? 1 : 0.5;
      const quality =
        format === "jpg" && mode.name === "sequence"
          ? "medium"
          : format === "jpg" && mode.name.includes("last")
            ? "high"
            : "full";
      const folder = join(e.path, format, mode.name, "nested");
      const output =
        mode.name === "one"
          ? join(folder, `Literal Image.${format === "jpg" ? "JPEG" : format.toUpperCase()}`)
          : folder;
      await assert.rejects(access(folder), { code: "ENOENT" });
      const pattern = mode.name.includes("last")
        ? "{stem}-{selection}-frame-{frame}"
        : "{stem}-{serial_####_start_7}-frame-{frame}";
      const text = await invoke(e, node, movie, [
        ...mode.args,
        "--format",
        format,
        "--quality",
        quality,
        "--scale",
        String(scale),
        "--output",
        output,
        ...(mode.name === "one" ? [] : ["--pattern", pattern]),
      ]);
      e.images(mode.ordinals.length);
      assert.match(text, new RegExp(`Wrote ${mode.ordinals.length} image`));
      const labels = mode.name === "first-last" ? ["first", "last"] : ["first", "middle", "last"];
      const expectedNames = mode.ordinals.map((ordinal, index) =>
        mode.name === "one"
          ? `Literal Image.${format === "jpg" ? "JPEG" : format.toUpperCase()}`
          : mode.name.includes("last")
            ? `clip-${labels[index]}-frame-${ordinal}.${format}`
            : `clip-${String(index + 7).padStart(4, "0")}-frame-${ordinal}.${format}`,
      );
      assert.deepEqual((await readdir(folder)).sort(), [...expectedNames].sort());
      const inspected = [];
      for (let index = 0; index < expectedNames.length; index++)
        inspected.push(
          await inspect(
            e,
            join(folder, expectedNames[index]!),
            format,
            scaled(
              patches(mode.ordinals[index]! - 1),
              WIDTH,
              HEIGHT,
              WIDTH * scale,
              HEIGHT * scale,
            ),
            WIDTH * scale,
            HEIGHT * scale,
            "bt709",
            quality,
          ),
        );
      assert.equal(digest(await readFile(movie)), original);
      results.push({ mode: mode.name, count: expectedNames.length, scale, outputs: inspected });
    }
  return {
    recipe: "four opaque RGB patch frames, 128x16, 2 FPS, BT.709 definitions",
    runtimes: [node],
    results,
    sourceUnchanged: true,
  };
}

async function publication(e: Experiment, node: string) {
  const movie = await source(e, "clip", "bt709");
  const original = digest(await readFile(movie));
  const file = join(e.path, "nested", "Literal.png");
  await invoke(e, node, movie, ["--first-frame", "--output", file]);
  e.images(1);
  const saved = digest(await readFile(file));
  const conflict = await invoke(e, node, movie, ["--last-frame", "--output", file], false);
  assert.match(conflict, /exists|conflict/i);
  assert.equal(digest(await readFile(file)), saved);
  await invoke(e, node, movie, ["--last-frame", "--output", file, "--overwrite"]);
  e.images(1);
  await inspect(e, file, "png", patches(3), WIDTH, HEIGHT, "bt709");
  const folder = join(e.path, "frames");
  await invoke(e, node, movie, ["--frame-set", "first-last", "--output", folder]);
  e.images(2);
  await writeFile(join(folder, "unrelated.txt"), "retain unrelated file");
  const oldFirst = digest(await readFile(join(folder, "clip-first-frame.png")));
  await invoke(e, node, movie, ["--frame-set", "first-middle-last", "--output", folder], false);
  assert.equal(digest(await readFile(join(folder, "clip-first-frame.png"))), oldFirst);
  assert.deepEqual((await readdir(folder)).sort(), [
    "clip-first-frame.png",
    "clip-last-frame.png",
    "unrelated.txt",
  ]);
  await invoke(e, node, movie, [
    "--frame-set",
    "first-middle-last",
    "--output",
    folder,
    "--overwrite",
  ]);
  e.images(3);
  assert.equal(await readFile(join(folder, "unrelated.txt"), "utf8"), "retain unrelated file");
  assert.deepEqual((await readdir(folder)).sort(), [
    "clip-first-frame.png",
    "clip-last-frame.png",
    "clip-middle-frame.png",
    "unrelated.txt",
  ]);
  for (const [label, ordinal] of [
    ["first", 1],
    ["middle", 3],
    ["last", 4],
  ] as const)
    await inspect(
      e,
      join(folder, `clip-${label}-frame.png`),
      "png",
      patches(ordinal - 1),
      WIDTH,
      HEIGHT,
      "bt709",
    );
  const alias = join(e.path, "source-alias.png");
  await link(movie, alias);
  const aliasResult = await invoke(
    e,
    node,
    movie,
    ["--first-frame", "--output", alias, "--overwrite"],
    false,
  );
  assert.match(aliasResult, /aliases the video source/i);
  assert.equal(digest(await readFile(movie)), original);
  const wrong = join(e.path, "wrong-kind.png");
  await mkdir(wrong);
  const kindResult = await invoke(e, node, movie, ["--first-frame", "--output", wrong], false);
  assert.match(kindResult, /ordinary file/i);
  return {
    literalFile: "passed",
    folderCollisions: "passed",
    overwrite: "passed",
    unrelatedRetention: "passed",
    hardLinkSourceProtection: "passed",
    wrongPathKind: "passed",
    sourceUnchanged: true,
  };
}

async function minimumRuntime(e: Experiment, node: string) {
  const version = (await e.tool(node, ["--version"])).stdout.toString("utf8").trim();
  assert.equal(version, "v22.23.0");
  for (const [mode, path] of [
    ["module", resolve("dist/esm/index.mjs")],
    ["commonjs", resolve("dist/cjs/index.cjs")],
  ] as const) {
    const code =
      mode === "module"
        ? `const value = await import(${JSON.stringify(path)}); if (!Object.keys(value).length) throw new Error("No ESM exports");`
        : `const value = require(${JSON.stringify(path)}); if (!Object.keys(value).length) throw new Error("No CJS exports");`;
    await e.tool(node, [`--input-type=${mode}`, "-e", code]);
  }
  const movie = await source(e, "pixel", "iec61966-2-1", "bt709", 1, 1, 1);
  const original = digest(await readFile(movie));
  const results = [];
  for (const format of ["png", "jpg", "webp"] as const) {
    const file = join(e.path, "nested", `pixel.${format}`);
    await invoke(e, node, movie, ["--first-frame", "--format", format, "--output", file]);
    e.images(1);
    results.push(await inspect(e, file, format, patches(0, 1, 1), 1, 1, "iec61966-2-1"));
  }
  assert.equal(digest(await readFile(movie)), original);
  return { version, esm: "passed", cjs: "passed", onePixelExports: results, sourceUnchanged: true };
}

async function unsupported(e: Experiment, node: string) {
  const movie = await source(e, "wide-gamut", "bt709", "bt2020");
  const original = digest(await readFile(movie));
  const folder = join(e.path, "rejected", "nested");
  const text = await invoke(
    e,
    node,
    movie,
    ["--first-frame", "--output", join(folder, "image.png")],
    false,
  );
  assert.match(text, /Unsupported primaries\/transfer/);
  await assert.rejects(access(folder), { code: "ENOENT" });
  assert.equal(digest(await readFile(movie)), original);
  return { wideGamutSource: "rejected before output creation", sourceUnchanged: true };
}

async function main() {
  const minimumNode = process.env.VIDEO_FRAMES_MIN_NODE;
  assert.ok(minimumNode, "Set VIDEO_FRAMES_MIN_NODE to the already-available minimum Node runtime");
  const lab = await createLab(11);
  try {
    await lab.check("built-export-matrix", 33, 512 * 1024, (e) => exportMatrix(e, "node"));
    await lab.check("built-publication", 7, 128 * 1024, (e) => publication(e, "node"));
    await lab.check("minimum-node-and-one-pixel", 3, 128 * 1024, (e) =>
      minimumRuntime(e, minimumNode),
    );
    await lab.check("unsupported-source", 0, 128 * 1024, (e) => unsupported(e, "node"));
    const bytes = await scratchBytes(lab.path);
    assert.ok(
      bytes < MAX_RETAINED,
      "Retained Phase 11 artifacts must stay below the declared 3 MiB allowance",
    );
    console.log(
      JSON.stringify({
        syntheticPhase11: "passed",
        exportedImages: 43,
        retainedBytes: bytes,
        platform: process.platform,
        architecture: process.arch,
        privateInputs: false,
      }),
    );
  } finally {
    lab.finish();
  }
}

if (process.argv.includes("--run")) await main();
