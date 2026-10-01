import { describe, expect, test } from "bun:test";
import { exact } from "../../../src/cli/video-frames/exact";
import { FrameResolver } from "../../../src/cli/video-frames/resolver";
import type { FrameBackend } from "../../../src/cli/video-frames/scan";
import type { FrameRecord, VideoStream } from "../../../src/cli/video-frames/types";
function fixture(
  starts: (bigint | undefined)[] = [5000n, 5040n, 5120n, 5500n],
  durations: (bigint | undefined)[] = starts.map(() => 40n),
) {
  let fingerprint = "original",
    streamFingerprint = "stream",
    calls = 0;
  const counts: number[] = [];
  let estimate: bigint | undefined;
  let frameEstimate: number | undefined;
  const metadata = (): VideoStream => ({
    index: 2,
    codec: "ffv1",
    width: 96,
    height: 64,
    timeBase: exact(1n, 1000n),
    fingerprint: streamFingerprint,
    estimatedDurationMs: estimate === undefined ? undefined : exact(estimate),
    estimatedFrameCount: frameEstimate,
    eligibleStreams: 2,
  });
  const backend: FrameBackend = {
    inspect: async () => metadata(),
    scan: async (operation, _source, _stream, consume) => {
      calls++;
      let count = 0;
      for (let i = 0; i < starts.length; i++) {
        operation.signal.throwIfAborted();
        count++;
        const frame: FrameRecord = {
          streamIndex: 2,
          startTicks: starts[i],
          durationTicks: durations[i],
        };
        if (consume(frame) === false) {
          counts.push(count);
          return { cleanEof: false };
        }
      }
      counts.push(count);
      return { cleanEof: true };
    },
  };
  const resolver = new FrameResolver("synthetic", {
    backend,
    source: async () => ({ canonicalPath: "synthetic", fingerprint }),
  });
  return {
    resolver,
    backend,
    counts,
    get calls() {
      return calls;
    },
    changeSource() {
      fingerprint = "changed";
    },
    changeStream() {
      streamFingerprint = "changed";
    },
    estimate(value: bigint) {
      estimate = value;
    },
    estimateFrames(value: number) {
      frameEstimate = value;
    },
  };
}
describe("bounded exact source-frame resolution", () => {
  test("first/frame-N stop at their ordinal while Last requires EOF", async () => {
    const f = fixture();
    expect((await f.resolver.resolve({ kind: "first" })).frameNumber).toBe(1);
    expect(f.resolver.state.verifiedFrameCount).toBeUndefined();
    expect((await f.resolver.resolve({ kind: "frame", frameNumber: 3 })).startMs).toEqual(
      exact(120n),
    );
    expect((await f.resolver.resolve({ kind: "last" })).frameNumber).toBe(4);
    expect(f.counts).toEqual([1, 3, 4]);
    expect(f.resolver.state.verifiedFrameCount).toBe(4);
  });
  test("frame-count estimates cannot bound real ordinals or extend actual EOF", async () => {
    const low = fixture();
    low.estimateFrames(1);
    expect((await low.resolver.resolve({ kind: "frame", frameNumber: 3 })).frameNumber).toBe(3);
    expect(low.counts).toEqual([3]);
    const high = fixture();
    high.estimateFrames(100);
    await expect(high.resolver.resolve({ kind: "frame", frameNumber: 5 })).rejects.toMatchObject({
      code: "FRAME_OUT_OF_RANGE",
    });
    expect(high.counts).toEqual([4]);
    expect(high.resolver.state.cachedIdentities).toBe(0);
  });
  test("first timestamp validates the full stream and later requests stop at the first later start", async () => {
    const f = fixture();
    expect((await f.resolver.resolve({ kind: "time", timeMs: exact(70n) })).frameNumber).toBe(2);
    expect(f.counts).toEqual([4]);
    expect(f.resolver.state.orderingValidated).toBe(true);
    expect((await f.resolver.resolve({ kind: "time", timeMs: exact(40n) })).frameNumber).toBe(2);
    expect(f.counts).toEqual([4, 3]);
    const calls = f.calls;
    await f.resolver.resolve({ kind: "time", timeMs: exact(80n, 2n) });
    expect(f.calls).toBe(calls);
    await expect(f.resolver.resolve({ kind: "time", timeMs: exact(540n) })).rejects.toThrow(
      "before the verified",
    );
  });
  test("duplicate/decreasing/missing timing rejects time while ordinal/endpoints stay available", async () => {
    for (const starts of [
      [0n, 0n, 80n],
      [0n, 80n, 40n],
      [undefined, 40n, 80n],
    ]) {
      const f = fixture(starts);
      await expect(f.resolver.resolve({ kind: "time", timeMs: exact(1n) })).rejects.toThrow(
        "timing",
      );
      expect((await f.resolver.resolve({ kind: "frame", frameNumber: 2 })).frameNumber).toBe(2);
      expect(
        (await f.resolver.resolveSet("first-last")).map((role) => role.identity.frameNumber),
      ).toEqual([1, 3]);
      await expect(f.resolver.resolveSet("first-middle-last")).rejects.toThrow("timing");
    }
  });
  test("an unknown tail permits proven earlier mapping but rejects a midpoint or guessed tail", async () => {
    const f = fixture([0n, 125n, 900n], [125n, 775n, undefined]);
    expect((await f.resolver.resolve({ kind: "time", timeMs: exact(899n) })).frameNumber).toBe(2);
    await expect(f.resolver.resolve({ kind: "time", timeMs: exact(900n) })).rejects.toThrow(
      "Final display end",
    );
    await expect(f.resolver.resolveSet("first-middle-last")).rejects.toThrow(
      "reliable display end",
    );
  });
  test("midpoint uses verified duration and re-resolves a stale estimate", async () => {
    const f = fixture();
    f.estimate(100n);
    const roles = await f.resolver.resolveSet("first-middle-last");
    expect(roles.map((role) => role.identity.frameNumber)).toEqual([1, 3, 4]);
    expect(roles[1]!.targetMs).toEqual(exact(270n));
    expect(f.counts).toEqual([4, 4]);
    const again = await f.resolver.resolveSet("first-middle-last");
    expect(again.map((role) => role.identity.frameNumber)).toEqual([1, 3, 4]);
    expect(f.counts.at(-1)).toBe(4); // A preset still proves endpoint EOF after timing was cached.
  });
  test("one-frame presets retain every named role", async () => {
    const f = fixture([5000n], [2000n]);
    const roles = await f.resolver.resolveSet("first-middle-last");
    expect(roles.map((role) => role.selection)).toEqual(["first", "middle", "last"]);
    expect(roles.map((role) => role.identity.frameNumber)).toEqual([1, 1, 1]);
  });
  test("source and selected-stream changes invalidate reuse and prevent export", async () => {
    for (const change of ["changeSource", "changeStream"] as const) {
      const f = fixture();
      await f.resolver.resolve({ kind: "first" });
      f[change]();
      await expect(f.resolver.verifyForExport()).rejects.toThrow("changed");
      expect(f.resolver.state.cachedIdentities).toBe(0);
      expect((await f.resolver.resolve({ kind: "first" })).frameNumber).toBe(1);
    }
  });
  test("observable changes after a scan reject its identity", async () => {
    const f = fixture();
    const original = f.backend.scan;
    f.backend.scan = async (...args) => {
      const result = await original(...args);
      f.changeSource();
      return result;
    };
    await expect(f.resolver.resolve({ kind: "last" })).rejects.toThrow("changed");
    expect(f.resolver.state.verifiedFrameCount).toBeUndefined();
  });
  test("cache eviction stays at 128 minimal records and a miss scans again", async () => {
    const f = fixture(Array.from({ length: 140 }, (_, i) => BigInt(i) * 40n));
    for (let frameNumber = 1; frameNumber <= 140; frameNumber++)
      await f.resolver.resolve({ kind: "frame", frameNumber });
    expect(f.resolver.state.cachedIdentities).toBe(128);
    const before = f.calls;
    await f.resolver.resolve({ kind: "frame", frameNumber: 1 });
    expect(f.calls).toBe(before + 1);
  });
  test("only one operation is active and pre-cancellation starts no scan", async () => {
    const f = fixture();
    let release!: () => void;
    const original = f.backend.inspect;
    f.backend.inspect = async (...args) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      f.backend.inspect = original;
      return original(...args);
    };
    const first = f.resolver.resolve({ kind: "first" });
    await Promise.resolve();
    await Promise.resolve();
    await expect(f.resolver.resolve({ kind: "last" })).rejects.toThrow("already active");
    release();
    await first;
    const abort = new AbortController();
    abort.abort();
    const before = f.calls;
    await expect(f.resolver.resolve({ kind: "last" }, abort.signal)).rejects.toThrow("cancelled");
    expect(f.calls).toBe(before);
  });
});
