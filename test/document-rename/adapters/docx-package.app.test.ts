import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  candidatePackageName,
  inspectCandidatePackage,
  inspectDependencyTree,
  runtimeDependencies,
} from "../../../scripts/docx-candidate/package-inspect.mjs";

const versions: Record<string, string> = {
  "dingbat-to-unicode": "1.0.2",
  "fast-xml-parser": "5.11.2",
  yauzl: "3.4.0",
};
const assets = ["reader", "docx-child", "docx-worker", "docx-parser"].flatMap((name) =>
  ["mjs", "cjs"].map((extension) => `dist/${name}.${extension}`),
);

// Managed TMPDIR is inside the repository; consumer resolution must not inherit its Mammoth.
async function withPackageFixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(await realpath("/tmp"), "cdx-docx-package-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value));
}

async function manifest(path: string) {
  return JSON.parse(await readFile(join(path, "package.json"), "utf8"));
}

async function writePackage(
  path: string,
  name: string,
  version = "1.0.0",
  dependencies: Record<string, string> = {},
) {
  await mkdir(path, { recursive: true });
  await writeJson(join(path, "package.json"), { name, version, dependencies, main: "./index.js" });
  await writeFile(join(path, "index.js"), "module.exports = {};\n");
  return path;
}

async function writeCandidate(path: string) {
  await mkdir(join(path, "dist"), { recursive: true });
  await writeJson(join(path, "package.json"), {
    name: candidatePackageName,
    version: "0.0.0",
    private: true,
    dependencies: versions,
    exports: { ".": { import: "./dist/reader.mjs", require: "./dist/reader.cjs" } },
  });
  for (const asset of assets) await writeFile(join(path, asset), `// ${asset}\n`);
  return path;
}

async function writeConsumer(root: string, name = "consumer") {
  const consumer = join(root, name);
  await mkdir(consumer, { recursive: true });
  await writeJson(join(consumer, "package.json"), { private: true });
  const candidate = await writeCandidate(join(consumer, "node_modules", candidatePackageName));
  for (const [dependency, version] of Object.entries(versions))
    await writePackage(join(consumer, "node_modules", dependency), dependency, version);
  return { consumer, candidate };
}

test("candidate integrity covers required runtime assets while allowing ordinary extra files", async () => {
  await withPackageFixture(async (root) => {
    const candidate = await writeCandidate(join(root, "candidate"));
    expect(runtimeDependencies).toEqual(["dingbat-to-unicode", "fast-xml-parser", "yauzl"]);
    const original = await inspectCandidatePackage(candidate, versions);
    expect(Object.keys(original).sort()).toEqual([...assets].sort());
    await mkdir(join(candidate, "notes"));
    await writeFile(join(candidate, "notes", "example.js"), 'require("unrelated-example");\n');
    await writeFile(join(candidate, "README.md"), "Additional ordinary package file.\n");
    await writeFile(
      join(candidate, "package.json"),
      JSON.stringify(
        { ...(await manifest(candidate)), description: "Evaluation package" },
        null,
        2,
      ),
    );
    expect(await inspectCandidatePackage(candidate, versions, original)).toEqual(original);
    await writeFile(join(candidate, "dist/docx-worker.mjs"), "// changed runtime asset\n");
    await expect(inspectCandidatePackage(candidate, versions, original)).rejects.toThrow();
  });
});

for (const asset of assets) {
  test(`candidate requires ${asset}`, async () => {
    await withPackageFixture(async (root) => {
      const candidate = await writeCandidate(join(root, "candidate"));
      await rm(join(candidate, asset));
      await expect(inspectCandidatePackage(candidate, versions)).rejects.toThrow();
    });
  });
}

for (const format of ["import", "require"]) {
  for (const failure of ["missing", "wrong-target"]) {
    test(`candidate rejects ${failure} ${format} exports`, async () => {
      await withPackageFixture(async (root) => {
        const candidate = await writeCandidate(join(root, "candidate"));
        const value = await manifest(candidate);
        if (failure === "missing") delete value.exports["."][format];
        else value.exports["."][format] = "./dist/unavailable.js";
        await writeJson(join(candidate, "package.json"), value);
        await expect(inspectCandidatePackage(candidate, versions)).rejects.toThrow();
      });
    });
  }
}

for (const mismatch of ["missing", "extra", "version"]) {
  test(`candidate rejects ${mismatch} direct dependency declarations`, async () => {
    await withPackageFixture(async (root) => {
      const candidate = await writeCandidate(join(root, "candidate"));
      const value = await manifest(candidate);
      if (mismatch === "missing") delete value.dependencies.yauzl;
      if (mismatch === "extra") value.dependencies.other = "1.0.0";
      if (mismatch === "version") value.dependencies.yauzl = "999.0.0";
      await writeJson(join(candidate, "package.json"), value);
      await expect(inspectCandidatePackage(candidate, versions)).rejects.toThrow();
    });
  });
}

test("candidate accepts manifest and runtime asset links contained in its installation", async () => {
  await withPackageFixture(async (root) => {
    const { consumer, candidate } = await writeConsumer(root);
    const expected = await inspectCandidatePackage(candidate, versions);
    const storage = join(consumer, "storage");
    await mkdir(storage);
    for (const name of ["package.json", "dist/docx-parser.mjs"]) {
      const target = join(storage, name.replaceAll("/", "-"));
      await writeFile(target, await readFile(join(candidate, name)));
      await rm(join(candidate, name));
      await symlink(target, join(candidate, name));
    }
    expect(await inspectCandidatePackage(candidate, versions, expected, consumer)).toEqual(
      expected,
    );
  });
});

for (const name of ["package.json", "dist/docx-parser.mjs"]) {
  test(`candidate rejects ${name} links outside the installation`, async () => {
    await withPackageFixture(async (root) => {
      const { consumer, candidate } = await writeConsumer(root);
      const outside = join(root, "outside-file");
      await writeFile(outside, await readFile(join(candidate, name)));
      await rm(join(candidate, name));
      await symlink(outside, join(candidate, name));
      await expect(
        inspectCandidatePackage(candidate, versions, undefined, consumer),
      ).rejects.toThrow();
    });
  });
}

test("dependency inventories observe valid transitive versions and layout differences", async () => {
  await withPackageFixture(async (root) => {
    const first = await writeConsumer(root, "first");
    const second = await writeConsumer(root, "second");
    for (const [fixture, version] of [
      [first, "2.0.0"],
      [second, "3.1.0"],
    ] as const) {
      await writePackage(
        join(fixture.consumer, "node_modules/fast-xml-parser"),
        "fast-xml-parser",
        versions["fast-xml-parser"],
        { "@synthetic/transitive": "*" },
      );
      await writePackage(
        join(
          fixture.consumer,
          fixture === first ? "node_modules" : "node_modules/fast-xml-parser/node_modules",
          "@synthetic/transitive",
        ),
        "@synthetic/transitive",
        version,
        fixture === second ? { "additional-runtime-helper": "*" } : {},
      );
    }
    await writePackage(
      join(second.consumer, "node_modules/additional-runtime-helper"),
      "additional-runtime-helper",
      "4.2.0",
    );
    const firstInventory = await inspectDependencyTree(first.consumer, versions);
    const secondInventory = await inspectDependencyTree(second.consumer, versions);
    expect(firstInventory).toEqual(
      [
        "@synthetic/transitive@2.0.0",
        ...Object.entries(versions).map(([n, v]) => `${n}@${v}`),
      ].sort(),
    );
    expect(secondInventory).toEqual(
      [
        "@synthetic/transitive@3.1.0",
        "additional-runtime-helper@4.2.0",
        ...Object.entries(versions).map(([n, v]) => `${n}@${v}`),
      ].sort(),
    );
    expect(secondInventory).not.toEqual(firstInventory);
  });
});

test("contained linked packages, a linked candidate, and shared dependency cycles are supported", async () => {
  await withPackageFixture(async (root) => {
    const consumer = join(root, "consumer");
    const storage = join(consumer, ".store");
    await mkdir(join(consumer, "node_modules", dirname(candidatePackageName)), { recursive: true });
    await writeJson(join(consumer, "package.json"), { private: true });
    const candidate = await writeCandidate(join(storage, "candidate"));
    await symlink(candidate, join(consumer, "node_modules", candidatePackageName));
    for (const [name, version] of Object.entries(versions)) {
      const target = await writePackage(join(storage, name), name, version, { "cycle-a": "*" });
      await symlink(target, join(consumer, "node_modules", name));
    }
    for (const [name, dependencies] of [
      ["cycle-a", { "cycle-b": "*" }],
      ["cycle-b", { "cycle-a": "*" }],
    ] as const) {
      const target = await writePackage(join(storage, name), name, "7.0.0", dependencies);
      await symlink(target, join(consumer, "node_modules", name));
    }
    expect(
      Object.keys(
        await inspectCandidatePackage(
          join(consumer, "node_modules", candidatePackageName),
          versions,
          undefined,
          consumer,
        ),
      ).sort(),
    ).toEqual([...assets].sort());
    expect(await inspectDependencyTree(consumer, versions)).toEqual(
      [
        "cycle-a@7.0.0",
        "cycle-b@7.0.0",
        ...Object.entries(versions).map(([n, v]) => `${n}@${v}`),
      ].sort(),
    );
  });
});

for (const failure of ["missing-direct", "wrong-version", "missing-transitive"]) {
  test(`dependency inspection rejects ${failure}`, async () => {
    await withPackageFixture(async (root) => {
      const { consumer } = await writeConsumer(root);
      const dependency = join(consumer, "node_modules/yauzl");
      if (failure === "missing-direct") await rm(dependency, { recursive: true });
      if (failure === "wrong-version") await writePackage(dependency, "yauzl", "999.0.0");
      if (failure === "missing-transitive")
        await writePackage(dependency, "yauzl", versions.yauzl, { unavailable: "*" });
      await expect(inspectDependencyTree(consumer, versions)).rejects.toThrow();
    });
  });
}

for (const failure of ["package-link", "manifest-link", "ancestor-fallback", "candidate-link"]) {
  test(`dependency inspection rejects escaped ${failure}`, async () => {
    await withPackageFixture(async (root) => {
      const { consumer, candidate } = await writeConsumer(root);
      if (failure === "candidate-link") {
        const outside = await writeCandidate(join(root, "outside-candidate"));
        await rm(candidate, { recursive: true });
        await symlink(outside, candidate);
      } else {
        const dependency = join(consumer, "node_modules/yauzl");
        const outside = await writePackage(
          join(root, "node_modules/yauzl"),
          "yauzl",
          versions.yauzl,
        );
        if (failure === "manifest-link") {
          await rm(join(dependency, "package.json"));
          await symlink(join(outside, "package.json"), join(dependency, "package.json"));
        } else {
          await rm(dependency, { recursive: true });
          if (failure === "package-link") await symlink(outside, dependency);
        }
      }
      await expect(inspectDependencyTree(consumer, versions)).rejects.toThrow();
    });
  });
}

for (const source of ["direct", "transitive", "undeclared", "ambient"]) {
  test(`dependency inspection rejects ${source} Mammoth availability`, async () => {
    await withPackageFixture(async (root) => {
      const { consumer, candidate } = await writeConsumer(root);
      if (source === "direct") {
        const value = await manifest(candidate);
        value.dependencies.mammoth = "1.0.0";
        await writeJson(join(candidate, "package.json"), value);
      }
      if (source === "transitive")
        await writePackage(join(consumer, "node_modules/yauzl"), "yauzl", versions.yauzl, {
          mammoth: "1.0.0",
        });
      await writePackage(
        join(source === "ambient" ? root : consumer, "node_modules/mammoth"),
        "mammoth",
      );
      await expect(inspectDependencyTree(consumer, versions)).rejects.toThrow();
    });
  });
}
