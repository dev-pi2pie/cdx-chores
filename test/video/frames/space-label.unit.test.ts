import { expect, test } from "bun:test";
import { frameSpaceLabel } from "../../../src/cli/video-frames/space-label";

test("volume capacity uses readable binary units without converting large integers to Number", () => {
  for (const [bytes, expected] of [
    [0n, "0 B"],
    [1023n, "1023 B"],
    [1024n, "1.0 KiB"],
    [1536n, "1.5 KiB"],
    [2n ** 30n, "1.0 GiB"],
    [2n ** 60n, "1.0 EiB"],
  ] as const)
    expect(frameSpaceLabel({ status: "known", availableBytes: bytes })).toBe(
      `Available space: ${expected} (advisory)`,
    );
});

test("unavailable or invalid capacity remains advisory and never invents an amount", () => {
  for (const space of [
    { status: "unknown" as const },
    { status: "known" as const },
    { status: "known" as const, availableBytes: -1n },
    { status: "unknown" as const, availableBytes: 1024n },
  ])
    expect(frameSpaceLabel(space)).toBe("Available space unknown");
});
