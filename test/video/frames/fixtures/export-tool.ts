// Controlled executable; structural image bytes prove orchestration, not fidelity.
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { png, jpg, webp } from "./framing";
const args = process.argv.slice(2),
  mode = process.env.CDX_FRAME_MODE ?? "normal";
const count = mode === "repeat" ? 1 : 4;
async function write(bytes: Buffer | string) {
  if (!process.stdout.write(bytes)) await once(process.stdout, "drain");
}
async function main() {
  if (args.includes("-encoders")) {
    await write(
      `Encoders:\n V..... png PNG\n V..... mjpeg JPG\n${mode === "unavailable" ? "" : " V..... libwebp WebP\n"}`,
    );
    return;
  }
  if (args.includes("encoder=libwebp")) {
    await write(
      "Encoder libwebp [WebP]:\n Supported pixel formats: bgra\n -lossless <int> (from 0 to 1)\n",
    );
    return;
  }
  if (args.includes("-show_frames")) {
    for (let ordinal = 0; ordinal < count; ordinal++) {
      await write(
        `frame|stream_index=2|best_effort_timestamp=${ordinal * 40}|duration=40|width=2|height=2|pix_fmt=bgra|sample_aspect_ratio=1:1|color_range=pc|color_space=gbr|color_primaries=bt709|color_transfer=iec61966-2-1\n`,
      );
      await delay(2);
    }
    return;
  }
  if (args.includes("json")) {
    await write(
      JSON.stringify({
        streams: [
          {
            index: 2,
            codec_name: "ffv1",
            codec_type: "video",
            width: 2,
            height: 2,
            pix_fmt: "bgra",
            time_base: "1/1000",
            sample_aspect_ratio: "1:1",
            color_range: "pc",
            color_space: "gbr",
            color_primaries: "bt709",
            color_transfer: "iec61966-2-1",
          },
        ],
      }),
    );
    return;
  }
  if (args.includes("image2pipe")) {
    let remainder = Buffer.alloc(0),
      images = 0;
    const image = args.includes("mjpeg") ? jpg() : args.includes("libwebp") ? webp() : png();
    for await (const value of process.stdin) {
      remainder = Buffer.concat([remainder, value as Buffer]);
      while (remainder.length >= 16) {
        remainder = remainder.subarray(16);
        images++;
        if (mode !== "short-encoder" || images === 1) await write(image);
        if (mode === "encoder-failure" && images === 1) {
          await delay(30);
          process.stderr.write("Controlled encoder failure.\n");
          process.exitCode = 3;
          return;
        }
      }
    }
    return;
  }
  const filter = args[args.indexOf("-filter_complex") + 1]!;
  const ordinals = [...filter.matchAll(/eq\(n,(\d+)\)/g)].map((match) => Number(match[1]) + 1);
  for (const ordinal of ordinals) {
    const raw = Buffer.alloc(16, ordinal);
    for (let i = 3; i < 16; i += 4) raw[i] = mode === "late-alpha" && ordinal === 4 ? 128 : 255;
    await write(raw);
    await delay(mode === "cancel" ? 100 : 30);
    if (mode === "decoder-partial") {
      await write(Buffer.alloc(3));
      return;
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
