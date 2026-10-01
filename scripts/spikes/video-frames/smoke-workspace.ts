import { execFileSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

export async function createSyntheticSmokeRun(
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 1,
): Promise<{
  path: string;
  cleanup(): Promise<void>;
}> {
  const root = resolve(
    execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim(),
  );
  let parent = root;
  for (const part of ["examples", "playground", ".tmp-smoke", "video-frames", "synthetic"]) {
    parent = join(parent, part);
    await mkdir(parent, { recursive: true });
    const entry = await lstat(parent);
    if (!entry.isDirectory() || entry.isSymbolicLink())
      throw new Error("Smoke workspace must use ordinary owned directories.");
  }
  const canonicalParent = await realpath(parent);
  if (canonicalParent !== parent) throw new Error("Smoke workspace has an aliased parent.");
  const path = await mkdtemp(join(parent, `phase${phase}-`));
  const owner = await lstat(path);
  try {
    execFileSync("git", ["check-ignore", "--quiet", "--", join(path, "evidence.json")], {
      cwd: root,
    });
  } catch (error) {
    await rm(path, { recursive: true });
    throw new Error("Synthetic scratch must be ignored before use.", { cause: error });
  }
  return {
    path,
    async cleanup() {
      // Call only after owned children have closed. Never accept an arbitrary cleanup path.
      const current = await lstat(path);
      if (
        current.dev !== owner.dev ||
        current.ino !== owner.ino ||
        current.isSymbolicLink() ||
        (await realpath(parent)) !== canonicalParent ||
        (await realpath(path)) !== path
      )
        throw new Error("Smoke workspace ownership changed; retain scratch for inspection.");
      await rm(path, { recursive: true });
    },
  };
}
