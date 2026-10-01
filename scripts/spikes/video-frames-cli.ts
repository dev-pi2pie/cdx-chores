// Opt-in built-command smoke; neither native tools nor generated video enters regular suites.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createLab } from "./video-frames/lab";
import { referenceFrame, referenceFrames } from "./video-frames/pattern";
import { GENERATE_RAW, STRICT_INPUT } from "./video-frames/timing-evidence";
import { FFMPEG, FFPROBE } from "./video-frames/tools";
async function main() {
  const lab = await createLab(6);
  try {
    await lab.check("built-command", 24, 8 * 1024 * 1024, async (e) => {
      const source = join(e.path, "synthetic.mov");
      await e.tool(
        FFMPEG,
        [...GENERATE_RAW, "-frames:v", "4", "-c:v", "qtrle", "-pix_fmt", "argb", source],
        { input: referenceFrames(4) },
      );
      const sourceDigest = createHash("sha256")
        .update(await readFile(source))
        .digest("hex");
      const preflight = JSON.parse(
        (
          await e.tool(FFPROBE, [
            "-v",
            "error",
            "-show_frames",
            "-show_entries",
            "frame=best_effort_timestamp_time,duration_time",
            "-of",
            "json",
            source,
          ])
        ).stdout.toString("utf8"),
      );
      assert.equal(preflight.frames.length, 4);
      assert.deepEqual(
        preflight.frames.map((frame: { best_effort_timestamp_time: string }) =>
          Number(frame.best_effort_timestamp_time),
        ),
        [0, 0.04, 0.08, 0.12],
      );
      const decode = async (path: string) =>
        (
          await e.tool(FFMPEG, [
            ...STRICT_INPUT,
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
      assert.deepEqual(await decode(source), referenceFrame(1, 4));
      const lastReference = await e.tool(FFMPEG, [
        ...STRICT_INPUT,
        "-i",
        source,
        "-vf",
        "select='eq(n,3)'",
        "-fps_mode",
        "passthrough",
        "-pix_fmt",
        "rgba",
        "-f",
        "rawvideo",
        "pipe:1",
      ]);
      assert.deepEqual(lastReference.stdout, referenceFrame(4, 4));
      const cases = [
        { name: "first", args: ["--first-frame"], ids: [1], format: "png" },
        { name: "last", args: ["--last-frame"], ids: [4], format: "png" },
        { name: "number", args: ["--frame-number", "2"], ids: [2], format: "png" },
        { name: "time", args: ["--at", "00:00:00.080"], ids: [3], format: "png" },
        { name: "set", args: ["--frame-set", "first-middle-last"], ids: [1, 3, 4], format: "png" },
        { name: "repeat", args: ["--fps", "50"], ids: [1, 1, 2, 2, 3, 3, 4, 4], format: "png" },
        { name: "interval", args: ["--interval", "15m"], ids: [1], format: "png" },
        { name: "webp", args: ["--first-frame"], ids: [1], format: "webp" },
        { name: "jpg", args: ["--first-frame"], ids: [1], format: "jpg" },
      ];
      for (const entry of cases) {
        const folder =
          entry.args.includes("--frame-set") ||
          entry.args.includes("--fps") ||
          entry.args.includes("--interval");
        const output = join(e.path, folder ? entry.name : `${entry.name}.${entry.format}`);
        const result = await e.tool(
          process.execPath,
          [
            resolve("dist/esm/bin.mjs"),
            "video",
            "frames",
            "-i",
            source,
            ...entry.args,
            "--format",
            entry.format,
            "-o",
            output,
          ],
          { allowFailure: true },
        );
        assert.equal(result.code, 0, result.stderr);
        assert.match(result.stdout.toString(), new RegExp(`Wrote ${entry.ids.length} image`));
        if (entry.name === "repeat")
          assert.match(result.stdout.toString(), /Repeated selections: 4/);
        const files = folder
          ? (await readdir(output)).sort().map((name) => join(output, name))
          : [output];
        // Frame-set lexical order happens to be first/middle/last only after explicit role ordering.
        if (entry.name === "set")
          files.splice(
            0,
            files.length,
            ...["first", "middle", "last"].map((role) =>
              join(output, `synthetic-${role}-frame.png`),
            ),
          );
        assert.equal(files.length, entry.ids.length);
        for (let i = 0; i < files.length; i++) {
          const actual = await decode(files[i]!);
          assert.equal(actual.length, referenceFrame(entry.ids[i]!, 4).length);
          if (entry.format !== "jpg") assert.deepEqual(actual, referenceFrame(entry.ids[i]!, 4));
        }
        e.images(files.length);
      }
      const conflict = await e.tool(
        process.execPath,
        [
          resolve("dist/esm/bin.mjs"),
          "video",
          "frames",
          "-i",
          source,
          "--first-frame",
          "-o",
          join(e.path, "first.png"),
        ],
        { allowFailure: true },
      );
      assert.notEqual(conflict.code, 0);
      assert.match(conflict.stderr, /incomplete|exist|conflict/i);
      const invalid = await e.tool(
        process.execPath,
        [
          resolve("dist/esm/bin.mjs"),
          "video",
          "frames",
          "-i",
          source,
          "--first-frame",
          "-o",
          join(e.path, "wrong.jpg"),
        ],
        { allowFailure: true },
      );
      assert.notEqual(invalid.code, 0);
      assert.match(invalid.stderr, /extension/);
      assert.equal(
        createHash("sha256")
          .update(await readFile(source))
          .digest("hex"),
        sourceDigest,
      );
      return {
        sourceFrames: 4,
        sourceStarts: [0, 40, 80, 120],
        methods: cases.map((entry) => entry.name),
        conflict: "passed",
        extension: "passed",
        sourcePreservation: "passed",
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
