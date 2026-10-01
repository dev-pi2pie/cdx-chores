import assert from "node:assert/strict";
import { mkdir, rename, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { Experiment } from "./lab";
import { readIdentity, referenceFrame } from "./pattern";
import { PngStager, STAGING_BYTES } from "./png-stager";
import { FFMPEG } from "./tools";
import { GENERATE_RAW, generateSmall, STRICT_INPUT } from "./timing-evidence";

export async function writerEvidence(e: Experiment): Promise<object> {
  const source = await generateSmall(e, "shifted.mkv", { starts: [5000, 5040, 5120, 5500] });
  const raw = await e.tool(FFMPEG, [
    ...STRICT_INPUT,
    "-i",
    source,
    "-fps_mode",
    "passthrough",
    "-pix_fmt",
    "rgba",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
  for (let n = 1; n <= 4; n++)
    assert.ok(raw.stdout.subarray((n - 1) * 24576, n * 24576).equals(referenceFrame(n, 4)));
  const identities = [1, 2, 3, 3, 3, 4]; // Independent 100-ms targets before the verified 540-ms end.
  const stage = join(e.path, "staging"),
    final = join(e.path, "final");
  await mkdir(stage);
  await mkdir(final);
  const published: number[] = [];
  const writer = new PngStager(
    stage,
    async (path, serial) => {
      const content = await readFile(path);
      assert.equal(content.subarray(-8, -4).toString("ascii"), "IEND");
      await delay(20, undefined, { signal: e.signal }); // A slow sink exercises actual pipe backpressure.
      await rename(path, join(final, `${serial}.png`));
      e.images(1);
      published.push(serial);
    },
    { signal: e.signal },
  );
  async function* repeated() {
    for (const n of identities) yield raw.stdout.subarray((n - 1) * 24576, n * 24576);
  }
  try {
    await e.tool(
      FFMPEG,
      [
        ...GENERATE_RAW,
        "-frames:v",
        "6",
        "-c:v",
        "png",
        "-threads",
        "1",
        "-f",
        "image2pipe",
        "pipe:1",
      ],
      { input: repeated(), consume: (chunk) => writer.chunk(chunk) },
    );
    await writer.finish();
  } finally {
    await writer.settle();
  }
  assert.deepEqual(published, [1, 2, 3, 4, 5, 6]);
  assert.equal((await readdir(stage)).length, 0);
  assert.equal(writer.peaks.files, 2);
  assert.ok(writer.peaks.bytes > 0 && writer.peaks.bytes <= STAGING_BYTES);
  const decoded = await e.tool(FFMPEG, [
    ...STRICT_INPUT,
    "-framerate",
    "1",
    "-i",
    join(final, "%d.png"),
    "-fps_mode",
    "passthrough",
    "-pix_fmt",
    "rgba",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);
  assert.deepEqual(
    identities.map((_, i) => readIdentity(decoded.stdout.subarray(i * 24576, (i + 1) * 24576), 96)),
    identities,
  );
  const failureDir = join(e.path, "limit");
  await mkdir(failureDir);
  let premature = 0;
  const limited = new PngStager(
    failureDir,
    async () => {
      premature++;
    },
    { bytes: 100 },
  );
  const png = await readFile(join(final, "1.png"));
  try {
    await assert.rejects(() => limited.chunk(png), /staging exceeds/);
  } finally {
    await limited.settle();
  }
  assert.equal(premature, 0);
  assert.ok(limited.peaks.bytes > 0 && limited.peaks.bytes <= 100);
  assert.equal((await stat(join(failureDir, "stage-1.png"))).size, limited.peaks.bytes);
  const incompleteDir = join(e.path, "incomplete");
  await mkdir(incompleteDir);
  const incomplete = new PngStager(incompleteDir, async () => {
    premature++;
  });
  try {
    await incomplete.chunk(png.subarray(0, -1));
    await assert.rejects(() => incomplete.finish(), /Incomplete PNG/);
  } finally {
    await incomplete.settle();
  }
  assert.equal(premature, 0);
  return {
    targetMs: [0, 100, 200, 300, 400, 500],
    reliableEndMs: 540,
    identities,
    completedImages: 6,
    peaks: writer.peaks,
    limits: { files: 2, bytes: STAGING_BYTES },
    inProgressByteLimit: true,
    incompleteNeverPublished: true,
    orderedSlowSink: true,
  };
}
