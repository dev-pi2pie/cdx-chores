import assert from "node:assert/strict";
import type { Experiment } from "./lab";
import { FFMPEG, FFPROBE } from "./tools";

function encoderNames(inventory: string): Set<string> {
  assert.match(inventory, /^Encoders:/m);
  return new Set(
    [...inventory.matchAll(/^\s*V[.A-Z]{5}\s+([a-zA-Z0-9_]+)\s+/gm)].map((match) => match[1]!),
  );
}
function losslessWebpHelp(help: string): boolean {
  return (
    /^Encoder libwebp \[/m.test(help) &&
    /^\s+-lossless\s+<int>.*\(from 0 to 1\)/m.test(help) &&
    /^\s*Supported pixel formats:.*\bbgra\b/m.test(help)
  );
}

export async function encoderEvidence(e: Experiment): Promise<object> {
  const versions = [];
  for (const command of [FFMPEG, FFPROBE]) {
    const result = await e.tool(command, ["-v", "error", "-version"], { allowFailure: true });
    assert.equal(result.code, 0);
    versions.push(result.stdout.toString("utf8").split("\n")[0]);
  }
  const inventory = await e.tool(FFMPEG, ["-hide_banner", "-encoders"], { allowFailure: true });
  assert.equal(inventory.code, 0);
  const names = encoderNames(inventory.stdout.toString("utf8"));
  for (const name of ["png", "mjpeg", "libwebp"])
    assert.ok(names.has(name), `Missing encoder ${name}`);
  const help = await e.tool(FFMPEG, ["-hide_banner", "-h", "encoder=libwebp"], {
    allowFailure: true,
  });
  assert.equal(help.code, 0);
  assert.ok(losslessWebpHelp(help.stdout.toString("utf8")));
  assert.ok(!losslessWebpHelp("Codec libwebp not recognized. lossless mode unavailable."));
  assert.ok(
    !losslessWebpHelp(
      help.stdout.toString("utf8").replace("Encoder libwebp [", "Encoder libwebp_anim ["),
    ),
  );
  assert.ok(!losslessWebpHelp(help.stdout.toString("utf8").replace(/-lossless/g, "-other")));
  assert.ok(!encoderNames("Encoders:\n V..... libwebp_anim animated\n").has("libwebp"));
  assert.ok(!encoderNames("Encoders:\n V..... png png\n ...D.. webp decoder\n").has("libwebp"));
  const unknown = await e.tool(FFMPEG, ["-hide_banner", "-h", "encoder=cdx_missing_encoder"], {
    allowFailure: true,
  });
  assert.ok(!/^Encoder cdx_missing_encoder \[/m.test(unknown.stdout.toString("utf8")));
  return {
    versions,
    encoders: ["png", "mjpeg", "libwebp"],
    losslessWebpAdvertised: true,
    unsupportedHelpExitCode: unknown.code,
    negativeProbeInterpretation: true,
  };
}
