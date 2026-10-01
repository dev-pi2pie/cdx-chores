import { expect, test } from "bun:test";
import {
  frameCadence,
  cadenceTarget,
  expectedSequenceCount,
} from "../../../src/cli/video-frames/cadence";
import { compare, exact } from "../../../src/cli/video-frames/exact";
import { ForwardSampler } from "../../../src/cli/video-frames/sampler";
import { FrameNamer } from "../../../src/cli/video-frames/naming";
import { frameSelect } from "../../../src/cli/video-frames/select-filter";
import type { VideoStream } from "../../../src/cli/video-frames/types";
import type { ImageTarget } from "../../../src/cli/video-frames/export";
const stream = (base = exact(1n, 1000n)): VideoStream => ({
  index: 2,
  codec: "ffv1",
  width: 2,
  height: 2,
  timeBase: base,
  fingerprint: "stream",
  eligibleStreams: 1,
});
function fixture(
  input: { fps?: unknown; interval?: unknown },
  base = exact(1n, 1000n),
  groupSize = 2,
  signal?: AbortSignal,
) {
  const groups: ImageTarget[][] = [];
  const namer = new FrameNamer("sequence", "clip.mp4", {
    template: "{stem}-{serial_##_start_0}-f{frame}",
  });
  const sampler = new ForwardSampler(stream(base), frameCadence(input), {
    groupSize,
    signal,
    emit: async (group) => {
      groups.push([...group]);
      await Promise.resolve();
    },
    name: (identity, index) =>
      namer.name({ frameNumber: identity.frameNumber, index, format: "png" }),
  });
  return {
    sampler,
    groups,
    get identities() {
      return groups.flat().map((target) => target.identity.frameNumber);
    },
    get names() {
      return groups.flat().map((target) => target.name);
    },
  };
}
test("FPS grammar preserves ordinary decimals exactly; intervals keep integer milliseconds without timeout bounds", () => {
  const decimal = frameCadence({ fps: "23.976" });
  expect(decimal.periodMs).toEqual(exact(125000n, 2997n));
  expect(compare(cadenceTarget(decimal, 1), exact(1001000n, 24000n))).toBe(1);
  expect(cadenceTarget(decimal, Number.MAX_SAFE_INTEGER)).toEqual(
    exact(BigInt(Number.MAX_SAFE_INTEGER) * 125000n, 2997n),
  );
  expect(frameCadence({ interval: "15m" }).periodMs).toEqual(exact(900000n));
  expect(frameCadence({ interval: "9007199254740991ms" }).periodMs).toEqual(
    exact(9007199254740991n),
  );
  for (const fps of [0, -1, Infinity, NaN, "", "1e3", "24000/1001", ".5", "1.", null])
    expect(() => frameCadence({ fps })).toThrow();
  for (const interval of [
    "0ms",
    "2",
    "0.5s",
    "1S",
    " 1s",
    "1 s",
    "1s2ms",
    "9007199254741s",
    "null",
    null,
  ])
    expect(() => frameCadence({ interval })).toThrow();
  expect(() => frameCadence({})).toThrow("exactly one");
  expect(() => frameCadence({ fps: 1, interval: "1s" })).toThrow("exactly one");
});
test("metadata duration counts remain estimates and exclude the exact end", () => {
  expect(expectedSequenceCount(frameCadence({ fps: "23.976" }), exact(1000n))).toBe(24n);
  expect(expectedSequenceCount(frameCadence({ interval: "2s" }), exact(8000n))).toBe(4n);
  expect(expectedSequenceCount(frameCadence({ interval: "10s" }), exact(8000n))).toBe(1n);
  expect(expectedSequenceCount(frameCadence({ fps: 1 }))).toBeUndefined();
  expect(expectedSequenceCount(frameCadence({ fps: 1 }), exact(0n))).toBeUndefined();
});
test("a full selection group uses bounded expression depth while preserving every exact source ordinal", () => {
  const ordinals = Array.from({ length: 128 }, (_, index) => index * 15 + 1);
  const expression = frameSelect(ordinals);
  expect([...expression.matchAll(/eq\(n,(\d+)\)/g)].map((match) => Number(match[1]) + 1)).toEqual(
    ordinals,
  );
  let depth = 0,
    peak = 0;
  for (const char of expression) {
    if (char === "(") peak = Math.max(peak, ++depth);
    else if (char === ")") depth--;
  }
  expect(depth).toBe(0);
  expect(peak).toBeLessThanOrEqual(8);
  expect(() => frameSelect([1, 1])).toThrow("increasing");
  expect(() => frameSelect(Array.from({ length: 129 }, (_, index) => index + 1))).toThrow(
    "bounded",
  );
});
test("one second at24FPS emits24exact chronological identities across bounded groups", async () => {
  const f = fixture({ fps: 24 }, exact(1n, 24n), 5);
  for (let frame = 0; frame < 24; frame++)
    await f.sampler.record({ streamIndex: 2, startTicks: BigInt(frame), durationTicks: 1n });
  await f.sampler.finish(true);
  expect(f.identities).toEqual(Array.from({ length: 24 }, (_, index) => index + 1));
  expect(f.sampler.endMs).toEqual(exact(1000n));
  expect(f.sampler.targets).toBe(24);
  expect(f.sampler.sourceFrames).toBe(24);
  expect(f.groups.map((group) => group.length)).toEqual([5, 5, 5, 5, 4]);
  expect(f.sampler.peaks.targets).toBe(5);
  expect(f.names[23]).toBe("clip-23-f24.png");
});
test("12FPS sampled24FPS preserves24 targets from12 distinct frames including group-boundary repeats", async () => {
  const f = fixture({ fps: 24 }, exact(1n, 12n), 3);
  for (let frame = 0; frame < 12; frame++)
    await f.sampler.record({ streamIndex: 2, startTicks: BigInt(frame), durationTicks: 1n });
  await f.sampler.finish(true);
  expect(f.identities).toEqual(Array.from({ length: 24 }, (_, index) => Math.floor(index / 2) + 1));
  expect(new Set(f.identities).size).toBe(12);
  expect(new Set(f.names).size).toBe(24);
  expect(f.sampler.peaks.targets).toBe(3);
});
test("shifted variable timing maps exact boundaries to the later frame and retains sparse repeats", async () => {
  const f = fixture({ interval: "100ms" });
  for (const startTicks of [5000n, 5040n, 5120n, 5500n])
    await f.sampler.record({ streamIndex: 2, startTicks, durationTicks: 40n });
  await f.sampler.finish(true);
  expect(f.identities).toEqual([1, 2, 3, 3, 3, 4]);
  expect(f.sampler.endMs).toEqual(exact(540n));
  const sparse = fixture({ interval: "2s" });
  for (const startTicks of [0n, 1000n, 4000n])
    await sparse.sampler.record({ streamIndex: 2, startTicks, durationTicks: 1000n });
  await sparse.sampler.finish(true);
  expect(sparse.identities).toEqual([1, 2, 3]);
});
test("an equal or oversized interval exports only targetzero with sequence serial semantics", async () => {
  for (const interval of ["8s", "10s", "15m", "9007199254740991ms"]) {
    const f = fixture({ interval });
    await f.sampler.record({ streamIndex: 2, startTicks: 9000n, durationTicks: 8000n });
    await f.sampler.finish(true);
    expect(f.identities).toEqual([1]);
    expect(f.names).toEqual(["clip-00-f1.png"]);
  }
});
test("unknown or nonpositive tails preserve only previously proven intervals and never become success", async () => {
  for (const durationTicks of [undefined, 0n, -1n]) {
    const f = fixture({ interval: "100ms" });
    for (const startTicks of [0n, 125n, 900n])
      await f.sampler.record({ streamIndex: 2, startTicks, durationTicks });
    await expect(f.sampler.finish(true)).rejects.toMatchObject({ code: "FRAME_END_UNRELIABLE" });
    expect(f.identities).toEqual([1, 1, 2, 2, 2, 2, 2, 2, 2]);
    expect(f.sampler.endMs).toBeUndefined();
  }
});
test("missing, duplicate, decreasing and wrong-stream starts stop incrementally; EOF and cancellation are required", async () => {
  for (const starts of [[undefined], [0n, 0n], [0n, 80n, 40n]]) {
    const f = fixture({ interval: "40ms" });
    let failure: unknown;
    try {
      for (const startTicks of starts)
        await f.sampler.record({ streamIndex: 2, startTicks, durationTicks: 40n });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: "FRAME_TIMING_UNRELIABLE" });
    expect(f.sampler.endMs).toBeUndefined();
  }
  const f = fixture({ fps: 24 });
  await expect(f.sampler.record({ streamIndex: 1, startTicks: 0n })).rejects.toThrow("timing");
  await expect(f.sampler.finish(false)).rejects.toMatchObject({ code: "FRAME_EOF_REQUIRED" });
  const control = new AbortController(),
    cancelled = fixture({ fps: 24 }, exact(1n, 24n), 2, control.signal);
  control.abort(new Error("Cancelled"));
  await expect(cancelled.sampler.record({ streamIndex: 2, startTicks: 0n })).rejects.toThrow(
    "Cancelled",
  );
  expect(cancelled.groups).toHaveLength(0);
});
