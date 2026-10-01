import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Experiment } from "./lab";
import { referenceFrames, readIdentity } from "./pattern";
import { FFMPEG, FFPROBE, DECODER_PIXELS, FRAME_FIELDS, lineConsumer } from "./tools";

export const GENERATE_RAW = [
  "-hide_banner",
  "-v",
  "error",
  "-nostdin",
  "-f",
  "rawvideo",
  "-pixel_format",
  "rgba",
  "-video_size",
  "96x64",
  "-framerate",
  "25",
  "-i",
  "pipe:0",
];
export const STRICT_INPUT = [
  "-hide_banner",
  "-v",
  "error",
  "-nostdin",
  "-xerror",
  "-err_detect",
  "explode",
  "-max_pixels",
  String(DECODER_PIXELS),
  "-threads",
  "1",
];

export async function generateSmall(
  e: Experiment,
  name: string,
  options: {
    starts?: number[];
    frames?: number;
    stream?: number;
    buffered?: boolean;
    alpha?: boolean;
    width?: number;
    height?: number;
  } = {},
): Promise<string> {
  const path = join(e.path, name);
  const count = options.frames ?? options.starts?.length ?? 4;
  const width = options.width ?? 96;
  const height = options.height ?? 64;
  const filters = options.starts
    ? [
        "-vf",
        `settb=1/1000,setpts=${options.starts.map((start, i) => `${start}*eq(N\\,${i})`).join("+")}`,
      ]
    : [];
  const codec = options.buffered
    ? [
        "-c:v",
        "libx264",
        "-crf",
        "12",
        "-bf",
        "2",
        "-g",
        "12",
        "-x264-params",
        "b-adapt=0:scenecut=0",
        "-pix_fmt",
        "yuv420p",
      ]
    : ["-c:v", "ffv1", "-pix_fmt", "bgra"];
  await e.tool(
    FFMPEG,
    [
      ...GENERATE_RAW.slice(0, -2),
      "-video_size",
      `${width}x${height}`,
      "-i",
      "pipe:0",
      ...filters,
      ...(options.starts ? ["-enc_time_base", "filter"] : []),
      "-frames:v",
      String(count),
      "-fps_mode",
      "passthrough",
      ...codec,
      "-y",
      path,
    ],
    { input: referenceFrames(count, width, height, options.alpha, options.stream) },
  );
  return path;
}

export function parseFields(line: string): Record<string, string> {
  const parts = line.split("|");
  assert.equal(parts.shift(), "frame");
  const values: Record<string, string> = {};
  for (const part of parts) {
    // An empty selected side-data section can leave a trailing separator.
    if (!part) continue;
    const equal = part.indexOf("=");
    assert.ok(equal > 0 && !part.includes("\\"), `Unexpected serialization: ${line}`);
    const key = part.slice(0, equal);
    assert.ok(!(key in values));
    values[key] = part.slice(equal + 1);
  }
  return values;
}

export async function frameRecords(
  e: Experiment,
  path: string,
  stream = 0,
): Promise<Record<string, string>[]> {
  const frames: Record<string, string>[] = [];
  const reader = lineConsumer((line) => {
    if (!line) return;
    frames.push(parseFields(line));
    assert.ok(frames.length <= 64, "Only small fixtures may collect records.");
  });
  await e.tool(
    FFPROBE,
    [
      "-v",
      "error",
      "-err_detect",
      "explode",
      "-max_pixels",
      String(DECODER_PIXELS),
      "-threads",
      "1",
      "-select_streams",
      String(stream),
      "-show_frames",
      "-show_entries",
      FRAME_FIELDS,
      "-of",
      "compact=p=1:nk=0",
      path,
    ],
    { consume: reader.chunk },
  );
  reader.finish();
  return frames;
}

export async function decodeFrames(
  e: Experiment,
  path: string,
  width = 96,
  height = 64,
  stream = 0,
): Promise<number[]> {
  const bytes = width * height * 4;
  let pending = Buffer.alloc(0);
  const identities: number[] = [];
  await e.tool(
    FFMPEG,
    [
      ...STRICT_INPUT,
      "-i",
      path,
      "-map",
      `0:${stream}`,
      "-an",
      "-sn",
      "-dn",
      "-fps_mode",
      "passthrough",
      "-pix_fmt",
      "rgba",
      "-f",
      "rawvideo",
      "pipe:1",
    ],
    {
      consume(chunk) {
        pending = Buffer.concat([pending, chunk]);
        while (pending.length >= bytes) {
          identities.push(readIdentity(pending.subarray(0, bytes), width));
          pending = pending.subarray(bytes);
        }
      },
    },
  );
  assert.equal(pending.length, 0, "Raw frame incomplete at EOF.");
  return identities;
}

export async function timingEvidence(e: Experiment): Promise<object> {
  const constant = await generateSmall(e, "constant.mkv");
  const shifted = await generateSmall(e, "shifted.mkv", { starts: [5000, 5040, 5120, 5500] });
  const buffered = await generateSmall(e, "buffered.mp4", { frames: 12, buffered: true });
  const single = await generateSmall(e, "one-frame.mkv", { frames: 1 });
  const constantRecords = await frameRecords(e, constant);
  const shiftedRecords = await frameRecords(e, shifted);
  const bufferedRecords = await frameRecords(e, buffered);
  assert.deepEqual(
    constantRecords.map((f) => f.best_effort_timestamp),
    ["0", "40", "80", "120"],
  );
  assert.deepEqual(
    shiftedRecords.map((f) => f.best_effort_timestamp),
    ["5000", "5040", "5120", "5500"],
  );
  assert.deepEqual(
    shiftedRecords.map((f) => f.duration),
    ["40", "40", "40", "40"],
  );
  assert.ok(
    bufferedRecords.some((f) => f.pict_type === "B"),
    "Fixture must actually contain reordered frames.",
  );
  assert.equal(bufferedRecords.length, 12);
  assert.deepEqual(await decodeFrames(e, constant), [1, 2, 3, 4]);
  assert.deepEqual(await decodeFrames(e, shifted), [1, 2, 3, 4]);
  assert.deepEqual(await decodeFrames(e, buffered), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(await decodeFrames(e, single), [1]);
  const starts = [0n, 40n, 120n, 500n];
  const at = (targetNumerator: bigint, denominator = 1n) => {
    let selected = 0;
    for (let i = 0; i < starts.length; i++)
      if (starts[i]! * denominator <= targetNumerator) selected = i + 1;
    return selected;
  };
  assert.deepEqual(
    [0n, 39n, 40n, 70n, 120n, 270n, 539n].map((t) => at(t)),
    [1, 1, 2, 2, 3, 3, 4],
  );
  assert.deepEqual(
    [0n, 400n].map((t) => at(t)),
    [1, 3],
  ); // 2.5 FPS; end-exclusive at 540 ms.
  assert.deepEqual(
    [0n, 100n, 200n, 300n, 400n, 500n].map((t) => at(t)),
    [1, 2, 3, 3, 3, 4],
  );
  // Exercise the exact identities through extraction, independently of the mapping loop.
  const repeats = join(e.path, "repeats.rgba");
  const output = await e.tool(FFMPEG, [
    ...STRICT_INPUT,
    "-i",
    shifted,
    "-vf",
    "select='eq(n,0)+eq(n,1)+eq(n,2)+eq(n,3)'",
    "-fps_mode",
    "passthrough",
    "-pix_fmt",
    "rgba",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
  await writeFile(repeats, output.stdout);
  assert.deepEqual(
    [1, 2, 3, 3, 3, 4].map((n) =>
      readIdentity(output.stdout.subarray((n - 1) * 96 * 64 * 4, n * 96 * 64 * 4), 96),
    ),
    [1, 2, 3, 3, 3, 4],
  );
  const truncated = join(e.path, "truncated.mp4");
  const original = await readFile(buffered);
  await writeFile(truncated, original.subarray(0, Math.floor(original.length / 2)));
  const failure = await e.tool(
    FFPROBE,
    [
      "-v",
      "error",
      "-show_error",
      "-show_frames",
      "-show_entries",
      FRAME_FIELDS,
      "-of",
      "compact=p=1:nk=0",
      truncated,
    ],
    { allowFailure: true },
  );
  assert.ok(
    failure.code !== 0 || failure.stderr.trim(),
    "Damaged input must not count as a clean scan.",
  );
  return {
    constantRecords,
    shiftedRecords,
    bufferedRecords,
    relativeStartsMs: [0, 40, 120, 500],
    reliableEndMs: 540,
    midpointFrame: 3,
    interval100ms: [1, 2, 3, 3, 3, 4],
    fps2_5: [1, 3],
    singlePresetRoles: [1, 1, 1],
    damagedInputRejected: true,
  };
}
