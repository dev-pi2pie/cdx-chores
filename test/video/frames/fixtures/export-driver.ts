import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import { FrameResolver } from "../../../../src/cli/video-frames/resolver";
import { exportResolvedFrames, FrameExportError } from "../../../../src/cli/video-frames/export";
const [mode, root, tool] = process.argv.slice(2) as [string, string, string];
async function main() {
  process.env.CDX_FRAME_MODE = mode;
  const source = join(root, "source.bin"),
    folder = join(root, "images");
  await writeFile(source, "original source");
  const resolver = new FrameResolver(source, { ffprobe: tool });
  const roles = await resolver.resolveSet("first-middle-last");
  const control = new AbortController();
  let changed = false;
  const format = mode === "late-alpha" ? "jpg" : mode === "unavailable" ? "webp" : "png";
  try {
    const result = await exportResolvedFrames(
      resolver,
      roles.map((role) => ({ identity: role.identity, name: `${role.selection}.${format}` })),
      {
        folder,
        image: { format },
        ffmpeg: tool,
        ffprobe: tool,
        signal: control.signal,
        progress: ({ written }) => {
          if (written && !changed && mode === "source-changed") {
            changed = true;
            void writeFile(source, "changed");
          }
          if (written && mode === "cancel") control.abort();
        },
      },
    );
    assert.ok(mode === "normal" || mode === "repeat");
    assert.equal(result.written, 3);
    assert.equal(result.completed, true);
    assert.equal(result.repeatedSelections, mode === "repeat" ? 2 : 0);
    assert.equal(result.peaks.rawFrames, 1);
    assert.ok(result.peaks.files <= 2);
    assert.equal((await readdir(folder)).length, 3);
    assert.equal(await readFile(source, "utf8"), "original source");
    console.log(JSON.stringify(result));
  } catch (error) {
    assert.ok(error instanceof FrameExportError);
    assert.equal(error.result.completed, false);
    assert.equal(error.result.repeatedSelections, undefined);
    assert.equal(error.result.closureConfirmed, true);
    assert.equal(error.result.stopFlow, false);
    if (mode === "unavailable") {
      assert.equal(error.code, "FRAME_ENCODER_UNAVAILABLE");
      assert.equal(error.result.written, 0);
      await assert.rejects(stat(folder), { code: "ENOENT" });
    } else {
      const entries = await readdir(folder);
      assert.ok(entries.every((name) => !name.startsWith(".cdx-frames-")));
      assert.equal(entries.length, error.result.written);
      assert.ok(error.result.written < 3);
      if (mode === "late-alpha") assert.equal(error.code, "FRAME_ALPHA_UNSUPPORTED");
      if (mode === "decoder-partial" || mode === "short-encoder")
        assert.equal(error.code, "FRAME_IMAGE_INCOMPLETE");
      if (mode === "encoder-failure")
        assert.ok(["FRAME_TOOL_FAILED", "FRAME_EXPORT_FAILED"].includes(error.code));
      if (mode === "cancel") {
        assert.equal(error.exitCode, 130);
        assert.ok(error.result.written >= 1);
      }
      if (mode === "source-changed") assert.equal(error.code, "FRAME_SOURCE_CHANGED");
    }
    console.log(JSON.stringify({ code: error.code, ...error.result }));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
