// Explicit terminal walkthrough preparation; human interaction is outside processing time.
import assert from "node:assert/strict";
import { join } from "node:path";
import { createLab } from "./video-frames/lab";
import { referenceFrame, referenceFrames } from "./video-frames/pattern";
import { GENERATE_RAW, STRICT_INPUT } from "./video-frames/timing-evidence";
import { FFMPEG, FFPROBE } from "./video-frames/tools";
async function main() {
  const lab = await createLab(7);
  try {
    await lab.check("terminal", 150, 8 * 1024 * 1024, async (e) => {
      const source = join(e.path, "synthetic-terminal.mov");
      await e.tool(
        FFMPEG,
        [...GENERATE_RAW, "-frames:v", "60", "-c:v", "qtrle", "-pix_fmt", "argb", source],
        { input: referenceFrames(60) },
      );
      const frames = JSON.parse(
        (
          await e.tool(FFPROBE, [
            "-v",
            "error",
            "-show_frames",
            "-show_entries",
            "frame=best_effort_timestamp_time",
            "-of",
            "json",
            source,
          ])
        ).stdout.toString(),
      ).frames;
      assert.equal(frames.length, 60);
      for (let i = 0; i < 60; i++)
        assert.equal(Number(frames[i].best_effort_timestamp_time), i / 25);
      const endpoints = (
        await e.tool(FFMPEG, [
          ...STRICT_INPUT,
          "-i",
          source,
          "-vf",
          "select='eq(n,0)+eq(n,59)'",
          "-fps_mode",
          "passthrough",
          "-pix_fmt",
          "rgba",
          "-f",
          "rawvideo",
          "pipe:1",
        ])
      ).stdout;
      assert.deepEqual(endpoints, Buffer.concat([referenceFrame(1, 60), referenceFrame(60, 60)]));
      console.log(`Synthetic terminal source: ${source}`);
      return {
        sourceFrames: 60,
        durationMs: 2400,
        endpoints: "passed",
        expectedMaximumWalkthroughImages: 150,
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
