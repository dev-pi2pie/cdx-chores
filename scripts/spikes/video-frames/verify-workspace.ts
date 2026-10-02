import assert from "node:assert/strict";
import {
  access,
  mkdir,
  readFile,
  rename,
  rmdir,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { SYNTHETIC_SCAN_RECIPES } from "./fixtures";
import { checkSmokeProgress, preflightSmokeCase, SMOKE_LIMITS } from "./smoke-budget";
import {
  createSmokeRun,
  createSyntheticSmokeRun,
  type SmokeFamily,
  type SmokePhase,
} from "./smoke-workspace";

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
assert.equal(basename(dirname(run.path)), "synthetic");
assert.match(basename(run.path), /^phase1-/);
try {
  const file = join(run.path, "evidence.json");
  const result = { operation: "synthetic preparation", status: "passed", mediaCreated: false };
  await writeFile(file, JSON.stringify(result));
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), result);
} finally {
  await run.cleanup();
}
await assert.rejects(access(run.path), { code: "ENOENT" });

for (const family of ["", "../private", "synthetic/../private", "Private"])
  await assert.rejects(createSmokeRun(family as SmokeFamily, 10), /family must be/);
for (const phase of [0, 12, 1.5, NaN])
  await assert.rejects(createSmokeRun("private", phase as SmokePhase), /phase must be/);

for (const family of ["synthetic", "private"] as const) {
  const sibling = await createSmokeRun(family, 10);
  const ownership = await createSmokeRun(family, 10);
  assert.equal(basename(dirname(ownership.path)), family);
  assert.match(basename(ownership.path), /^phase10-/);
  const retained = ownership.path + "-retained";
  await writeFile(join(ownership.path, "evidence.json"), "synthetic preparation evidence");
  await rename(ownership.path, retained);
  await mkdir(ownership.path);
  let replacement: "directory" | "symlink" | "missing" = "directory";
  try {
    await assert.rejects(ownership.cleanup(), /ownership changed/);
    await access(join(retained, "evidence.json"));
    await access(ownership.path);
    // This replacement is our empty probe directory; rmdir refuses unexpected contents.
    await rmdir(ownership.path);
    replacement = "missing";
    await symlink(retained, ownership.path, "dir");
    replacement = "symlink";
    await assert.rejects(ownership.cleanup(), /ownership changed/);
    await access(join(retained, "evidence.json"));
  } finally {
    if (replacement === "directory") await rmdir(ownership.path);
    if (replacement === "symlink") await unlink(ownership.path);
    await rename(retained, ownership.path);
    await ownership.cleanup();
    await assert.rejects(access(ownership.path), { code: "ENOENT" });
    await access(sibling.path);
    await sibling.cleanup();
  }
}
process.stdout.write(
  "Smoke recipes, budgets, families, ignored workspaces, ownership and cleanup passed. No media created.\n",
);
