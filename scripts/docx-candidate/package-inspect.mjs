import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, join, relative, sep } from "node:path";

export const candidatePackageName = "@cdx-chores-private/docx-reader-evaluation";
export const runtimeDependencies = ["dingbat-to-unicode", "fast-xml-parser", "yauzl"];

export async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function contained(root, path) {
  const part = relative(root, path);
  return part !== ".." && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}

async function installedPath(root, path) {
  const canonical = await realpath(path);
  assert.ok(contained(root, canonical), "Dependency resolution escaped fresh consumer");
  return canonical;
}

function directDependencies(manifest, versions) {
  assert.deepEqual(Object.keys(versions).sort(), [...runtimeDependencies].sort());
  assert.deepEqual(manifest.dependencies, versions);
}

/** Check required runtime bytes, allowing ordinary extra package files and contained links. */
export async function inspectCandidatePackage(root, versions, expectedAssets, installation = root) {
  const boundary = await realpath(installation);
  const canonical = await installedPath(boundary, root);
  const manifest = await json(await installedPath(boundary, join(canonical, "package.json")));
  assert.equal(manifest.name, candidatePackageName);
  assert.equal(manifest.private, true);
  directDependencies(manifest, versions);
  assert.equal(manifest.exports?.["."]?.import, "./dist/reader.mjs");
  assert.equal(manifest.exports?.["."]?.require, "./dist/reader.cjs");
  const hashes = {};
  for (const name of ["reader", "docx-child", "docx-worker", "docx-parser"]) {
    for (const extension of ["mjs", "cjs"]) {
      const asset = `dist/${name}.${extension}`;
      const bytes = await readFile(await installedPath(boundary, join(canonical, asset)));
      hashes[asset] = createHash("sha256").update(bytes).digest("hex");
    }
  }
  if (expectedAssets) assert.deepEqual(hashes, expectedAssets);
  return hashes;
}

async function resolvePackage(name, from, consumer) {
  const require = createRequire(join(from, "package.json"));
  for (const directory of require.resolve.paths(name) ?? []) {
    const path = join(directory, name);
    try {
      const canonical = await installedPath(consumer, path);
      const manifest = await json(await installedPath(consumer, join(canonical, "package.json")));
      assert.equal(manifest.name, name);
      return { path: canonical, manifest };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  throw new Error("Installed dependency unavailable");
}

/** Observe the resolved dependency closure without prescribing transitive versions or layout. */
export async function inspectDependencyTree(consumer, versions) {
  const boundary = await realpath(consumer);
  const candidate = await resolvePackage(candidatePackageName, boundary, boundary);
  directDependencies(candidate.manifest, versions);
  const seen = new Set();
  const inventory = [];
  async function visit(owner) {
    if (seen.has(owner.path)) return;
    seen.add(owner.path);
    const { name, version, dependencies = {} } = owner.manifest;
    assert.notEqual(name, "mammoth");
    if (name !== candidatePackageName) inventory.push(`${name}@${version}`);
    for (const dependency of Object.keys(dependencies).sort()) {
      const next = await resolvePackage(dependency, owner.path, boundary);
      if (name === candidatePackageName) assert.equal(next.manifest.version, versions[dependency]);
      await visit(next);
    }
  }
  await visit(candidate);
  // A consumer must not resolve Mammoth through ambient Node module paths either.
  const require = createRequire(join(boundary, "package.json"));
  assert.throws(() => require.resolve("mammoth"), { code: "MODULE_NOT_FOUND" });
  return [...new Set(inventory)].sort();
}
