import assert from "node:assert/strict";
import { writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { FrameResolver } from "../../../../src/cli/video-frames/resolver";
import { exact } from "../../../../src/cli/video-frames/exact";
const [mode, root, probe] = process.argv.slice(2) as [string, string, string];
const source = join(root, "synthetic-source.json");
async function main() {
  const config = {
    streams: [
      {
        index: 0,
        codec_type: "video",
        codec_name: "png",
        width: 96,
        height: 64,
        time_base: "1/1000",
        disposition: { attached_pic: 1 },
      },
      {
        index: 2,
        codec_type: "video",
        codec_name: "ffv1",
        width: 96,
        height: 64,
        time_base: "1/1000",
        disposition: { default: 1 },
      },
    ],
    count: 4,
    starts: [5000, 5040, 5120, 5500],
    durations: [40, 40, 40, 40],
  };
  const overrides: Record<string, unknown> =
    mode === "large"
      ? { count: 20000, starts: null, durations: null }
      : mode === "cancel"
        ? { count: 2000, starts: null, durations: null, delay: 5 }
        : mode === "timing"
          ? { count: 3, starts: [0, 0, 80], durations: [40, 40, 40] }
          : mode === "error"
            ? { decodeError: true }
            : mode === "partial"
              ? { partial: true }
              : mode === "during"
                ? { mutate: true }
                : mode === "record-limit"
                  ? { oversizedRecord: true }
                  : mode === "metadata-limit"
                    ? { hugeMetadata: true }
                    : {};
  await writeFile(source, JSON.stringify({ ...config, ...overrides }));
  const controller = new AbortController();
  const resolver = new FrameResolver(source, {
    ffprobe: probe,
    progress: (frames) => {
      if (mode === "cancel" && frames >= 1) controller.abort();
    },
  });
  if (mode === "mapping") {
    assert.equal((await resolver.resolve({ kind: "first" })).frameNumber, 1);
    assert.equal(resolver.state.verifiedFrameCount, undefined);
    assert.equal((await resolver.resolve({ kind: "time", timeMs: exact(70n) })).frameNumber, 2);
    assert.equal((await resolver.resolve({ kind: "time", timeMs: exact(40n) })).frameNumber, 2);
    assert.equal((await resolver.resolve({ kind: "last" })).frameNumber, 4);
    const roles = await resolver.resolveSet("first-middle-last");
    assert.deepEqual(
      roles.map((role) => role.identity.frameNumber),
      [1, 3, 4],
    );
    assert.equal((await resolver.verifyForExport()).index, 2);
    return { mapping: true, count: resolver.state.verifiedFrameCount };
  }
  if (mode === "large") {
    assert.equal((await resolver.resolve({ kind: "last" })).frameNumber, 20000);
    assert.equal(resolver.state.verifiedFrameCount, 20000);
    return { streamed: 20000 };
  }
  if (mode === "change") {
    await resolver.resolve({ kind: "first" });
    await appendFile(source, " ");
    await assert.rejects(() => resolver.verifyForExport(), /changed/);
    return { sourceChanged: true };
  }
  if (mode === "timing") {
    await assert.rejects(() => resolver.resolve({ kind: "time", timeMs: exact(1n) }), /timing/);
    assert.equal((await resolver.resolve({ kind: "frame", frameNumber: 2 })).frameNumber, 2);
    return { ordinalFallback: true };
  }
  const expected =
    mode === "error"
      ? /controlled decode error/
      : mode === "partial"
        ? /Incomplete stream/
        : mode === "during"
          ? /changed/
          : mode === "record-limit"
            ? /record exceeds/
            : mode === "metadata-limit"
              ? /metadata exceeds/
              : /cancelled/;
  await assert.rejects(() => resolver.resolve({ kind: "last" }, controller.signal), expected);
  assert.equal(resolver.state.cachedIdentities, 0);
  return { failure: mode };
}
main().then(
  (result) => console.log(JSON.stringify(result)),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
