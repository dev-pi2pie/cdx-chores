// Opt-in alpha fidelity boundaries. No real-media tests run in the regular suites.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { FrameResolver } from "../../src/cli/video-frames/resolver";
import { exportFrameImages } from "../../src/cli/video-frames/images";
import { FrameExportError } from "../../src/cli/video-frames/export";
import { exportFrameSequence } from "../../src/cli/video-frames/sequence";
import { createLab, type Experiment } from "./video-frames/lab";
import { referenceFrame } from "./video-frames/pattern";
import { GENERATE_RAW, STRICT_INPUT } from "./video-frames/timing-evidence";
import { FFMPEG, FFPROBE } from "./video-frames/tools";

function pixels(ordinal: number, count: number, alpha: number) {
  const bytes = referenceFrame(ordinal, count, 96, 64);
  for (let offset = 3; offset < bytes.length; offset += 4) bytes[offset] = alpha;
  return bytes;
}
async function digest(path: string) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest("hex");
}
async function source(e: Experiment, alphas: number[], webm = false) {
  const path = join(e.path, webm ? "source.webm" : "source.mkv");
  await e.tool(
    FFMPEG,
    [
      ...GENERATE_RAW,
      "-frames:v",
      String(alphas.length),
      ...(webm
        ? ["-c:v", "libvpx-vp9", "-lossless", "1", "-pix_fmt", "yuva420p"]
        : ["-c:v", "ffv1", "-pix_fmt", "bgra"]),
      path,
    ],
    {
      input: (async function* () {
        for (let index = 0; index < alphas.length; index++)
          yield pixels(index + 1, alphas.length, alphas[index]!);
      })(),
    },
  );
  return path;
}
async function decode(e: Experiment, path: string, decoder?: string) {
  return (
    await e.tool(FFMPEG, [
      ...STRICT_INPUT,
      ...(decoder ? ["-c:v", decoder] : []),
      "-i",
      path,
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgba",
      "-f",
      "rawvideo",
      "pipe:1",
    ])
  ).stdout;
}
async function main() {
  const lab = await createLab(5);
  try {
    await lab.check("declared-alpha-decoder-boundary", 0, 4 * 1024 * 1024, async (e) => {
      const input = await source(e, [128], true),
        hash = await digest(input);
      const metadata = JSON.parse(
        (
          await e.tool(FFPROBE, [
            "-v",
            "error",
            "-show_entries",
            "stream=pix_fmt:stream_tags=alpha_mode",
            "-of",
            "json",
            input,
          ])
        ).stdout.toString("utf8"),
      ).streams[0];
      assert.equal(metadata.tags.alpha_mode, "1");
      assert.equal(metadata.pix_fmt, "yuv420p");
      const defaultPixels = await decode(e, input),
        alphaPixels = await decode(e, input, "libvpx-vp9");
      assert.ok(
        defaultPixels.filter((_byte, index) => index % 4 === 3).every((value) => value === 255),
      );
      assert.ok(alphaPixels.some((value, index) => index % 4 === 3 && value < 255));
      const resolver = new FrameResolver(input, { ffprobe: FFPROBE });
      const identity = await resolver.resolve({ kind: "first" }, e.signal);
      const output = join(e.path, "unsupported.png");
      await assert.rejects(
        exportFrameImages(resolver, [{ identity, selection: "first" }], {
          mode: "single",
          output,
          ffmpeg: FFMPEG,
          ffprobe: FFPROBE,
          signal: e.signal,
        }),
        { code: "FRAME_ALPHA_UNSUPPORTED" },
      );
      await assert.rejects(stat(output), { code: "ENOENT" });
      const sequenceFolder = join(e.path, "unsupported-sequence");
      await assert.rejects(
        exportFrameSequence(resolver, {
          fps: "25",
          output: sequenceFolder,
          ffmpeg: FFMPEG,
          ffprobe: FFPROBE,
          signal: e.signal,
        }),
        { code: "FRAME_ALPHA_UNSUPPORTED" },
      );
      await assert.rejects(stat(sequenceFolder), { code: "ENOENT" });
      assert.equal(await digest(input), hash);
      return { rejectedBeforeDestination: true, sourcePreserved: true };
    });
    await lab.check("zero-alpha-format-boundary", 4, 4 * 1024 * 1024, async (e) => {
      const input = await source(e, [0]),
        hash = await digest(input);
      const expected = pixels(1, 1, 0);
      const resolver = new FrameResolver(input, { ffprobe: FFPROBE });
      const identity = await resolver.resolve({ kind: "first" }, e.signal);
      const decodedSource = await decode(e, input);
      assert.ok(decodedSource.equals(expected));
      for (const quality of ["png", "low", "medium", "high"] as const) {
        const format = quality === "png" ? "png" : "webp";
        const result = await exportFrameImages(resolver, [{ identity, selection: "first" }], {
          mode: "single",
          output: join(e.path, `${quality}.${format}`),
          image: { format, quality: quality === "png" ? "full" : quality },
          ffmpeg: FFMPEG,
          ffprobe: FFPROBE,
          signal: e.signal,
        });
        e.images(result.written);
        const decoded = await decode(e, result.destination);
        if (format === "png") assert.ok(decoded.equals(expected));
        for (let offset = 3; offset < expected.length; offset += 4)
          assert.equal(decoded[offset], 0);
      }
      const output = join(e.path, "unsupported.webp");
      await assert.rejects(
        exportFrameImages(resolver, [{ identity, selection: "first" }], {
          mode: "single",
          output,
          image: { format: "webp", quality: "full" },
          ffmpeg: FFMPEG,
          ffprobe: FFPROBE,
          signal: e.signal,
        }),
        (error: unknown) => {
          assert.ok(error instanceof FrameExportError);
          assert.equal(error.code, "FRAME_WEBP_TRANSPARENCY_UNSUPPORTED");
          assert.equal(error.result.written, 0);
          assert.equal(error.result.closureConfirmed, true);
          assert.equal(error.result.stopFlow, false);
          return true;
        },
      );
      await assert.rejects(stat(output), { code: "ENOENT" });
      assert.ok(!(await readdir(e.path)).some((name) => name.startsWith(".cdx-frames-")));
      assert.equal(await digest(input), hash);
      return {
        pngExact: true,
        lossyWebpAlphaExact: true,
        fullWebpRejected: true,
        sourcePreserved: true,
        stagingRemoved: true,
      };
    });
    await lab.check("positive-alpha-lossless-webp", 5, 4 * 1024 * 1024, async (e) => {
      const alphas = [1, 127, 128, 254, 255];
      const input = await source(e, alphas),
        hash = await digest(input);
      const resolver = new FrameResolver(input, { ffprobe: FFPROBE });
      for (let index = 0; index < alphas.length; index++) {
        const identity = await resolver.resolve(
          { kind: "frame", frameNumber: index + 1 },
          e.signal,
        );
        const result = await exportFrameImages(resolver, [{ identity, selection: "custom" }], {
          mode: "single",
          output: join(e.path, `alpha-${alphas[index]}.webp`),
          image: { format: "webp", quality: "full" },
          ffmpeg: FFMPEG,
          ffprobe: FFPROBE,
          signal: e.signal,
        });
        e.images(result.written);
        assert.ok(
          (await decode(e, result.destination)).equals(
            pixels(index + 1, alphas.length, alphas[index]!),
          ),
        );
      }
      assert.equal(await digest(input), hash);
      assert.ok(!(await readdir(e.path)).some((name) => name.startsWith(".cdx-frames-")));
      return { exactRgba: true, alphas, sourcePreserved: true, stagingRemoved: true };
    });
    await lab.check("late-zero-alpha-sequence", 128, 16 * 1024 * 1024, async (e) => {
      const input = await source(e, [...Array<number>(128).fill(255), 0]),
        hash = await digest(input);
      const output = join(e.path, "images");
      let written = 0;
      await assert.rejects(
        exportFrameSequence(new FrameResolver(input, { ffprobe: FFPROBE }), {
          fps: "25",
          output,
          image: { format: "webp", quality: "full" },
          ffmpeg: FFMPEG,
          ffprobe: FFPROBE,
          signal: e.signal,
          progress: (state) => {
            e.images(state.written - written);
            written = state.written;
          },
        }),
        (error: unknown) => {
          assert.ok(error instanceof FrameExportError);
          assert.equal(error.code, "FRAME_WEBP_TRANSPARENCY_UNSUPPORTED");
          assert.equal(error.result.written, 128);
          assert.equal(error.result.repeatedSelections, undefined);
          assert.equal(error.result.closureConfirmed, true);
          assert.equal(error.result.stopFlow, false);
          assert.equal(error.result.retainedStaging, undefined);
          return true;
        },
      );
      const files = (await readdir(output)).sort();
      assert.equal(files.length, 128);
      assert.equal(files[0], "source-000001.webp");
      assert.equal(files.at(-1), "source-000128.webp");
      for (const ordinal of [1, 128])
        assert.ok(
          (await decode(e, join(output, files[ordinal - 1]!))).equals(pixels(ordinal, 129, 255)),
        );
      assert.equal(await digest(input), hash);
      return { confirmedImagesRetained: 128, sourcePreserved: true, stagingRemoved: true };
    });
  } finally {
    lab.finish();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
