import { describe, expect, test } from "bun:test";

import { nativeCacheParts } from "../../scripts/testing/execution/native-cache.ts";

describe("native extension cache metadata", () => {
  test.each([
    "osx_arm64",
    "osx_amd64",
    "linux_amd64",
    "linux_arm64",
    "linux_amd64_musl",
    "windows_amd64",
    "linux_amd64_gcc4",
  ])("selects the exact version and platform for %s", (platform) => {
    expect(nativeCacheParts("v1.5.5", platform)).toEqual([
      ".duckdb",
      "extensions",
      "v1.5.5",
      platform,
    ]);
  });

  test.each([
    undefined,
    null,
    42,
    "",
    ".",
    "..",
    "../linux_amd64",
    "linux_amd64/..",
    "linux_amd64\\..",
    "/linux_amd64",
    "C:\\linux_amd64",
    "linux_amd64\0",
    "linux_amd64\n",
    "linux_amd64\r",
    "linux\tamd64",
    "linux amd64",
  ])("rejects unsafe platform metadata %j", (platform) => {
    expect(() => nativeCacheParts("v1.5.5", platform)).toThrow("Unrecognized native cache layout.");
  });

  test.each([
    undefined,
    null,
    155,
    "",
    "1.5.5",
    "v1.5",
    "v1.5.5-dev",
    "v1.5.5/..",
    "v1.5.5\\..",
    "../v1.5.5",
    "v1.5.5\n",
    "v1.5.5\0",
  ])("rejects version metadata outside the release layout %j", (version) => {
    expect(() => nativeCacheParts(version, "linux_amd64")).toThrow(
      "Unrecognized native cache layout.",
    );
  });
});
