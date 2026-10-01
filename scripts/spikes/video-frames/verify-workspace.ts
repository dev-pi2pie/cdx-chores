import assert from "node:assert/strict";
import { access, mkdir, readFile, rename, rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SYNTHETIC_SCAN_RECIPES } from "./fixtures";
import { checkSmokeProgress, preflightSmokeCase, SMOKE_LIMITS } from "./smoke-budget";
import { createSyntheticSmokeRun } from "./smoke-workspace";

// Explicit preparation check: no media generation, decoding, or private inputs.
let previousImages = 0;
for (const recipe of SYNTHETIC_SCAN_RECIPES) {
  assert.equal(recipe.durationSeconds * recipe.sourceFps, recipe.frames);
  previousImages += preflightSmokeCase({
    durationSeconds: recipe.durationSeconds,
    fpsNumerator: 1,
    previousImages,
    estimatedScratchBytes: 64 * 1024 * 1024,
  });
}
assert.equal(previousImages, 450);
assert.throws(
  () => preflightSmokeCase({ durationSeconds: 300, fpsNumerator: 15, estimatedScratchBytes: 1 }),
  /budget exceeded/,
);
assert.throws(
  () =>
    checkSmokeProgress({ caseElapsedMs: SMOKE_LIMITS.caseMs, runElapsedMs: 0, scratchBytes: 0 }),
  /incomplete/,
);
const run = await createSyntheticSmokeRun();
try {
  const file = join(run.path, "evidence.json");
  const result = { operation: "synthetic preparation", status: "passed", mediaCreated: false };
  await writeFile(file, JSON.stringify(result));
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), result);
} finally {
  await run.cleanup();
}
await assert.rejects(access(run.path), { code: "ENOENT" });

const ownership = await createSyntheticSmokeRun();
const retained = ownership.path + "-retained";
await rename(ownership.path, retained);
await mkdir(ownership.path);
try {
  await assert.rejects(ownership.cleanup(), /ownership changed/);
  await access(retained);
  await access(ownership.path);
} finally {
  // The replacement is our empty probe directory; rmdir refuses unexpected contents.
  await rmdir(ownership.path);
  await rename(retained, ownership.path);
  await ownership.cleanup();
}
process.stdout.write(
  "Synthetic recipes, budget rejection, ignored workspace, result handling, and cleanup passed. No media created.\n",
);
