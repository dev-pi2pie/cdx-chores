import { CliError } from "../errors";
import { DECODER_PIXELS } from "./metadata";
import type { VideoStream } from "./types";
const invalid = () =>
  new CliError("Unsupported or conflicting display transform.", {
    code: "FRAME_DISPLAY_UNSUPPORTED",
  });
// Both chroma flags keep packed RGB point samples intact during native resizing.
const pointScaleFlags = "neighbor+full_chroma_int+full_chroma_inp";
const transforms: Record<string, string[]> = {
  "1,0,0,1": [],
  "-1,0,0,1": ["hflip"],
  "1,0,0,-1": ["vflip"],
  "-1,0,0,-1": ["hflip", "vflip"],
  "0,-1,1,0": ["transpose=cclock"],
  "0,1,-1,0": ["transpose=clock"],
  "0,-1,-1,0": ["transpose=cclock", "hflip"],
  "0,1,1,0": ["transpose=clock", "hflip"],
};
export function displayGeometry(stream: VideoStream, scale: number) {
  const notices: string[] = [];
  const sar = stream.image?.sampleAspectRatio;
  let n = 1n,
    d = 1n;
  if (sar === undefined || sar === "N/A" || sar === "0:1" || sar === "0:0")
    notices.push("Pixel aspect ratio unavailable; assuming square pixels.");
  else {
    const match = /^(\d{1,10}):(\d{1,10})$/.exec(sar);
    if (!match) throw new CliError("Invalid pixel aspect ratio.", { code: "FRAME_ASPECT_INVALID" });
    n = BigInt(match[1]!);
    d = BigInt(match[2]!);
    if (!n || !d || n > 2147483647n || d > 2147483647n)
      throw new CliError("Invalid pixel aspect ratio.", { code: "FRAME_ASPECT_INVALID" });
  }
  const aspectWidth = rounded(BigInt(stream.width) * n, d);
  let transform: string[] = [];
  let key: string | undefined;
  for (const side of stream.image?.display ?? []) {
    let candidate: string;
    if (side.matrix !== undefined) {
      const rows = side.matrix.trim().split(/\r?\n/);
      if (rows.length !== 3) throw invalid();
      const values = rows.flatMap((row) => {
        const match = /^[0-9a-fA-F]{8}:\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*$/.exec(row);
        if (!match) throw invalid();
        return match.slice(1).map(Number);
      });
      if (
        values.some((v) => !Number.isSafeInteger(v)) ||
        values[2] !== 0 ||
        values[5] !== 0 ||
        values[6] !== 0 ||
        values[7] !== 0 ||
        values[8] !== 1073741824
      )
        throw invalid();
      const axes = [values[0]!, values[1]!, values[3]!, values[4]!].map((v) => v / 65536);
      candidate = axes.join(",");
      if (!transforms[candidate]) throw invalid();
      if (side.rotation !== undefined) {
        const expected = (Math.atan2(-axes[1]!, axes[0]!) * 180) / Math.PI;
        if (angle(side.rotation) !== angle(expected)) throw invalid();
      }
    } else if (side.rotation !== undefined) {
      candidate = (
        { 0: "1,0,0,1", 90: "0,-1,1,0", 180: "-1,0,0,-1", 270: "0,1,-1,0" } as Record<
          number,
          string
        >
      )[angle(side.rotation)]!;
      if (!candidate) throw invalid();
    } else throw invalid();
    if (key && key !== candidate) throw invalid();
    key = candidate;
    transform = transforms[candidate]!;
  }
  const turn = transform.some((filter) => filter.startsWith("transpose"));
  const displayedWidth = turn ? stream.height : aspectWidth;
  const displayedHeight = turn ? aspectWidth : stream.height;
  const decimal = String(scale).split(".");
  const denominator = 10n ** BigInt(decimal[1]?.length ?? 0);
  const numerator = BigInt(decimal.join(""));
  const width = rounded(BigInt(displayedWidth) * numerator, denominator);
  const height = rounded(BigInt(displayedHeight) * numerator, denominator);
  for (const [w, h] of [
    [aspectWidth, stream.height],
    [width, height],
  ])
    if (
      !Number.isSafeInteger(w) ||
      !Number.isSafeInteger(h) ||
      w! < 1 ||
      h! < 1 ||
      BigInt(w!) * BigInt(h!) > BigInt(DECODER_PIXELS)
    )
      throw new CliError("Displayed image exceeds the pixel guard.", { code: "FRAME_PIXEL_LIMIT" });
  return {
    width,
    height,
    notices,
    filters: [
      `scale=${aspectWidth}:${stream.height}:flags=${pointScaleFlags}`,
      "setsar=1",
      ...transform,
      `scale=${width}:${height}:flags=${pointScaleFlags}`,
      "setsar=1",
    ],
  };
}
function rounded(n: bigint, d: bigint): number {
  return Math.max(1, Number((2n * n + d) / (2n * d)));
}
function angle(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value % 90 !== 0) throw invalid();
  return ((value % 360) + 360) % 360;
}
