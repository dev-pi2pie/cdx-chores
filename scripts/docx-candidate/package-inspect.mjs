import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { isBuiltin, createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

export const candidatePackageName = "@cdx-chores-private/docx-reader-evaluation";
export const runtimeDependencies = ["dingbat-to-unicode", "fast-xml-parser", "yauzl"];
// Fresh-install evidence is invalidated by unreviewed transitive resolution changes.
const evaluatedTransitiveTree = [
  "@nodable/entities@3.1.0",
  "anynum@1.0.1",
  "fast-xml-builder@1.3.1",
  "is-unsafe@2.0.2",
  "path-expression-matcher@1.6.2",
  "pend@1.2.0",
  "strnum@2.5.1",
  "xml-naming@0.3.0",
];

export function assertDependencyInventory(inventory, versions) {
  assert.deepEqual(
    [...inventory].sort(),
    [
      ...evaluatedTransitiveTree,
      ...Object.entries(versions).map(([name, version]) => `${name}@${version}`),
    ].sort(),
  );
}

export async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function contained(root, path) {
  const part = relative(root, path);
  return part !== ".." && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}

async function files(root, path = root) {
  const result = [];
  for (const name of await readdir(path)) {
    const next = join(path, name);
    const stat = await lstat(next);
    assert.equal(stat.isSymbolicLink(), false, "Package contains a link");
    if (stat.isDirectory()) result.push(...(await files(root, next)));
    else {
      assert.equal(stat.isFile(), true);
      result.push(relative(root, next).split(sep).join("/"));
    }
  }
  return result.sort();
}

/** Check bytes actually extracted from the packed artifact, then each installation. */
export async function inspectCandidatePackage(root, versions, repo, expectedFiles) {
  assert.equal(await realpath(root), root);
  const manifest = await json(join(root, "package.json"));
  assert.equal(manifest.name, candidatePackageName);
  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.dependencies, versions);
  assert.deepEqual(manifest.exports["."], {
    import: "./dist/reader.mjs",
    require: "./dist/reader.cjs",
  });
  const found = await files(root);
  for (const name of ["reader", "docx-child", "docx-worker", "docx-parser"])
    for (const extension of ["mjs", "cjs"]) assert.ok(found.includes(`dist/${name}.${extension}`));
  assert.ok(found.every((name) => /^(package\.json|dist\/[\w.-]+\.(mjs|cjs))$/.test(name)));
  const external = new Set();
  const hashes = {};
  for (const name of found) {
    const bytes = await readFile(join(root, name));
    hashes[name] = createHash("sha256").update(bytes).digest("hex");
    if (!name.startsWith("dist/")) continue;
    const source = bytes.toString("utf8");
    assert.equal(source.includes(repo), false, "Source-tree path in package");
    assert.equal(source.includes("scripts/docx-baseline"), false, "Baseline runner in package");
    const imports = source.matchAll(
      /(?:\bfrom\s*|\brequire\(\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g,
    );
    for (const [, specifier] of imports) {
      if (isBuiltin(specifier)) continue;
      if (specifier.startsWith(".")) {
        const target = join(dirname(join(root, name)), specifier);
        assert.ok(contained(root, target));
        assert.ok((await lstat(target)).isFile());
      } else {
        assert.ok(runtimeDependencies.includes(specifier), "Unexpected runtime import");
        external.add(specifier);
      }
    }
  }
  assert.deepEqual([...external].sort(), runtimeDependencies);
  if (expectedFiles) assert.deepEqual(hashes, expectedFiles);
  return hashes;
}

async function resolvePackage(name, from, consumer) {
  const require = createRequire(join(from, "package.json"));
  for (const directory of require.resolve.paths(name) ?? []) {
    const path = join(directory, name);
    try {
      const manifest = await json(join(path, "package.json"));
      const canonical = await realpath(path);
      assert.ok(contained(consumer, canonical), "Dependency resolution escaped fresh consumer");
      assert.equal(canonical, path, "Linked dependency");
      assert.equal(manifest.name, name);
      return { path, manifest };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  throw new Error("Installed dependency unavailable");
}

/** Traverse resolved dependencies instead of assuming a package-manager lock layout. */
export async function inspectDependencyTree(consumer, versions) {
  const candidate = await resolvePackage(candidatePackageName, consumer, consumer);
  const seen = new Set();
  const inventory = [];
  async function visit(owner) {
    if (seen.has(owner.path)) return;
    seen.add(owner.path);
    const { name, version, dependencies = {} } = owner.manifest;
    assert.notEqual(name, "mammoth");
    if (name !== candidatePackageName) {
      inventory.push(`${name}@${version}`);
    }
    for (const dependency of Object.keys(dependencies).sort()) {
      const next = await resolvePackage(dependency, owner.path, consumer);
      if (owner.manifest.name === candidatePackageName)
        assert.equal(next.manifest.version, versions[dependency]);
      await visit(next);
    }
  }
  await visit(candidate);
  // A consumer must not resolve Mammoth through ambient Node module paths either.
  const require = createRequire(join(consumer, "package.json"));
  assert.throws(() => require.resolve("mammoth"), { code: "MODULE_NOT_FOUND" });
  const result = [...new Set(inventory)].sort();
  assertDependencyInventory(result, versions);
  return result;
}
