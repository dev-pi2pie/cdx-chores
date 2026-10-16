import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "tsdown";

import { verifyPackageProcessOwnership } from "../../test/document-rename/fixtures/docx-package-process.mjs";
import { buildCandidateAssets, candidateBuildOptions } from "./build.mjs";
import {
  candidatePackageName,
  inspectCandidatePackage,
  inspectDependencyTree,
  json,
  runtimeDependencies,
} from "./package-inspect.mjs";
import {
  executable,
  npmCli,
  packageProcessCleanupUnconfirmed,
  runPackageCommand,
} from "./package-process.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
let stage = "preflight";
let workspace;
let ownershipConfirmed = true;
try {
  assert.equal(process.argv.length, 2);
  const npm = await npmCli();
  const bun = await executable("bun");
  const tar = await executable("tar");
  workspace = await realpath(await mkdtemp(join(tmpdir(), "cdx-docx-package-")));
  const home = join(workspace, "home");
  const config = join(workspace, "empty.npmrc");
  const globalConfig = join(workspace, "empty-global.npmrc");
  await mkdir(home);
  await writeFile(config, "");
  await writeFile(globalConfig, "");
  const env = {
    SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT,
    PATH: [dirname(process.execPath), dirname(bun), "/usr/bin", "/bin"].join(":"),
    HOME: home,
    XDG_CONFIG_HOME: home,
    XDG_CACHE_HOME: join(workspace, "cache"),
    TMPDIR: workspace,
    TMP: workspace,
    TEMP: workspace,
    npm_config_cache: join(workspace, "npm-cache"),
    npm_config_userconfig: config,
    npm_config_globalconfig: globalConfig,
    BUN_INSTALL_CACHE_DIR: join(workspace, "bun-cache"),
    NO_COLOR: "1",
  };
  // Installation may require the host's network route, without loading user npm config.
  for (const name of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "NODE_USE_ENV_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "no_proxy",
    "npm_config_proxy",
    "npm_config_https_proxy",
    "npm_config_noproxy",
    "NPM_CONFIG_PROXY",
    "NPM_CONFIG_HTTPS_PROXY",
    "NPM_CONFIG_NOPROXY",
  ])
    if (process.env[name] !== undefined) env[name] = process.env[name];
  let commandIndex = 0;
  const run = (path, args, cwd, timeout) =>
    runPackageCommand(path, args, {
      cwd,
      env,
      timeout,
      log: join(workspace, `command-${commandIndex++}.log`),
    });
  const npmRun = (args, cwd) => run(process.execPath, [npm, ...args], cwd);
  stage = "package process ownership";
  await verifyPackageProcessOwnership(workspace, env);
  process.stdout.write("package process ownership: passed yes\n");
  stage = "build";
  const candidate = join(workspace, "candidate");
  const dist = join(candidate, "dist");
  await mkdir(dist, { recursive: true });
  await buildCandidateAssets(dist);
  const versions = Object.fromEntries(
    await Promise.all(
      runtimeDependencies.map(async (name) => [
        name,
        (await json(join(repo, "node_modules", name, "package.json"))).version,
      ]),
    ),
  );
  await writeFile(
    join(candidate, "package.json"),
    JSON.stringify(
      {
        name: candidatePackageName,
        version: "0.0.0",
        private: true,
        license: "MIT",
        type: "module",
        files: ["dist"],
        exports: { ".": { import: "./dist/reader.mjs", require: "./dist/reader.cjs" } },
        dependencies: versions,
        engines: { node: ">=22.23.0" },
      },
      null,
      2,
    ),
  );
  const prepared = join(workspace, "prepared");
  await build({
    ...candidateBuildOptions(prepared),
    entry: { input: "test/document-rename/fixtures/docx-package-input.ts" },
    format: ["esm"],
  });
  const input = join(workspace, "representative.docx");
  const { packageCheckInput } = await import(pathToFileURL(join(prepared, "input.mjs")).href);
  await writeFile(input, packageCheckInput());
  stage = "pack inspection";
  const packed = JSON.parse(
    await npmRun(
      ["pack", "--json", "--ignore-scripts", "--pack-destination", workspace],
      candidate,
    ),
  );
  assert.equal(packed.length, 1);
  const archive = join(workspace, packed[0].filename);
  const listing = (await run(tar, ["-tzf", archive], workspace)).trim().split("\n");
  assert.ok(
    listing.every((path) => path.startsWith("package/") && !path.split("/").includes("..")),
  );
  const inspected = join(workspace, "inspected");
  await mkdir(inspected);
  await run(tar, ["-xzf", archive, "-C", inspected], workspace);
  const expectedFiles = await inspectCandidatePackage(join(inspected, "package"), versions, repo);
  process.stdout.write("candidate tarball: passed yes\n");
  stage = "minimum runtime";
  const runtime = join(workspace, "minimum-runtime");
  await mkdir(runtime);
  await writeFile(join(runtime, "package.json"), '{"private":true}');
  await npmRun(
    ["install", "--no-audit", "--no-fund", "--package-lock=false", "node@22.23.0"],
    runtime,
  );
  const minimumNode = await realpath(join(runtime, "node_modules/node/bin/node"));
  await run(
    minimumNode,
    ["--eval", 'require("node:assert/strict").equal(process.versions.node, "22.23.0")'],
    runtime,
  );
  let previousTree;
  for (const installer of ["npm", "bun"]) {
    stage = `${installer} installation`;
    const consumer = join(workspace, `${installer}-consumer`);
    await mkdir(consumer);
    await writeFile(join(consumer, "package.json"), '{"private":true,"type":"module"}');
    if (installer === "npm") {
      await npmRun(
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--package-lock=false",
          "--no-save",
          archive,
        ],
        consumer,
      );
    } else {
      await run(
        bun,
        [
          "add",
          "--ignore-scripts",
          "--no-save",
          "--no-progress",
          "--linker=hoisted",
          "--backend=copyfile",
          archive,
        ],
        consumer,
      );
    }
    const installed = join(consumer, "node_modules", candidatePackageName);
    await inspectCandidatePackage(installed, versions, repo, expectedFiles);
    const tree = await inspectDependencyTree(consumer, versions);
    if (previousTree) assert.deepEqual(tree, previousTree);
    previousTree = tree;
    process.stdout.write(`${installer} dependency tree: passed yes\n`);
    const driver = join(consumer, "consumer.mjs");
    await copyFile(join(repo, "test/document-rename/fixtures/docx-package-consumer.mjs"), driver);
    for (const [runtimeName, node] of [
      ["primary", process.execPath],
      ["minimum", minimumNode],
    ]) {
      for (const format of ["esm", "cjs"]) {
        stage = `${installer} ${runtimeName} ${format}`;
        const output = await run(node, [driver, format, input], consumer, 30_000);
        assert.equal(output, `${format}: passed yes\n`);
        process.stdout.write(`${stage}: passed yes\n`);
      }
    }
    await inspectCandidatePackage(installed, versions, repo, expectedFiles);
  }
  process.stdout.write(`retained dependencies: ${previousTree.join(", ")}\n`);
} catch {
  ownershipConfirmed = !packageProcessCleanupUnconfirmed();
  process.stdout.write(`${stage}: passed no\n`);
  process.exitCode = 1;
} finally {
  if (workspace && ownershipConfirmed) await rm(workspace, { recursive: true, force: true });
  process.stdout.write(`temporary cleanup: passed ${ownershipConfirmed ? "yes" : "no"}\n`);
}
