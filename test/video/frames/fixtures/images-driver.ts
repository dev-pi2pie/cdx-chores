import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFile, readdir, readFile, stat } from "node:fs/promises";
import { exportFrameImages } from "../../../../src/cli/video-frames/images";
import { FrameResolver } from "../../../../src/cli/video-frames/resolver";
const [root, tool] = process.argv.slice(2) as [string, string];
async function main() {
  const source = join(root, "source.bin");
  await writeFile(source, "original source");
  const resolver = new FrameResolver(source, { ffprobe: tool });
  const identity = await resolver.resolve({ kind: "first" });
  const defaults = await exportFrameImages(resolver, [{ identity, selection: "custom" }], {
    mode: "single",
    ffmpeg: tool,
    ffprobe: tool,
  });
  assert.equal(defaults.destination, join(root, "source-frame.png"));
  assert.equal(defaults.written, 1);
  const custom = await exportFrameImages(resolver, [{ identity, selection: "custom" }], {
    mode: "single",
    naming: { template: "{stem}-{selection}-{frame}" },
    ffmpeg: tool,
    ffprobe: tool,
  });
  assert.equal(custom.destination, join(root, "source-custom-1.png"));
  assert.equal(custom.written, 1);
  const literal = await exportFrameImages(resolver, [{ identity, selection: "first" }], {
    mode: "single",
    image: { format: "jpg" },
    output: join(root, "Literal Name.JPEG"),
    ffmpeg: tool,
    ffprobe: tool,
  });
  assert.equal(literal.destination, join(root, "Literal Name.JPEG"));
  assert.equal(literal.written, 1);
  const set = await exportFrameImages(resolver, await resolver.resolveSet("first-middle-last"), {
    mode: "set",
    ffmpeg: tool,
    ffprobe: tool,
  });
  assert.equal(set.destination, join(root, "source-frames"));
  assert.equal(set.written, 3);
  assert.deepEqual((await readdir(set.destination)).sort(), [
    "source-first-frame.png",
    "source-last-frame.png",
    "source-middle-frame.png",
  ]);
  const bytes = await readFile(join(set.destination, "source-middle-frame.png"));
  assert.equal(bytes[bytes.indexOf("IDAT") + 4], 3);
  await assert.rejects(
    exportFrameImages(resolver, [{ identity, selection: "custom" }], {
      mode: "single",
      output: join(root, "wrong.webp"),
      image: { format: "jpg" },
      ffmpeg: tool,
      ffprobe: tool,
    }),
    { code: "FRAME_EXTENSION_INVALID" },
  );
  await assert.rejects(stat(join(root, "wrong.webp")), { code: "ENOENT" });
  await assert.rejects(
    exportFrameImages(resolver, [{ identity, selection: "middle" }], {
      mode: "single",
      ffmpeg: tool,
      ffprobe: tool,
    }),
    { code: "FRAME_SELECTION_REQUIRED" },
  );
  await assert.rejects(
    exportFrameImages(resolver, [{ identity, selection: "custom" }], {
      mode: "single",
      output: join(root, "explicit.png"),
      naming: { template: "{stem}" },
      ffmpeg: tool,
      ffprobe: tool,
    }),
    { code: "FRAME_NAMING_SCOPE" },
  );
  const next = await resolver.resolve({ kind: "frame", frameNumber: 2 });
  const overwritten = await exportFrameImages(resolver, [{ identity: next, selection: "custom" }], {
    mode: "single",
    overwrite: true,
    ffmpeg: tool,
    ffprobe: tool,
  });
  assert.equal(overwritten.written, 1);
  const replaced = await readFile(overwritten.destination);
  assert.equal(replaced[replaced.indexOf("IDAT") + 4], 2);
  assert.equal(await readFile(source, "utf8"), "original source");
  process.env.CDX_FRAME_MODE = "declared-alpha";
  const unsupported = new FrameResolver(source, { ffprobe: tool });
  const alphaIdentity = await unsupported.resolve({ kind: "first" });
  const unsupportedOutput = join(root, "unsupported-alpha.png");
  await assert.rejects(
    exportFrameImages(unsupported, [{ identity: alphaIdentity, selection: "first" }], {
      mode: "single",
      output: unsupportedOutput,
      ffmpeg: tool,
      ffprobe: tool,
    }),
    { code: "FRAME_ALPHA_UNSUPPORTED" },
  );
  await assert.rejects(stat(unsupportedOutput), { code: "ENOENT" });
  console.log(
    JSON.stringify({
      defaults: true,
      custom: true,
      literal: true,
      set: true,
      extension: true,
      overwrite: true,
      sourcePreserved: true,
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
