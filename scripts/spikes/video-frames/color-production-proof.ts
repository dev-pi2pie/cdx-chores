// Production results are compared with independent candidate references, never vice versa.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FrameResolver } from "../../../src/cli/video-frames/resolver";
import { exportResolvedFrames } from "../../../src/cli/video-frames/export";
import type { Experiment } from "./lab";
import { FFMPEG, FFPROBE } from "./tools";
import { extractedProfile, inspectProfile, type Transfer } from "./color-profile-proof";

export async function proveProduction(
  e: Experiment,
  source: string,
  reference: Buffer,
  width: number,
  height: number,
  transfer: Transfer,
  opaque: boolean,
) {
  const resolver = new FrameResolver(source);
  const identity = await resolver.resolve({ kind: "first" }, e.signal);
  const results = [];
  for (const format of opaque ? (["png", "jpg", "webp"] as const) : (["png", "webp"] as const)) {
    const output = await exportResolvedFrames(
      resolver,
      [{ identity, name: `production.${format}` }],
      {
        folder: e.path,
        image: { format },
        signal: e.signal,
        ffmpeg: FFMPEG,
        ffprobe: FFPROBE,
      },
    );
    e.images(output.written);
    assert.equal(output.completed, true);
    assert.equal(output.written, 1);
    assert.equal(output.width, width);
    assert.equal(output.height, height);
    assert.ok(output.peaks.files <= 2);
    assert.ok(output.peaks.rawFrames <= 1);
    const file = join(e.path, `production.${format}`);
    const profile = extractedProfile(await readFile(file), format);
    assert.ok(profile);
    const inspected = inspectProfile(profile, transfer);
    const profileFile = join(e.path, `production-${format}.icc`);
    await writeFile(profileFile, profile);
    const cmm = JSON.parse(
      (
        await e.tool("python3", [
          resolve("scripts/spikes/video-frames/color-profile-lcms.py"),
          profileFile,
          transfer,
        ])
      ).stdout.toString("utf8"),
    );
    const pixels = (
      await e.tool(FFMPEG, [
        "-nostdin",
        "-v",
        "error",
        "-i",
        file,
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgba",
        "-f",
        "rawvideo",
        "pipe:1",
      ])
    ).stdout;
    if (format !== "jpg") assert.deepEqual(pixels, reference);
    let maximumCenterError = 0;
    for (let x = 16; x < width; x += 32) {
      const offset = (Math.floor(height / 2) * width + x) * 4;
      for (let channel = 0; channel < 3; channel++)
        maximumCenterError = Math.max(
          maximumCenterError,
          Math.abs(pixels[offset + channel]! - reference[offset + channel]!),
        );
    }
    assert.ok(maximumCenterError <= (format === "jpg" ? 3 : 0));
    results.push({ format, ...inspected, cmm, maximumCenterError, preserved: true });
  }
  return results;
}
