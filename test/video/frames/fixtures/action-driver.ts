import assert from "node:assert/strict";
import { chmod, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Writable } from "node:stream";
import { runCli } from "../../../../src/command";
import {
  prepareVideoFrames,
  executePreparedVideoFrames,
} from "../../../../src/cli/actions/video-frames";
import type { CliRuntime } from "../../../../src/cli/types";
const [root, tool] = process.argv.slice(2) as [string, string];
async function main() {
  const bin = join(root, "bin"),
    log = join(root, "calls.log");
  await mkdir(bin);
  const bytes = await readFile(tool, "utf8");
  for (const name of ["ffmpeg", "ffprobe"]) {
    await writeFile(join(bin, name), `#!${process.execPath}\n${bytes}`);
    await chmod(join(bin, name), 0o700);
  }
  process.env.PATH = bin;
  process.env.CDX_FRAME_LOG = log;
  await writeFile(join(root, "source.bin"), "original source");
  let stdout = "",
    stderr = "";
  const runtime: CliRuntime = {
    cwd: root,
    platform: process.platform,
    now: () => new Date(),
    colorEnabled: false,
    stdin: process.stdin,
    displayPathStyle: "relative",
    stdout: new Writable({
      write(chunk, _encoding, done) {
        stdout += chunk;
        done();
      },
    }),
    stderr: new Writable({
      write(chunk, _encoding, done) {
        stderr += chunk;
        done();
      },
    }),
  };
  const invoke = async (args: string[]) => {
    stdout = stderr = "";
    process.exitCode = undefined;
    await writeFile(log, "");
    await runCli(["node", "cli", "video", "frames", "-i", "source.bin", ...args], runtime);
    return {
      stdout,
      stderr,
      code: process.exitCode ?? 0,
      calls: (await readFile(log, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as string[]),
    };
  };
  for (const args of [
    [],
    ["--first-frame", "--last-frame"],
    ["--first-frame", "--quality", "low"],
    ["--first-frame", "-o", "bad.jpg"],
    ["--frame-set", "first-last", "--pattern", "{stem}-{frame}"],
  ]) {
    const result = await invoke(args);
    assert.notEqual(result.code, 0);
    assert.equal(result.calls.length, 0);
  }
  const first = await invoke(["--first-frame"]);
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /Wrote 1 image/);
  assert.deepEqual(first.calls.slice(0, 2), [["-version"], ["-version"]]);
  assert.equal(first.calls.filter((args) => args.includes("image2pipe")).length, 1);
  const set = await invoke(["--frame-set", "first-middle-last", "--format", "jpg", "-o", "set"]);
  assert.equal(set.code, 0, set.stderr);
  assert.match(set.stdout, /Wrote 3 image/);
  assert.deepEqual((await readdir(join(root, "set"))).sort(), [
    "source-first-frame.jpg",
    "source-last-frame.jpg",
    "source-middle-frame.jpg",
  ]);
  const sequence = await invoke([
    "--fps",
    "50",
    "--format",
    "webp",
    "--pattern",
    "{stem}-{serial}",
    "--serial-start",
    "3",
    "--serial-width",
    "2",
    "-o",
    "sequence",
  ]);
  assert.equal(sequence.code, 0, sequence.stderr);
  assert.match(sequence.stdout, /Wrote 8 image/);
  assert.match(sequence.stdout, /Repeated selections: 4/);
  assert.match(sequence.stderr, /same source frame/);
  assert.match(sequence.stderr, /Estimated image count is unavailable/);
  assert.deepEqual(
    (await readdir(join(root, "sequence"))).sort(),
    Array.from({ length: 8 }, (_, i) => `source-${String(i + 3).padStart(2, "0")}.webp`),
  );
  const timestamp = await invoke(["--at", "00:00:00.080", "-o", "at.png"]);
  assert.equal(timestamp.code, 0, timestamp.stderr);
  const selected = await readFile(join(root, "at.png"));
  assert.equal(selected[selected.indexOf("IDAT") + 4], 3);
  const prepared = await prepareVideoFrames(runtime, {
    input: "source.bin",
    frameNumber: "2",
    output: "review.png",
  });
  assert.equal((await readdir(root)).includes("review.png"), false);
  const changed = await prepareVideoFrames(
    runtime,
    { input: "source.bin", frameNumber: "2", format: "jpg", output: "review.jpg" },
    { resolver: prepared.resolver, selections: prepared.selections },
  );
  assert.equal(changed.selections[0]!.identity, prepared.selections[0]!.identity);
  await executePreparedVideoFrames(runtime, changed);
  process.env.CDX_FRAME_MODE = "encoder-failure";
  const failure = await invoke(["--frame-set", "first-last", "-o", "partial"]);
  assert.notEqual(failure.code, 0);
  assert.match(failure.stderr, /Export incomplete: 1 image/);
  assert.doesNotMatch(failure.stdout, /Wrote|Repeated selections/);
  process.env.CDX_FRAME_MODE = "normal";
  const interruptWhen = async (args: string[], ready: () => Promise<boolean>) => {
    let checking = false;
    const timer = setInterval(() => {
      if (checking) return;
      checking = true;
      void ready()
        .then((value) => {
          if (value) {
            clearInterval(timer);
            process.emit("SIGINT");
          }
        })
        .finally(() => {
          checking = false;
        });
    }, 10);
    try {
      return await invoke(args);
    } finally {
      clearInterval(timer);
    }
  };
  process.env.CDX_FRAME_MODE = "scan-slow";
  const scanCancelled = await interruptWhen(["--last-frame", "-o", "scan-cancel.png"], async () =>
    (await readFile(log, "utf8")).includes("-show_frames"),
  );
  assert.equal(scanCancelled.code, 130, scanCancelled.stderr);
  assert.equal((await readdir(root)).includes("scan-cancel.png"), false);
  process.env.CDX_FRAME_MODE = "cancel";
  const exportCancelled = await interruptWhen(
    ["--frame-set", "first-last", "-o", "cancelled"],
    async () =>
      (await readdir(join(root, "cancelled")).catch(() => [])).some((name) =>
        name.endsWith(".png"),
      ),
  );
  assert.equal(exportCancelled.code, 130, exportCancelled.stderr);
  assert.match(exportCancelled.stderr, /Export incomplete: 1 image/);
  assert.doesNotMatch(exportCancelled.stdout, /Wrote|Repeated selections/);
  process.env.CDX_FRAME_MODE = "normal";
  await writeFile(join(bin, "ffprobe"), `#!${process.execPath}\nprocess.exitCode = 127;\n`);
  const absent = await invoke(["--last-frame", "-o", "absent.png"]);
  assert.notEqual(absent.code, 0);
  assert.match(absent.stderr, /ffprobe/);
  assert.equal(
    absent.calls.some((args) => args.includes("-show_frames") || args.includes("json")),
    false,
  );
  assert.equal(await readFile(join(root, "source.bin"), "utf8"), "original source");
  assert.equal(process.listenerCount("SIGINT"), 0);
  process.exitCode = undefined;
  console.log(
    JSON.stringify({
      validation: true,
      toolsBeforeSource: true,
      first: true,
      set: true,
      sequence: true,
      timestamp: true,
      review: true,
      partial: true,
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
