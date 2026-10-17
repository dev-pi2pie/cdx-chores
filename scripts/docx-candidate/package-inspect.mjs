import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, join, relative, sep } from "node:path";

export const productPackageName = "cdx-chores";
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

/** Check required runtime bytes, allowing ordinary extra package files and contained links. */
export async function inspectProductPackage(
  root,
  sourceManifest,
  expectedAssets,
  installation = root,
) {
  const boundary = await realpath(installation);
  const canonical = await installedPath(boundary, root);
  const manifest = await json(await installedPath(boundary, join(canonical, "package.json")));
  assert.equal(manifest.name, productPackageName);
  assert.equal(manifest.version, sourceManifest.version);
  assert.deepEqual(manifest.dependencies, sourceManifest.dependencies);
  for (const name of runtimeDependencies) assert.ok(manifest.dependencies[name]);
  if (installation !== root) {
    for (const name of runtimeDependencies) {
      const installed = await resolvePackage(name, canonical, boundary);
      assert.equal(typeof installed.manifest.version, "string");
      assert.ok(installed.manifest.version.trim());
      const requested = manifest.dependencies[name];
      if (/^\d+\.\d+\.\d+$/.test(requested)) assert.equal(installed.manifest.version, requested);
    }
  }
  assert.equal(manifest.exports?.["."]?.import, "./dist/esm/index.mjs");
  assert.equal(manifest.exports?.["."]?.require, "./dist/cjs/index.cjs");
  assert.equal(manifest.exports?.["."]?.types, "./dist/esm/index.d.mts");
  assert.equal(manifest.bin?.[productPackageName], "dist/esm/bin.mjs");
  assert.deepEqual(manifest.engines, sourceManifest.engines);
  const hashes = {};
  const assets = ["dist/esm/index.d.mts"];
  for (const [directory, extension] of [
    ["esm", "mjs"],
    ["cjs", "cjs"],
  ]) {
    const files = await readdir(await installedPath(boundary, join(canonical, "dist", directory)));
    for (const name of [
      "index",
      "docx-child",
      "docx-worker",
      "docx-parser",
      ...(directory === "esm" ? ["bin"] : []),
    ])
      assert.ok(files.includes(`${name}.${extension}`), "Required product runtime asset missing");
    for (const name of files.filter((file) => file.endsWith(`.${extension}`)))
      assets.push(`dist/${directory}/${name}`);
  }
  for (const asset of assets) {
    const bytes = await readFile(await installedPath(boundary, join(canonical, asset)));
    hashes[asset] = createHash("sha256").update(bytes).digest("hex");
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
