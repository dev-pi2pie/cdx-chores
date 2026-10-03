import { expect, test } from "bun:test";
import {
  exact,
  compare,
  timeBase,
  ticksToMs,
  wireInteger,
} from "../../../src/cli/video-frames/exact";
import {
  parseMetadata,
  parseFrameRecord,
  requireClean,
} from "../../../src/cli/video-frames/metadata";
import type { StreamingResult } from "../../../src/cli/process/streaming";
import { imageColor } from "../../../src/cli/video-frames/color";
const stream = (index: number, flags: object = {}) => ({
  index,
  codec_type: "video",
  codec_name: "ffv1",
  width: 96,
  height: 64,
  time_base: "1/1000",
  disposition: flags,
});

test("metadata chooses eligible defaults deterministically and keeps estimates separate", () => {
  const streams = [
    stream(0, { attached_pic: 1 }),
    stream(1),
    stream(3, { default: 1 }),
    stream(2, { default: 1 }),
    stream(4, { timed_thumbnails: 1 }),
  ];
  const selected = parseMetadata(JSON.stringify({ streams }));
  expect(selected.index).toBe(2);
  expect(selected.eligibleStreams).toBe(3);
  expect(parseMetadata(JSON.stringify({ streams: [stream(2), stream(1)] })).index).toBe(1);
  const estimates = parseMetadata(
    JSON.stringify({ streams: [{ ...stream(0), duration_ts: 540, nb_frames: "4" }] }),
  );
  expect(estimates.estimatedDurationMs).toEqual(exact(540n));
  expect(estimates.estimatedFrameCount).toBe(4);
});
test("metadata rejects absent streams, unsafe integers and oversized decoded images", () => {
  expect(() => parseMetadata('{"streams":[]}')).toThrow("No eligible");
  expect(() => parseMetadata("invalid")).toThrow("metadata JSON");
  expect(() => parseMetadata("null")).toThrow("Missing selected");
  expect(() => parseMetadata('{"streams":[null]}')).toThrow("Invalid stream");
  expect(() => parseMetadata(JSON.stringify({ streams: [stream(0, { default: "1" })] }))).toThrow(
    "disposition flag",
  );
  expect(() =>
    parseMetadata(JSON.stringify({ streams: [{ ...stream(0), duration_ts: 9007199254740992 }] })),
  ).toThrow("unsafe integer");
  expect(() =>
    parseMetadata(JSON.stringify({ streams: [{ ...stream(0), width: 4097, height: 4096 }] })),
  ).toThrow("pixels");
});
test("reported source ICC stays distinct from color labels and cannot be replaced", () => {
  for (const side_data_type of ["ICC Profile", "ICC profile"]) {
    const selected = parseMetadata(
      JSON.stringify({
        streams: [
          {
            ...stream(0),
            pix_fmt: "rgb24",
            color_primaries: "bt709",
            color_transfer: "bt709",
            side_data_list: [{ side_data_type }],
          },
        ],
      }),
    );
    expect(selected.image?.colorProfile).toBe(true);
    expect(selected.image?.colorTransfer).toBe("bt709");
    expect(() => imageColor(selected)).toThrow("Embedded source ICC interpretation");
  }
});
test("frame records preserve exact ticks, empty side data and missing timing without guessing", () => {
  expect(
    parseFrameRecord(
      "frame|stream_index=2|best_effort_timestamp=5000|pts=5000|duration=40|pict_type=B|",
      2,
    ),
  ).toMatchObject({ streamIndex: 2, startTicks: 5000n, durationTicks: 40n });
  expect(
    parseFrameRecord("frame|stream_index=0|best_effort_timestamp=N/A|pts=N/A|duration=0|", 0),
  ).toMatchObject({ streamIndex: 0, startTicks: undefined, durationTicks: undefined });
  expect(() => parseFrameRecord("frame|stream_index=1|pts=0", 0)).toThrow("another stream");
  expect(() => parseFrameRecord("frame|stream_index=0|pts=0|pts=1", 0)).toThrow("Invalid selected");
});
test("signed wire ticks and rational comparisons stay exact and bounded", () => {
  expect(wireInteger("-9223372036854775808")).toBe(-(1n << 63n));
  expect(() => wireInteger("9223372036854775808")).toThrow("numeric representation");
  expect(() => timeBase("0/0")).toThrow("numeric representation");
  expect(() => exact(1n << 257n)).toThrow("numeric representation");
  const tick = ticksToMs(1n, timeBase("1/30000"));
  expect(tick).toEqual(exact(1n, 30n));
  expect(compare(tick, exact(33n, 1000n))).toBe(1);
  expect(compare(exact(1000n, 3n), exact(333n))).toBe(1);
});
test("exit zero with decode errors is not clean EOF and prefix completion is explicit", () => {
  const result: StreamingResult = {
    code: 0,
    signal: null,
    stdout: Buffer.alloc(0),
    stderr: "decode error",
    stderrTruncated: false,
    earlyStop: false,
  };
  expect(() => requireClean(result, "scan")).toThrow("decode error");
  expect(() => requireClean({ ...result, stderr: "", earlyStop: true }, "scan")).toThrow();
  expect(() =>
    requireClean({ ...result, stderr: "", earlyStop: true }, "scan", true),
  ).not.toThrow();
});
