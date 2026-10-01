import assert from "node:assert/strict";
import { mkdir, rename, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Experiment } from "./lab";
import { referenceFrames, readIdentity } from "./pattern";
import { PngStager } from "./png-stager";
import { FFMPEG, FFPROBE, DECODER_PIXELS, FRAME_FIELDS, lineConsumer } from "./tools";
import { parseFields, STRICT_INPUT } from "./timing-evidence";

export async function workloadEvidence(e: Experiment, seconds: number): Promise<object> {
  const count = seconds * 15,
    width = 320,
    height = 180;
  const source = join(e.path, "continuous.mp4");
  const generation = await e.tool(
    FFMPEG,
    [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "rawvideo",
      "-pixel_format",
      "rgba",
      "-video_size",
      `${width}x${height}`,
      "-framerate",
      "15",
      "-i",
      "pipe:0",
      "-frames:v",
      String(count),
      "-fps_mode",
      "passthrough",
      "-c:v",
      "libx264",
      "-crf",
      "0",
      "-pix_fmt",
      "yuv444p",
      "-threads",
      "1",
      source,
    ],
    { input: referenceFrames(count, width, height) },
  );
  const info = await e.tool(FFPROBE, [
    "-v",
    "error",
    "-show_entries",
    "stream=index,time_base,duration_ts,nb_frames",
    "-of",
    "json",
    source,
  ]);
  const metadata = JSON.parse(info.stdout.toString("utf8")).streams[0];
  assert.equal(metadata.time_base, "1/15360");
  assert.equal(metadata.duration_ts, seconds * 15360);
  assert.equal(metadata.nb_frames, String(count));
  let ordinal = 0,
    first: Record<string, string> | undefined,
    last: Record<string, string> | undefined;
  const frames = lineConsumer((line) => {
    if (!line) return;
    const frame = parseFields(line);
    assert.equal(frame.best_effort_timestamp, String(ordinal * 1024));
    assert.equal(frame.duration, "1024");
    first ??= frame;
    last = frame;
    ordinal++;
  });
  const scanArgs = [
    "-v",
    "error",
    "-err_detect",
    "explode",
    "-max_pixels",
    String(DECODER_PIXELS),
    "-threads",
    "1",
    "-select_streams",
    "0",
    "-show_frames",
    "-show_entries",
    FRAME_FIELDS,
    "-of",
    "compact=p=1:nk=0",
    source,
  ];
  const scan = await e.tool(FFPROBE, scanArgs, { consume: frames.chunk });
  frames.finish();
  assert.equal(ordinal, count);
  assert.equal(last!.best_effort_timestamp, String((count - 1) * 1024));
  const measurements: object[] = [];
  for (const target of [1, count - 15, count]) {
    let seen = 0,
      identity = 0;
    const reader = lineConsumer((line) => {
      if (line && seen < target) {
        parseFields(line);
        seen++;
        identity = seen;
      }
    });
    const resolution = await e.tool(FFPROBE, scanArgs, {
      consume(chunk) {
        reader.chunk(chunk);
        if (seen === target) return false;
      },
    });
    assert.equal(seen, target);
    measurements.push({
      target,
      observedFrames: seen,
      observedOrdinal: identity,
      milliseconds: resolution.milliseconds,
    });
  }
  const cachedStart = performance.now();
  const cache = new Map([
    ["first", first],
    ["last", last],
  ]);
  assert.equal(cache.get("last")!.best_effort_timestamp, String((count - 1) * 1024));
  const cachedMs = performance.now() - cachedStart;
  const endpoints = await e.tool(FFMPEG, [
    ...STRICT_INPUT,
    "-i",
    source,
    "-vf",
    `select='eq(n,0)+eq(n,${count - 1})'`,
    "-fps_mode",
    "passthrough",
    "-pix_fmt",
    "rgba",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
  const bytes = width * height * 4;
  assert.equal(endpoints.stdout.length, bytes * 2);
  assert.equal(readIdentity(endpoints.stdout.subarray(0, bytes), width), 1);
  assert.equal(readIdentity(endpoints.stdout.subarray(bytes), width), count);
  const stage = join(e.path, "staging"),
    final = join(e.path, "final");
  await mkdir(stage);
  await mkdir(final);
  const writer = new PngStager(
    stage,
    async (path, serial) => {
      await rename(path, join(final, `${serial}.png`));
      e.images(1);
    },
    { signal: e.signal },
  );
  let exportResult;
  try {
    exportResult = await e.tool(
      FFMPEG,
      [
        ...STRICT_INPUT,
        "-i",
        source,
        "-vf",
        "select='not(mod(n,15))'",
        "-fps_mode",
        "passthrough",
        "-c:v",
        "png",
        "-threads",
        "1",
        "-f",
        "image2pipe",
        "pipe:1",
      ],
      { consume: (chunk) => writer.chunk(chunk) },
    );
    await writer.finish();
  } finally {
    await writer.settle();
  }
  assert.equal((await readdir(final)).length, seconds);
  let pending = Buffer.alloc(0),
    serial = 0;
  const decode = await e.tool(
    FFMPEG,
    [
      ...STRICT_INPUT,
      "-framerate",
      "1",
      "-i",
      join(final, "%d.png"),
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
          assert.equal(readIdentity(pending.subarray(0, bytes), width), serial * 15 + 1);
          serial++;
          pending = Buffer.from(pending.subarray(bytes));
        }
      },
    },
  );
  assert.equal(pending.length, 0);
  assert.equal(serial, seconds);
  return {
    seconds,
    width,
    height,
    sourceFrames: count,
    exportImages: seconds,
    independentEndpoints: true,
    generationMs: generation.milliseconds,
    initialFullScanMs: scan.milliseconds,
    prefixMeasurements: measurements,
    cachedIdentityLookupMs: cachedMs,
    endpointExtractionMs: endpoints.milliseconds,
    exportMs: exportResult.milliseconds,
    decodeCheckMs: decode.milliseconds,
    stagingPeaks: writer.peaks,
    scope:
      "feasibility harness; production prefix/cached resolution performance is verified in Phase 3",
  };
}
