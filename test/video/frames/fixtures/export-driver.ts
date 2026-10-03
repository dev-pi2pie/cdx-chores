import assert from "node:assert/strict";
import { join } from "node:path";
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import { FrameResolver } from "../../../../src/cli/video-frames/resolver";
import { PublicationSession } from "../../../../src/cli/video-frames/publication";
import {
  exportResolvedFrames,
  FrameExportError,
  type FrameExportProgress,
} from "../../../../src/cli/video-frames/export";
const [mode, root, tool] = process.argv.slice(2) as [string, string, string];
async function main() {
  process.env.CDX_FRAME_MODE = mode;
  const source = join(root, "source.bin"),
    folder = join(root, "images");
  await writeFile(source, "original source");
  const resolver = new FrameResolver(source, { ffprobe: tool });
  const roles = await resolver.resolveSet("first-middle-last");
  const control = new AbortController();
  if (mode === "settlement-cancel") {
    // This isolated Node fixture aborts after process disposal, during final cleanup.
    const cleanup = PublicationSession.prototype.cleanup;
    PublicationSession.prototype.cleanup = async function (...args) {
      await cleanup.apply(this, args);
      control.abort();
    };
  }
  let changed = false;
  const format =
    mode === "late-alpha" ? "jpg" : ["unavailable", "webp-zero"].includes(mode) ? "webp" : "png";
  const duplicate = mode.startsWith("duplicate");
  const progress: FrameExportProgress[] = [];
  try {
    const result = await exportResolvedFrames(
      resolver,
      roles.map((role, index) => ({
        identity: role.identity,
        name: duplicate
          ? mode.includes("unicode")
            ? index > 0
              ? "e\u0301.png"
              : "é.png"
            : mode.includes("case") && index > 0
              ? "SAME.png"
              : "same.png"
          : `${role.selection}.${format}`,
      })),
      {
        folder,
        image: { format },
        ffmpeg: tool,
        ffprobe: tool,
        signal: control.signal,
        overwrite: mode.endsWith("overwrite"),
        progress: (state) => {
          progress.push(state);
          const { written } = state;
          if (written && !changed && mode === "source-changed") {
            changed = true;
            void writeFile(source, "changed");
          }
          if (written && mode === "cancel") control.abort();
          if (state.phase === "finishing" && mode === "finish-cancel") control.abort();
        },
      },
    );
    assert.ok(mode === "normal" || mode === "repeat");
    assert.equal(result.written, 3);
    assert.equal(result.completed, true);
    assert.equal(progress.at(-1)?.phase, "finishing");
    assert.equal(progress.at(-1)?.written, result.written);
    assert.equal(progress.at(-1)?.decoded, mode === "repeat" ? 1 : 3);
    assert.equal(progress[0]?.phase, "validating");
    assert.ok(progress.some((state) => state.phase === "exporting"));
    assert.deepEqual(
      progress
        .filter((state) => state.phase === "validating" && state.inspected !== undefined)
        .map((state) => [state.inspected, state.inspectionTarget]),
      Array.from({ length: mode === "repeat" ? 2 : 5 }, (_, inspected) => [
        inspected,
        mode === "repeat" ? 1 : 4,
      ]),
    );
    assert.equal(result.repeatedSelections, mode === "repeat" ? 2 : 0);
    assert.equal(result.peaks.rawFrames, 1);
    assert.ok(result.peaks.files <= 2);
    assert.equal((await readdir(folder)).length, 3);
    assert.equal(await readFile(source, "utf8"), "original source");
    console.log(JSON.stringify(result));
  } catch (error) {
    assert.ok(error instanceof FrameExportError);
    assert.equal(error.result.completed, false);
    const finishingCancellation = ["finish-cancel", "settlement-cancel"].includes(mode);
    if (finishingCancellation) {
      assert.equal(progress.at(-1)?.phase, "finishing");
      assert.equal(error.code, "PROCESS_CANCELLED");
      assert.equal(error.exitCode, 130);
      assert.equal(error.result.written, 3);
    } else assert.ok(progress.every((state) => state.phase !== "finishing"));
    assert.equal(error.result.repeatedSelections, undefined);
    assert.equal(error.result.closureConfirmed, true);
    assert.equal(error.result.stopFlow, false);
    if (mode === "unavailable" || duplicate) {
      assert.equal(error.code, duplicate ? "FRAME_NAME_COLLISION" : "FRAME_ENCODER_UNAVAILABLE");
      assert.equal(error.result.written, 0);
      await assert.rejects(stat(folder), { code: "ENOENT" });
    } else {
      const entries = await readdir(folder);
      assert.ok(entries.every((name) => !name.startsWith(".cdx-frames-")));
      assert.equal(entries.length, error.result.written);
      if (!finishingCancellation) assert.ok(error.result.written < 3);
      if (mode === "late-alpha") assert.equal(error.code, "FRAME_ALPHA_UNSUPPORTED");
      if (mode === "webp-zero") {
        assert.equal(error.code, "FRAME_WEBP_TRANSPARENCY_UNSUPPORTED");
        assert.ok(error.result.written >= 1);
      }
      if (mode === "decoder-partial" || mode === "short-encoder")
        assert.equal(error.code, "FRAME_IMAGE_INCOMPLETE");
      if (mode === "encoder-failure") {
        assert.match(error.message, /Controlled encoder failure/);
        assert.ok(
          ["FRAME_TOOL_FAILED", "FRAME_EXPORT_FAILED", "PROCESS_INPUT_INCOMPLETE"].includes(
            error.code,
          ),
        );
      }
      if (mode === "cancel") {
        assert.equal(error.exitCode, 130);
        assert.ok(error.result.written >= 1);
      }
      if (mode === "source-changed") assert.equal(error.code, "FRAME_SOURCE_CHANGED");
    }
    console.log(JSON.stringify({ code: error.code, ...error.result }));
  }
  for (let i = 0; i < progress.length; i++) {
    const state = progress[i]!;
    assert.ok(!("completed" in state));
    assert.ok(state.written >= (progress[i - 1]?.written ?? 0));
    assert.ok(state.written <= (progress[i - 1]?.written ?? 0) + 1);
    assert.ok(state.decoded >= (progress[i - 1]?.decoded ?? 0));
    if (state.inspected !== undefined) {
      assert.equal(state.phase, "validating");
      assert.ok(state.inspected <= state.inspectionTarget!);
    } else assert.equal(state.inspectionTarget, undefined);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
