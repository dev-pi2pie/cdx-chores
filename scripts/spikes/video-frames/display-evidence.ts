import assert from "node:assert/strict";
import { join } from "node:path";
import type { Experiment } from "./lab";
import { referenceFrame, referenceFrames } from "./pattern";
import { FFMPEG, FFPROBE } from "./tools";
import { GENERATE_RAW, generateSmall, STRICT_INPUT } from "./timing-evidence";

export async function displayEvidence(e: Experiment): Promise<object> {
  const base = join(e.path, "aspect.mov");
  await e.tool(
    FFMPEG,
    [...GENERATE_RAW, "-vf", "setsar=2,format=argb", "-frames:v", "1", "-c:v", "qtrle", base],
    { input: referenceFrames(1, 96, 64, true) },
  );
  const source = referenceFrame(1, 1, 96, 64, true);
  const observations: object[] = [];
  for (const transform of [
    {
      name: "ccw",
      rotation: 90,
      flip: false,
      filter: "transpose=cclock",
      width: 64,
      height: 192,
      from: (x: number, y: number) => [191 - y, x],
    },
    {
      name: "cw",
      rotation: -90,
      flip: false,
      filter: "transpose=clock",
      width: 64,
      height: 192,
      from: (x: number, y: number) => [y, 63 - x],
    },
    {
      name: "half",
      rotation: 180,
      flip: false,
      filter: "hflip,vflip",
      width: 192,
      height: 64,
      from: (x: number, y: number) => [191 - x, 63 - y],
    },
    {
      name: "ccw-reflected",
      rotation: 90,
      flip: true,
      filter: "transpose=cclock,hflip",
      width: 64,
      height: 192,
      from: (x: number, y: number) => [191 - y, 63 - x],
    },
  ]) {
    const input = join(e.path, `${transform.name}.mov`);
    await e.tool(FFMPEG, [
      "-v",
      "error",
      "-nostdin",
      "-display_rotation",
      String(transform.rotation),
      ...(transform.flip ? ["-display_hflip"] : []),
      "-i",
      base,
      "-c",
      "copy",
      input,
    ]);
    const info = await e.tool(FFPROBE, [
      "-v",
      "error",
      "-show_entries",
      "stream=width,height,sample_aspect_ratio:stream_side_data=rotation,displaymatrix",
      "-of",
      "json",
      input,
    ]);
    const metadata = JSON.parse(info.stdout.toString("utf8")).streams[0];
    assert.equal(metadata.sample_aspect_ratio, "2:1");
    assert.ok(metadata.side_data_list?.some((side: Record<string, unknown>) => side.displaymatrix));
    const output = join(e.path, `${transform.name}.png`);
    const geometry = `scale=192:64:flags=neighbor,setsar=1,${transform.filter}`;
    await e.tool(FFMPEG, [
      ...STRICT_INPUT,
      "-noautorotate",
      "-display_rotation",
      "0",
      "-i",
      input,
      "-frames:v",
      "1",
      "-filter_complex",
      `[0:v]split[c][a];[c]format=rgb24,${geometry}[c1];[a]alphaextract,${geometry}[a1];[c1][a1]alphamerge[out]`,
      "-map",
      "[out]",
      "-map_metadata",
      "-1",
      "-c:v",
      "png",
      output,
    ]);
    e.images(1);
    const pixels = await e.tool(FFMPEG, [
      ...STRICT_INPUT,
      "-i",
      output,
      "-frames:v",
      "1",
      "-pix_fmt",
      "rgba",
      "-f",
      "rawvideo",
      "pipe:1",
    ]);
    const expected = Buffer.alloc(transform.width * transform.height * 4);
    for (let y = 0; y < transform.height; y++)
      for (let x = 0; x < transform.width; x++) {
        const [ax, ay] = transform.from(x, y);
        const offset = (ay! * 96 + Math.floor(ax! / 2)) * 4;
        source.copy(expected, (y * transform.width + x) * 4, offset, offset + 4);
      }
    assert.ok(pixels.stdout.equals(expected), `${transform.name}: transformed pixels differ`);
    const saved = await e.tool(FFPROBE, [
      "-v",
      "error",
      "-show_entries",
      "stream=width,height,sample_aspect_ratio:stream_side_data=rotation,displaymatrix",
      "-of",
      "json",
      output,
    ]);
    const stream = JSON.parse(saved.stdout.toString("utf8")).streams[0];
    assert.equal(stream.width, transform.width);
    assert.equal(stream.height, transform.height);
    assert.equal(stream.sample_aspect_ratio, "1:1");
    assert.equal(stream.side_data_list?.length ?? 0, 0);
    observations.push({
      name: transform.name,
      inputMetadata: metadata,
      savedMetadata: stream,
      independentPixels: true,
    });
  }
  const odd = await generateSmall(e, "odd.mkv", { width: 101, height: 51 });
  for (const [scale, width, height] of [
    [0.5, 51, 26],
    [0.1, 10, 5],
    [1, 101, 51],
  ]) {
    const output = join(e.path, `scale-${scale}.png`);
    await e.tool(FFMPEG, [
      ...STRICT_INPUT,
      "-i",
      odd,
      "-frames:v",
      "1",
      "-vf",
      `scale='max(1,floor(iw*${scale}+0.5))':'max(1,floor(ih*${scale}+0.5))',setsar=1,format=rgba`,
      "-c:v",
      "png",
      output,
    ]);
    e.images(1);
    const result = await e.tool(FFPROBE, [
      "-v",
      "error",
      "-show_entries",
      "stream=width,height,sample_aspect_ratio",
      "-of",
      "json",
      output,
    ]);
    const info = JSON.parse(result.stdout.toString("utf8")).streams[0];
    assert.equal(info.width, width);
    assert.equal(info.height, height);
    assert.equal(info.sample_aspect_ratio, "1:1");
    observations.push({ scale, width, height });
  }
  return {
    observations,
    order: "sample aspect normalization -> explicit display transform -> user scale",
  };
}
