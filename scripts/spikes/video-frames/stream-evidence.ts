import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Experiment } from "./lab";
import { referenceFrame, referenceFrames } from "./pattern";
import { generateSmall, frameRecords, decodeFrames, STRICT_INPUT } from "./timing-evidence";
import { FFMPEG, FFPROBE, DECODER_PIXELS, FRAME_FIELDS } from "./tools";

export async function streamEvidence(e: Experiment): Promise<object> {
  const first = await generateSmall(e, "first.mkv");
  const second = await generateSmall(e, "second.mkv", { stream: 1 });
  const cover = join(e.path, "cover.png");
  await e.tool(FFMPEG, [...STRICT_INPUT, "-i", first, "-frames:v", "1", "-c:v", "png", cover]);
  e.images(1);
  const multiple = join(e.path, "multiple.mp4");
  await e.tool(FFMPEG, [
    "-hide_banner",
    "-v",
    "error",
    "-nostdin",
    "-i",
    first,
    "-i",
    second,
    "-i",
    cover,
    "-map",
    "0:v:0",
    "-map",
    "1:v:0",
    "-map",
    "2:v:0",
    "-c:v:0",
    "libx264rgb",
    "-crf:v:0",
    "0",
    "-c:v:1",
    "libx264rgb",
    "-crf:v:1",
    "0",
    "-c:v:2",
    "copy",
    "-disposition:v:0",
    "0",
    "-disposition:v:1",
    "default",
    "-disposition:v:2",
    "attached_pic",
    multiple,
  ]);
  const check = async (path: string, expectedDefaults: number[], selected: number) => {
    const metadata = await e.tool(FFPROBE, [
      "-v",
      "error",
      "-select_streams",
      "V",
      "-show_entries",
      "stream=index,codec_type,time_base:stream_disposition=default,attached_pic",
      "-of",
      "json",
      path,
    ]);
    const streams = (
      JSON.parse(metadata.stdout.toString("utf8")) as {
        streams: { index: number; disposition: { default: number; attached_pic: number } }[];
      }
    ).streams;
    assert.deepEqual(
      streams.map((s) => s.index),
      [0, 1],
      "Cover must be excluded by the tool's eligible-video specifier.",
    );
    assert.deepEqual(
      streams.map((s) => s.disposition.default),
      expectedDefaults,
    );
    const choice = streams.find((s) => s.disposition.default === 1) ?? streams[0]!;
    assert.equal(choice.index, selected);
    const records = await frameRecords(e, path, selected);
    assert.ok(records.every((f) => f.stream_index === String(selected)));
    assert.deepEqual(await decodeFrames(e, path, 96, 64, selected), [1, 2, 3, 4]);
    const pixels = await e.tool(FFMPEG, [
      ...STRICT_INPUT,
      "-i",
      path,
      "-map",
      `0:${selected}`,
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgba",
      "-f",
      "rawvideo",
      "pipe:1",
    ]);
    assert.deepEqual(pixels.stdout, referenceFrame(1, 4, 96, 64, false, selected));
    return streams;
  };
  const defaultSecond = await check(multiple, [0, 1], 1);
  const ties = join(e.path, "ties.mp4");
  await e.tool(FFMPEG, [
    "-v",
    "error",
    "-nostdin",
    "-i",
    multiple,
    "-map",
    "0",
    "-c",
    "copy",
    "-disposition:v:0",
    "default",
    "-disposition:v:1",
    "default",
    "-disposition:v:2",
    "attached_pic",
    ties,
  ]);
  await check(ties, [1, 1], 0);
  const none = join(e.path, "none.mkv");
  await e.tool(FFMPEG, [
    "-v",
    "error",
    "-nostdin",
    "-i",
    multiple,
    "-map",
    "0:v:0",
    "-map",
    "0:v:1",
    "-c",
    "copy",
    "-disposition:v:0",
    "0",
    "-disposition:v:1",
    "0",
    "-default_mode",
    "passthrough",
    none,
  ]);
  await check(none, [0, 0], 0);
  const buffered = await generateSmall(e, "buffered.mp4", { frames: 12, buffered: true });
  const elementary = join(e.path, "buffered.h264");
  await e.tool(FFMPEG, [
    "-v",
    "error",
    "-nostdin",
    "-i",
    buffered,
    "-c:v",
    "copy",
    "-bsf:v",
    "h264_mp4toannexb",
    "-f",
    "h264",
    elementary,
  ]);
  const raw = await readFile(elementary);
  const damaged = join(e.path, "damaged.h264");
  await writeFile(damaged, raw.subarray(0, raw.length - 35));
  const probe = await e.tool(
    FFPROBE,
    [
      "-v",
      "error",
      "-err_detect",
      "explode",
      "-show_frames",
      "-show_entries",
      FRAME_FIELDS,
      "-of",
      "compact=p=1:nk=0",
      damaged,
    ],
    { allowFailure: true },
  );
  const decoder = await e.tool(FFMPEG, [...STRICT_INPUT, "-i", damaged, "-f", "null", "-"], {
    allowFailure: true,
  });
  assert.ok(
    probe.code !== 0 || probe.stderr.trim(),
    "Decode diagnostics must reject a nominally successful FFprobe exit.",
  );
  assert.notEqual(decoder.code, 0);
  return {
    defaultSecond,
    defaultTie: 0,
    noDefault: 0,
    coverExcluded: true,
    damagedProbeExit: probe.code,
    damagedProbeDiagnostics: Boolean(probe.stderr.trim()),
    damagedDecoderExit: decoder.code,
  };
}

export async function pixelGuardEvidence(e: Experiment): Promise<object> {
  const observations: object[] = [];
  for (const width of [4096, 4097]) {
    const path = join(e.path, `guard-${width}.mkv`);
    await e.tool(
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
        `${width}x4096`,
        "-framerate",
        "1",
        "-i",
        "pipe:0",
        "-frames:v",
        "1",
        "-c:v",
        "ffv1",
        "-threads",
        "1",
        "-pix_fmt",
        "bgra",
        path,
      ],
      { input: referenceFrames(1, width, 4096) },
    );
    const probe = await e.tool(
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
        "-show_frames",
        "-show_entries",
        FRAME_FIELDS,
        "-of",
        "compact=p=1:nk=0",
        path,
      ],
      { allowFailure: true },
    );
    const decoder = await e.tool(FFMPEG, [...STRICT_INPUT, "-i", path, "-f", "null", "-"], {
      allowFailure: true,
    });
    if (width === 4096) {
      assert.equal(probe.code, 0);
      assert.equal(probe.stderr.trim(), "");
      assert.equal(decoder.code, 0);
      assert.equal(decoder.stderr.trim(), "");
      assert.match(probe.stdout.toString("utf8"), /frame\|/);
    } else {
      assert.ok(probe.code !== 0 || probe.stderr.trim());
      assert.notEqual(decoder.code, 0);
      assert.match(probe.stderr + decoder.stderr, /max_pixels|picture size|image size/i);
    }
    observations.push({
      width,
      height: 4096,
      pixels: width * 4096,
      probeCode: probe.code,
      decoderCode: decoder.code,
      probeErrorDiagnostic: Boolean(probe.stderr.trim()),
    });
  }
  return { decoderPixels: DECODER_PIXELS, observations };
}
