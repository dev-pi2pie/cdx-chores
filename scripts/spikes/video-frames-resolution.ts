// Explicit Node smoke for the production resolver; never imported by regular tests.
import assert from "node:assert/strict";
import { join } from "node:path";
import { appendFile } from "node:fs/promises";
import { FrameResolver } from "../../src/cli/video-frames/resolver";
import { exact } from "../../src/cli/video-frames/exact";
import { createLab } from "./video-frames/lab";
import { generateSmall, STRICT_INPUT } from "./video-frames/timing-evidence";
import { FFMPEG, FFPROBE } from "./video-frames/tools";
import { referenceFrame, readIdentity } from "./video-frames/pattern";

async function main() {
  const lab = await createLab(3);
  try {
    await lab.check("resolution", 0, 8 * 1024 * 1024, async (e) => {
      const shifted = await generateSmall(e, "shifted.mkv", { starts: [5000, 5040, 5120, 5500] });
      const visits: number[] = [];
      const resolver = new FrameResolver(shifted, {
        ffprobe: FFPROBE,
        progress: (n) => {
          visits.push(n);
        },
      });
      assert.equal((await resolver.resolve({ kind: "first" }, e.signal)).frameNumber, 1);
      assert.equal(resolver.state.verifiedFrameCount, undefined);
      const firstTime = performance.now();
      const mapped = await resolver.resolve({ kind: "time", timeMs: exact(70n) }, e.signal);
      const initialTimeMs = performance.now() - firstTime;
      assert.equal(mapped.frameNumber, 2);
      assert.deepEqual(mapped.startMs, exact(40n));
      assert.equal(resolver.state.verifiedFrameCount, 4);
      assert.equal(resolver.state.orderingValidated, true);
      visits.length = 0;
      const cacheTime = performance.now();
      await resolver.resolve({ kind: "time", timeMs: exact(140n, 2n) }, e.signal);
      const cachedTimeMs = performance.now() - cacheTime;
      assert.equal(visits.length, 0);
      assert.equal(
        (await resolver.resolve({ kind: "time", timeMs: exact(40n) }, e.signal)).frameNumber,
        2,
      );
      assert.equal(visits.at(-1), 3);
      const set = await resolver.resolveSet("first-middle-last", e.signal);
      assert.deepEqual(
        set.map((role) => role.identity.frameNumber),
        [1, 3, 4],
      );
      assert.deepEqual(set[1]!.targetMs, exact(270n));
      await assert.rejects(
        () => resolver.resolve({ kind: "time", timeMs: exact(540n) }, e.signal),
        /before the verified/,
      );
      const buffered = await generateSmall(e, "buffered.mp4", { frames: 12, buffered: true });
      const last = await new FrameResolver(buffered, { ffprobe: FFPROBE }).resolve(
        { kind: "last" },
        e.signal,
      );
      assert.equal(last.frameNumber, 12);
      const pixels = await e.tool(FFMPEG, [
        ...STRICT_INPUT,
        "-i",
        buffered,
        "-vf",
        "select='eq(n,11)'",
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgba",
        "-f",
        "rawvideo",
        "pipe:1",
      ]);
      assert.equal(readIdentity(pixels.stdout, 96), 12);
      const one = await generateSmall(e, "single.mkv", { frames: 1 });
      const repeated = await new FrameResolver(one, { ffprobe: FFPROBE }).resolveSet(
        "first-middle-last",
        e.signal,
      );
      assert.deepEqual(
        repeated.map((role) => role.identity.frameNumber),
        [1, 1, 1],
      );
      const first = await generateSmall(e, "stream-first.mkv"),
        second = await generateSmall(e, "stream-second.mkv", { stream: 1 });
      const multi = join(e.path, "multi.mkv");
      await e.tool(FFMPEG, [
        "-v",
        "error",
        "-i",
        first,
        "-i",
        second,
        "-map",
        "0:v",
        "-map",
        "1:v",
        "-c:v",
        "copy",
        "-disposition:v:0",
        "0",
        "-disposition:v:1",
        "default",
        "-default_mode",
        "passthrough",
        multi,
      ]);
      const chosen = await new FrameResolver(multi, { ffprobe: FFPROBE }).resolve(
        { kind: "first" },
        e.signal,
      );
      assert.equal(chosen.streamIndex, 1);
      const chosenPixels = await e.tool(FFMPEG, [
        ...STRICT_INPUT,
        "-i",
        multi,
        "-map",
        "0:1",
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgba",
        "-f",
        "rawvideo",
        "pipe:1",
      ]);
      assert.ok(chosenPixels.stdout.equals(referenceFrame(1, 4, 96, 64, false, 1)));
      await resolver.resolve({ kind: "first" }, e.signal);
      await appendFile(shifted, Buffer.from([0]));
      await assert.rejects(() => resolver.verifyForExport(e.signal), /changed/);
      return {
        shiftedMapping: [1, 2, 3, 4],
        midpointFrame: 3,
        initialTimestampMs: initialTimeMs,
        cachedIdentityMs: cachedTimeMs,
        cachedHitScanned: false,
        validatedPrefixStop: 3,
        bufferedLastFrame: 12,
        singleRoles: [1, 1, 1],
        selectedStream: 1,
        sourceChangeDetected: true,
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
