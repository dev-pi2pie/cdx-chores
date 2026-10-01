import assert from "node:assert/strict";
import { join } from "node:path";
import { open, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { FrameResolver } from "../../../../src/cli/video-frames/resolver";
import { exportFrameSequence } from "../../../../src/cli/video-frames/sequence";
import {
  FrameExportError,
  type FrameExportProgress,
} from "../../../../src/cli/video-frames/export";
const [mode, root, tool] = process.argv.slice(2) as [string, string, string];
async function main() {
  process.env.CDX_FRAME_MODE = mode;
  const starts =
    mode === "variable"
      ? [5000, 5040, 5120, 5500]
      : mode === "duplicate"
        ? [0, 40, 80, 80, 160, 200]
        : mode === "decreasing"
          ? [0, 40, 80, 70, 160, 200]
          : mode === "missing"
            ? [0, 40, 80, null, 160, 200]
            : mode === "sequence-scan-failure"
              ? [0, 40, 80, 120, 160, 200]
              : [0, 40, 80, 120];
  process.env.CDX_FRAME_SEQUENCE = JSON.stringify({
    starts,
    durations: starts.map((_start, i) =>
      mode === "unknown-tail" && i === starts.length - 1 ? null : 40,
    ),
    durationEstimate: mode === "conflicting-estimate" ? 1 : undefined,
  });
  const source = join(root, "source.bin"),
    folder = join(root, "images");
  await writeFile(source, "original source");
  if (mode === "collision" || mode === "overwrite") {
    await mkdir(folder);
    await writeFile(join(folder, "source-000004.png"), "old fourth");
    await writeFile(join(folder, "source-000006.png"), "stale sixth");
    await writeFile(join(folder, "unrelated.txt"), "unrelated");
  }
  const control = new AbortController();
  let encoders = 0,
    decoders = 0,
    stages = 0;
  const progress: FrameExportProgress[] = [];
  try {
    const result = await exportFrameSequence(new FrameResolver(source, { ffprobe: tool }), {
      interval: mode === "variable" ? "100ms" : mode === "oversized" ? "15m" : "40ms",
      output: folder,
      ffmpeg: tool,
      ffprobe: tool,
      groupSize: 2,
      signal: control.signal,
      overwrite: mode === "overwrite",
      naming:
        mode === "serial-overflow"
          ? { template: "{stem}-{serial}", serialStart: Number.MAX_SAFE_INTEGER - 1 }
          : undefined,
      launch: (command, args, options) => {
        if (args.includes("image2pipe")) encoders++;
        else if (args.includes("rawvideo")) decoders++;
        return spawn(command, args, options);
      },
      progress: (state) => {
        progress.push(state);
        const { written } = state;
        if (written === 2 && mode === "sequence-cancel") control.abort();
      },
      io:
        mode === "disk-full"
          ? {
              open: async (...args) => {
                const handle = await open(...args);
                if (String(args[0]).endsWith(".stage") && ++stages === 3)
                  handle.write = async (_bytes: unknown) => {
                    throw Object.assign(new Error("Controlled disk full."), { code: "ENOSPC" });
                  };
                return handle;
              },
            }
          : undefined,
    });
    assert.ok(
      ["normal", "variable", "oversized", "conflicting-estimate", "overwrite"].includes(mode),
    );
    const expected =
      mode === "variable" ? [1, 2, 3, 3, 3, 4] : mode === "oversized" ? [1] : [1, 2, 3, 4];
    assert.equal(result.completed, true);
    assert.equal(progress.at(-1)?.phase, "finishing");
    assert.equal(progress.at(-1)?.written, result.written);
    assert.equal(progress.at(-1)?.decoded, mode === "variable" ? 5 : expected.length);
    assert.deepEqual(
      progress
        .filter((state) => state.phase === "validating" && state.inspected === 0)
        .map((state) => state.inspectionTarget),
      Array.from(
        { length: Math.ceil(expected.length / 2) },
        (_, group) => expected[Math.min(group * 2 + 1, expected.length - 1)],
      ),
    );
    assert.deepEqual(
      [
        ...new Set(
          progress.filter((state) => state.phase === "sampling").map((state) => state.inspected),
        ),
      ],
      Array.from({ length: starts.length + 1 }, (_, ordinal) => ordinal),
    );
    const exporting = progress.filter((state) => state.phase === "exporting");
    assert.equal(exporting.length > 0, true);
    assert.ok(exporting.every((state) => state.inspected === undefined));
    for (let i = 1; i < progress.length; i++) {
      if (
        progress[i]!.phase === "sampling" &&
        progress[i - 1]!.phase === "validating" &&
        progress[i - 1]!.written > 0
      )
        assert.ok(progress[i]!.inspected! > 0);
    }
    assert.equal(result.written, expected.length);
    assert.equal(result.targets, expected.length);
    assert.equal(result.sourceFrames, starts.length);
    assert.equal(result.repeatedSelections, mode === "variable" ? 2 : 0);
    assert.equal(encoders, Math.ceil(expected.length / 2));
    assert.equal(decoders, encoders);
    assert.ok(result.peaks.targets <= 2);
    for (let i = 0; i < expected.length; i++) {
      const bytes = await readFile(join(folder, `source-${String(i + 1).padStart(6, "0")}.png`));
      assert.equal(bytes[bytes.indexOf("IDAT") + 4], expected[i]);
    }
    if (mode === "overwrite") {
      assert.ok(result.notices.some((notice) => notice.includes("nonempty")));
      assert.equal(await readFile(join(folder, "source-000006.png"), "utf8"), "stale sixth");
      assert.equal(await readFile(join(folder, "unrelated.txt"), "utf8"), "unrelated");
    }
    assert.equal(await readFile(source, "utf8"), "original source");
    console.log(
      JSON.stringify({
        written: result.written,
        repeats: result.repeatedSelections,
        encoders,
        decoders,
        peaks: result.peaks,
      }),
    );
  } catch (error) {
    assert.ok(error instanceof FrameExportError);
    assert.equal(error.result.completed, false);
    assert.ok(progress.every((state) => state.phase !== "finishing"));
    assert.equal(error.result.repeatedSelections, undefined);
    assert.equal(error.result.closureConfirmed, true);
    assert.equal(error.result.stopFlow, false);
    if (mode === "unknown-tail") {
      assert.equal(error.code, "FRAME_END_UNRELIABLE");
      assert.equal(error.result.written, 3);
    } else if (["duplicate", "decreasing", "missing"].includes(mode)) {
      assert.equal(error.code, "FRAME_TIMING_UNRELIABLE");
      assert.equal(error.result.written, 2);
    } else if (mode === "sequence-scan-failure") {
      assert.equal(error.code, "FRAME_TOOL_FAILED");
      assert.equal(error.result.written, 4);
    } else if (mode === "sequence-cancel") {
      assert.equal(error.exitCode, 130);
      assert.equal(error.result.written, 2);
    } else if (mode === "serial-overflow") {
      assert.equal(error.code, "FRAME_NUMERIC_LIMIT");
      assert.equal(error.result.written, 2);
    } else if (mode === "collision") {
      assert.equal(error.result.written, 3);
      assert.equal(await readFile(join(folder, "source-000004.png"), "utf8"), "old fourth");
    } else if (mode === "disk-full") assert.equal(error.result.written, 2);
    else throw error;
    const entries = await readdir(folder);
    assert.ok(!entries.some((entry) => entry.startsWith(".cdx-frames-")));
    if (mode !== "collision") assert.equal(entries.length, error.result.written);
    assert.equal(await readFile(source, "utf8"), "original source");
    console.log(JSON.stringify({ code: error.code, ...error.result }));
  }
  for (let i = 0; i < progress.length; i++) {
    const state = progress[i]!;
    assert.ok(!("completed" in state));
    assert.ok(state.written >= (progress[i - 1]?.written ?? 0));
    assert.ok(state.written <= (progress[i - 1]?.written ?? 0) + 1);
    assert.ok(state.decoded >= (progress[i - 1]?.decoded ?? 0));
    if (state.phase === "validating" && state.inspected !== undefined)
      assert.ok(state.inspected <= state.inspectionTarget!);
    else assert.equal(state.inspectionTarget, undefined);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
