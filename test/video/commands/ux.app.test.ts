import { describe, expect, test } from "bun:test";

import { runCli } from "../../helpers/cli-test-utils";

describe("Video command UX", () => {
  test("video resize help documents scale-first and explicit-dimension modes", () => {
    const result = runCli(["video", "resize", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("-s, --scale <factor>");
    expect(result.stdout).toContain("Scale factor multiplier");
    expect(result.stdout).toContain("--width <px>");
    expect(result.stdout).toContain("--height <px>");
    expect(result.stdout).toContain("Preferred: --scale 0.5");
    expect(result.stdout).toContain("Explicit override: --width 1280 --height 720");
  });

  test("video gif help documents compressed and quality modes", () => {
    const result = runCli(["video", "gif", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--mode <mode>");
    expect(result.stdout).toContain("--gif-profile <profile>");
    expect(result.stdout).toContain("--gif-look <look>");
    expect(result.stdout).toContain("GIF mode: compressed (default) or quality");
    expect(result.stdout).toContain("GIF quality profile: video, motion, or screen");
    expect(result.stdout).toContain("GIF look: faithful or vibrant");
    expect(result.stdout).toContain("(implies quality mode)");
    expect(result.stdout).toContain("compressed: one-pass ffmpeg conversion (default)");
    expect(result.stdout).toContain("quality: two-pass palette workflow for better color fidelity");
    expect(result.stdout).toContain("video: balanced default for most clips");
    expect(result.stdout).toContain("motion: tuned for fast-moving scenes");
    expect(result.stdout).toContain("screen: tuned for UI and screen recordings");
    expect(result.stdout).toContain("faithful: normalized closer-to-source look (default)");
    expect(result.stdout).toContain("vibrant: stronger color lift before palette generation");
  });

  test("video gif rejects invalid mode values at CLI parsing time", () => {
    const result = runCli(["video", "gif", "-i", "missing.mp4", "--mode", "invalid"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--mode must be one of: compressed, quality.");
  });

  test("video gif rejects invalid gif-profile values at CLI parsing time", () => {
    const result = runCli(["video", "gif", "-i", "missing.mp4", "--gif-profile", "invalid"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--gif-profile must be one of: video, motion, screen.");
  });

  test("video gif rejects invalid gif-look values at CLI parsing time", () => {
    const result = runCli(["video", "gif", "-i", "missing.mp4", "--gif-look", "invalid"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--gif-look must be one of: faithful, vibrant.");
  });

  test("video gif rejects gif-profile with explicit compressed mode", () => {
    const result = runCli([
      "video",
      "gif",
      "-i",
      "missing.mp4",
      "--mode",
      "compressed",
      "--gif-profile",
      "screen",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--gif-profile cannot be used with --mode compressed.");
  });

  test("video gif rejects gif-look with explicit compressed mode", () => {
    const result = runCli([
      "video",
      "gif",
      "-i",
      "missing.mp4",
      "--mode",
      "compressed",
      "--gif-look",
      "vibrant",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("--gif-look cannot be used with --mode compressed.");
  });

  test("video resize accepts scale-only flags and reaches input validation", () => {
    const result = runCli([
      "video",
      "resize",
      "-i",
      "missing.mp4",
      "-o",
      "out.mp4",
      "--scale",
      "0.5",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Input file not found:");
  });

  test("video resize rejects incomplete explicit dimensions with a clear error", () => {
    const result = runCli([
      "video",
      "resize",
      "-i",
      "missing.mp4",
      "-o",
      "out.mp4",
      "--width",
      "640",
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Width and height must be provided together.");
  });
});
