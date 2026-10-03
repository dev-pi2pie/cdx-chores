// Explicit real-image framing and publication proof; not a regular-suite input.
import assert from "node:assert/strict";
import { join } from "node:path";
import { link, readdir } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { ProcessOperation } from "../../src/cli/process/streaming";
import { PublicationSession } from "../../src/cli/video-frames/publication";
import { ImageStager } from "../../src/cli/video-frames/staging";
import { inspectSource } from "../../src/cli/video-frames/source";
import { imageOptions, encoderArguments } from "../../src/cli/video-frames/image-options";
import { requireClean } from "../../src/cli/video-frames/metadata";
import { createLab } from "./video-frames/lab";
import { generateSmall, GENERATE_RAW, STRICT_INPUT } from "./video-frames/timing-evidence";
import { referenceFrame } from "./video-frames/pattern";
import { FFMPEG } from "./video-frames/tools";
async function main() {
  const lab = await createLab(4);
  try {
    for (const format of ["png", "jpg", "webp"] as const)
      await lab.check(`writer-${format}`, 4, 8 * 1024 * 1024, async (e) => {
        const alpha = format !== "jpg";
        const source = await generateSmall(e, "source.mkv", { frames: 1, alpha });
        const raw = referenceFrame(1, 1, 96, 64, alpha);
        const folder = join(e.path, "images");
        const operation = new ProcessOperation({ signal: e.signal });
        const session = await PublicationSession.create({
          folder,
          sourcePath: source,
          source: await inspectSource(source),
          signal: operation.signal,
          io: {
            link: async (from, to) => {
              await delay(20, undefined, { signal: operation.signal });
              await link(from, to);
            },
          },
          onWritten: () => e.images(1),
        });
        const writer = new ImageStager(session, format, (index) => `image-${index}.${format}`, {
          onFailure: (error) => operation.cancel(error),
        });
        const progress: string[] = [];
        try {
          const result = await operation.run(
            FFMPEG,
            [
              ...GENERATE_RAW,
              "-frames:v",
              "4",
              ...encoderArguments(imageOptions({ format })),
              "-threads",
              "1",
              "-map_metadata",
              "-1",
              "-fps_mode",
              "passthrough",
              "-progress",
              "pipe:3",
              "-f",
              "image2pipe",
              "pipe:1",
            ],
            {
              input: async (write, signal) => {
                for (let index = 0; index < 4; index++) {
                  signal.throwIfAborted();
                  await write(raw);
                }
              },
              consume: (chunk) => writer.chunk(chunk),
              progress: (value) => {
                if (value.frame) progress.push(value.frame);
              },
            },
          );
          requireClean(result, "Image encoder");
          await writer.finish();
          assert.equal(session.written, 4);
          assert.equal(writer.peaks.files, 2);
          assert.ok(writer.peaks.bytes <= 256 * 1024 * 1024);
        } finally {
          await operation.dispose();
          await writer.settle();
          await session.cleanup(!operation.closureUnconfirmed);
        }
        assert.ok(!(await readdir(folder)).some((name) => name.startsWith(".cdx-frames-")));
        let maximumMean = 0;
        for (let index = 1; index <= 4; index++) {
          const decoded = await e.tool(FFMPEG, [
            ...STRICT_INPUT,
            "-i",
            join(folder, `image-${index}.${format}`),
            "-frames:v",
            "1",
            "-pix_fmt",
            "rgba",
            "-f",
            "rawvideo",
            "pipe:1",
          ]);
          assert.equal(decoded.stdout.length, raw.length);
          let sum = 0;
          for (let i = 0; i < raw.length; i++) {
            if (i % 4 === 3) assert.equal(decoded.stdout[i], raw[i]);
            else sum += Math.abs(decoded.stdout[i]! - raw[i]!);
          }
          if (format !== "jpg") assert.ok(decoded.stdout.equals(raw));
          const mean = sum / ((raw.length / 4) * 3);
          maximumMean = Math.max(maximumMean, mean);
          if (format === "jpg") assert.ok(mean <= 5);
        }
        return {
          format,
          written: session.written,
          peaks: writer.peaks,
          alphaExact: true,
          maximumMean,
          progress,
          stagingRemoved: true,
        };
      });
  } finally {
    lab.finish();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
