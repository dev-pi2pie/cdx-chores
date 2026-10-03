// Explicit tiny native output checks. This entry is outside regular suites and CI.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createLab } from "./video-frames/lab";
import { FFMPEG, FFPROBE } from "./video-frames/tools";

async function main() {
  const lab = await createLab(9);
  try {
    await lab.check("one-pixel", 3, 1024 * 1024, async (e) => {
      const source = join(e.path, "tiny.mov");
      const reference = Buffer.from([72, 128, 192, 255]);
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
          "2x2",
          "-framerate",
          "25",
          "-i",
          "pipe:0",
          "-frames:v",
          "1",
          "-c:v",
          "qtrle",
          "-pix_fmt",
          "argb",
          source,
        ],
        {
          input: (async function* () {
            yield Buffer.concat(Array.from({ length: 4 }, () => reference));
          })(),
        },
      );
      const before = await readFile(source);
      for (const format of ["png", "jpg", "webp"]) {
        const output = join(e.path, "image." + format);
        const exported = await e.tool(
          process.execPath,
          [
            resolve("dist/esm/bin.mjs"),
            "video",
            "frames",
            "-i",
            source,
            "--first-frame",
            "--scale",
            "0.5",
            "--format",
            format,
            "-o",
            output,
          ],
          { allowFailure: true },
        );
        assert.equal(exported.code, 0, exported.stderr);
        const metadata = JSON.parse(
          (
            await e.tool(FFPROBE, [
              "-v",
              "error",
              "-show_entries",
              "stream=codec_name,width,height",
              "-of",
              "json",
              output,
            ])
          ).stdout.toString(),
        ).streams[0];
        assert.equal(metadata.width, 1);
        assert.equal(metadata.height, 1);
        assert.equal(metadata.codec_name, format === "jpg" ? "mjpeg" : format);
        const pixels = (
          await e.tool(FFMPEG, [
            "-v",
            "error",
            "-i",
            output,
            "-pix_fmt",
            "rgba",
            "-f",
            "rawvideo",
            "pipe:1",
          ])
        ).stdout;
        assert.equal(pixels.length, 4);
        if (format === "jpg")
          for (let i = 0; i < 3; i++) assert(Math.abs(pixels[i]! - reference[i]!) <= 5);
        else assert.deepEqual(pixels, reference);
        e.images(1);
      }
      assert.deepEqual(await readFile(source), before);
      return {
        runtime: process.version,
        dimensions: "1x1",
        formats: ["png", "jpg", "webp"],
        sourcePreserved: true,
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
