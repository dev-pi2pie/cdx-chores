// Opt-in real-video sequence proof; regular tests use records and controlled executables.
import assert from "node:assert/strict";
import { join } from "node:path";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { readdir, link, stat } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { FrameResolver } from "../../src/cli/video-frames/resolver";
import { FrameExportError } from "../../src/cli/video-frames/export";
import { exportFrameImages } from "../../src/cli/video-frames/images";
import {
  exportFrameSequence,
  type SequenceOptions,
  type SequenceResult,
} from "../../src/cli/video-frames/sequence";
import { createLab, type Experiment } from "./video-frames/lab";
import { referenceFrame, referenceFrames, readIdentity } from "./video-frames/pattern";
import {
  generateSmall,
  GENERATE_RAW,
  STRICT_INPUT,
  parseFields,
} from "./video-frames/timing-evidence";
import { observeExportResources } from "./video-frames/resource-observer";
import { FFMPEG, FFPROBE, FRAME_FIELDS, lineConsumer } from "./video-frames/tools";
async function digest(path: string) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest("hex");
}
async function constant(
  e: Experiment,
  frames: number,
  rate: number,
  mov = true,
  width = 96,
  height = 64,
) {
  // NUT retains exact constant-rate timestamps; millisecond Matroska ticks round 15 FPS.
  const source = join(e.path, mov ? "source.mov" : "source.nut");
  const args = [...GENERATE_RAW];
  args[args.indexOf("-framerate") + 1] = String(rate);
  args[args.indexOf("-video_size") + 1] = `${width}x${height}`;
  await e.tool(
    FFMPEG,
    [
      ...args,
      "-frames:v",
      String(frames),
      "-c:v",
      mov ? "qtrle" : "ffv1",
      "-pix_fmt",
      mov ? "argb" : "bgra",
      source,
    ],
    { input: referenceFrames(frames, width, height) },
  );
  const metadata = JSON.parse(
    (
      await e.tool(FFPROBE, [
        "-v",
        "error",
        "-show_entries",
        "stream=time_base",
        "-of",
        "json",
        source,
      ])
    ).stdout.toString("utf8"),
  ).streams[0];
  const [numerator, denominator] = metadata.time_base.split("/").map(BigInt) as [bigint, bigint];
  let count = 0;
  const reader = lineConsumer((line) => {
    if (!line) return;
    const record = parseFields(line);
    assert.equal(
      BigInt(record.best_effort_timestamp!) * numerator * BigInt(rate),
      BigInt(count) * denominator,
    );
    assert.equal(BigInt(record.duration!) * numerator * BigInt(rate), denominator);
    count++;
  });
  await e.tool(
    FFPROBE,
    [
      "-v",
      "error",
      "-show_frames",
      "-show_entries",
      FRAME_FIELDS,
      "-of",
      "compact=p=1:nk=0",
      source,
    ],
    { consume: reader.chunk },
  );
  reader.finish();
  assert.equal(count, frames);
  const endpoints = (
    await e.tool(FFMPEG, [
      ...STRICT_INPUT,
      "-i",
      source,
      "-vf",
      `select='eq(n,0)+eq(n,${frames - 1})'`,
      "-fps_mode",
      "passthrough",
      "-pix_fmt",
      "rgba",
      "-f",
      "rawvideo",
      "pipe:1",
    ])
  ).stdout;
  const size = width * height * 4;
  assert.equal(endpoints.length, size * (frames === 1 ? 1 : 2));
  assert.equal(readIdentity(endpoints.subarray(0, size), width), 1);
  assert.equal(readIdentity(endpoints.subarray(-size), width), frames);
  return source;
}
async function verify(
  e: Experiment,
  source: string,
  sourceFrames: number,
  identities: number[],
  input: SequenceOptions,
  width = 96,
  height = 64,
  exactPixels = true,
) {
  const hash = await digest(source),
    resources = observeExportResources();
  let images = 0;
  const started = performance.now();
  let result: SequenceResult;
  let measurements: ReturnType<ReturnType<typeof observeExportResources>["finish"]>;
  try {
    result = await exportFrameSequence(new FrameResolver(source, { ffprobe: FFPROBE }), {
      ...input,
      ffprobe: FFPROBE,
      ffmpeg: FFMPEG,
      signal: e.signal,
      launch: resources.launch,
      progress: ({ written }) => {
        e.images(written - images);
        images = written;
      },
    });
  } finally {
    measurements = resources.finish();
  }
  const milliseconds = performance.now() - started;
  assert.equal(result.completed, true);
  assert.equal(result.written, identities.length);
  assert.equal(result.targets, identities.length);
  assert.equal(result.sourceFrames, sourceFrames);
  assert.equal(result.repeatedSelections, identities.length - new Set(identities).size);
  assert.ok(result.peaks.targets <= (input.groupSize ?? 128));
  assert.ok(result.peaks.files <= 2);
  assert.equal(result.peaks.rawFrames, 1);
  assert.equal(
    measurements.counts.encoder,
    Math.ceil(identities.length / (input.groupSize ?? 128)),
  );
  assert.equal(measurements.counts.decoder, measurements.counts.encoder);
  const files = (await readdir(result.destination)).sort();
  assert.equal(files.length, identities.length);
  assert.ok(files.every((name) => !name.startsWith(".cdx-frames-")));
  for (let index = 0; index < files.length; index++) {
    const serial = input.naming
      ? String(index).padStart(2, "0")
      : String(index + 1).padStart(6, "0");
    const expectedName = input.naming
      ? `source-${serial}-f${identities[index]}.png`
      : `${source.endsWith("buffered.mp4") ? "buffered" : "source"}-${serial}.png`;
    assert.equal(files[index], expectedName);
    const decoded: Buffer = (
      await e.tool(FFMPEG, [
        ...STRICT_INPUT,
        "-i",
        join(result.destination, files[index]!),
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgba",
        "-f",
        "rawvideo",
        "pipe:1",
      ])
    ).stdout;
    assert.equal(readIdentity(decoded, width), identities[index]);
    if (exactPixels)
      assert.ok(decoded.equals(referenceFrame(identities[index]!, sourceFrames, width, height)));
  }
  assert.equal(await digest(source), hash);
  return {
    result: JSON.parse(
      JSON.stringify(result, (_key, value) => (typeof value === "bigint" ? String(value) : value)),
    ),
    identities,
    milliseconds,
    measurements,
    sourcePreserved: true,
    stagingRemoved: true,
  };
}
async function main() {
  const lab = await createLab(5);
  try {
    await lab.check("constant24", 24, 4 * 1024 * 1024, async (e) =>
      verify(
        e,
        await constant(e, 24, 24),
        24,
        Array.from({ length: 24 }, (_, i) => i + 1),
        { fps: "24", output: join(e.path, "images"), groupSize: 5 },
      ),
    );
    await lab.check("repeated12to24", 24, 4 * 1024 * 1024, async (e) =>
      verify(
        e,
        await constant(e, 12, 12),
        12,
        Array.from({ length: 24 }, (_, i) => Math.floor(i / 2) + 1),
        {
          fps: "24",
          output: join(e.path, "images"),
          groupSize: 3,
          io: {
            link: async (from, to) => {
              await delay(20, undefined, { signal: e.signal });
              await link(from, to);
            },
          },
        },
      ),
    );
    await lab.check("repeats-across-full-groups", 144, 4 * 1024 * 1024, async (e) =>
      verify(
        e,
        await constant(e, 30, 5),
        30,
        Array.from({ length: 144 }, (_, index) => Number((BigInt(index) * 5n) / 24n) + 1),
        {
          fps: "24",
          output: join(e.path, "images"),
          io: {
            link: async (from, to) => {
              await delay(10, undefined, { signal: e.signal });
              await link(from, to);
            },
          },
        },
      ),
    );
    await lab.check("decimal23_976", 24, 4 * 1024 * 1024, async (e) =>
      verify(
        e,
        await constant(e, 24, 24),
        24,
        Array.from({ length: 24 }, (_, i) => i + 1),
        { fps: "23.976", output: join(e.path, "images") },
      ),
    );
    await lab.check("shifted-variable", 6, 4 * 1024 * 1024, async (e) => {
      const generated = await generateSmall(e, "source.mkv", { starts: [5000, 5040, 5120, 5500] });
      return verify(e, generated, 4, [1, 2, 3, 3, 3, 4], {
        interval: "100ms",
        output: join(e.path, "images"),
        groupSize: 2,
        naming: { template: "{stem}-{serial_##_start_0}-f{frame}" },
      });
    });
    await lab.check("buffered-final", 12, 4 * 1024 * 1024, async (e) => {
      const generated = await generateSmall(e, "buffered.mp4", { frames: 12, buffered: true });
      return verify(
        e,
        generated,
        12,
        Array.from({ length: 12 }, (_, i) => i + 1),
        { interval: "40ms", output: join(e.path, "images") },
        96,
        64,
        false,
      );
    });
    await lab.check("oversized-interval", 1, 4 * 1024 * 1024, async (e) =>
      verify(e, await constant(e, 24, 24), 24, [1], {
        interval: "15m",
        output: join(e.path, "one-image.png"),
      }),
    );
    await lab.check("mode-aware-destinations", 6, 4 * 1024 * 1024, async (e) => {
      const source = await constant(e, 4, 25),
        hash = await digest(source);
      const resolver = new FrameResolver(source, { ffprobe: FFPROBE });
      const identity = await resolver.resolve({ kind: "first" }, e.signal);
      const defaults = await exportFrameImages(resolver, [{ identity, selection: "custom" }], {
        mode: "single",
        ffmpeg: FFMPEG,
        ffprobe: FFPROBE,
        signal: e.signal,
      });
      e.images(defaults.written);
      assert.equal(defaults.destination, join(e.path, "source-frame.png"));
      const literal = await exportFrameImages(resolver, [{ identity, selection: "custom" }], {
        mode: "single",
        output: join(e.path, "Literal Name.JPEG"),
        image: { format: "jpg" },
        ffmpeg: FFMPEG,
        ffprobe: FFPROBE,
        signal: e.signal,
      });
      e.images(literal.written);
      assert.equal(literal.destination, join(e.path, "Literal Name.JPEG"));
      const custom = await exportFrameImages(resolver, [{ identity, selection: "custom" }], {
        mode: "single",
        naming: { template: "{stem}-{selection}-f{frame}" },
        ffmpeg: FFMPEG,
        ffprobe: FFPROBE,
        signal: e.signal,
      });
      e.images(custom.written);
      assert.equal(custom.destination, join(e.path, "source-custom-f1.png"));
      const roles = await resolver.resolveSet("first-middle-last", e.signal);
      const set = await exportFrameImages(resolver, roles, {
        mode: "set",
        ffmpeg: FFMPEG,
        ffprobe: FFPROBE,
        signal: e.signal,
      });
      e.images(set.written);
      assert.equal(set.destination, join(e.path, "source-frames"));
      const names = (await readdir(set.destination)).sort();
      assert.deepEqual(names, [
        "source-first-frame.png",
        "source-last-frame.png",
        "source-middle-frame.png",
      ]);
      for (const role of roles) {
        const pixels = (
          await e.tool(FFMPEG, [
            ...STRICT_INPUT,
            "-i",
            join(set.destination, `source-${role.selection}-frame.png`),
            "-pix_fmt",
            "rgba",
            "-f",
            "rawvideo",
            "pipe:1",
          ])
        ).stdout;
        assert.ok(pixels.equals(referenceFrame(role.identity.frameNumber, 4)));
      }
      const wrong = join(e.path, "wrong.webp");
      await assert.rejects(
        exportFrameImages(resolver, [{ identity, selection: "custom" }], {
          mode: "single",
          output: wrong,
          image: { format: "jpg" },
          ffmpeg: FFMPEG,
          ffprobe: FFPROBE,
          signal: e.signal,
        }),
        { code: "FRAME_EXTENSION_INVALID" },
      );
      await assert.rejects(stat(wrong), { code: "ENOENT" });
      assert.equal(await digest(source), hash);
      return {
        defaults: defaults.completed,
        literal: literal.completed,
        custom: custom.completed,
        set: set.completed,
        names,
        sourcePreserved: true,
        extensionFailureBeforeCreation: true,
      };
    });
    await lab.check("cancel-with-backpressure", 8, 16 * 1024 * 1024, async (e) => {
      const source = await constant(e, 240, 24, true, 320, 180),
        hash = await digest(source);
      const resources = observeExportResources(),
        control = new AbortController();
      let written = 0;
      let report;
      try {
        await exportFrameSequence(new FrameResolver(source, { ffprobe: FFPROBE }), {
          fps: "24",
          output: join(e.path, "images"),
          ffmpeg: FFMPEG,
          ffprobe: FFPROBE,
          signal: AbortSignal.any([e.signal, control.signal]),
          launch: resources.launch,
          io: {
            link: async (from, to) => {
              await delay(50, undefined, { signal: control.signal });
              await link(from, to);
            },
          },
          progress: (state) => {
            e.images(state.written - written);
            written = state.written;
            if (written >= 3) control.abort();
          },
        });
        assert.fail("Cancellation must not complete the sequence.");
      } catch (error) {
        assert.ok(error instanceof FrameExportError);
        assert.equal(error.exitCode, 130);
        assert.equal(error.result.written, 3);
        assert.equal(error.result.completed, false);
        assert.equal(error.result.closureConfirmed, true);
        assert.equal(error.result.stopFlow, false);
        assert.equal(error.result.repeatedSelections, undefined);
        assert.equal((await readdir(error.result.destination)).length, error.result.written);
        assert.equal(await digest(source), hash);
        report = error.result;
      } finally {
        resources.finish();
      }
      return { report, sourcePreserved: true, stagingRemoved: true };
    });
    for (const seconds of process.argv.includes("--small") ? [] : [30, 120, 300])
      await lab.check(`duration-${seconds}s`, seconds, 64 * 1024 * 1024, async (e) =>
        verify(
          e,
          await constant(e, seconds * 15, 15, false, 320, 180),
          seconds * 15,
          Array.from({ length: seconds }, (_, i) => i * 15 + 1),
          { fps: "1", output: join(e.path, "images") },
          320,
          180,
        ),
      );
  } finally {
    lab.finish();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
