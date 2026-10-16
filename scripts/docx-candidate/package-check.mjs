import assert from "node:assert/strict";
import { copyFile, mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { verifyPackageProcessOwnership } from "../../test/document-rename/fixtures/docx-package-process.mjs";
import { candidateCliOptions } from "./cli.mjs";
import {
  candidatePackageName,
  inspectCandidatePackage,
  inspectDependencyTree,
  json,
  runtimeDependencies,
} from "./package-inspect.mjs";
import { executable, npmCli } from "./package-process.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
let stage = "preflight";
const cli = await candidateCliOptions("package");
if (cli) {
  const { runCandidateDriver } = await import("./driver.mjs");
  await runCandidateDriver(
    {
      title: "DOCX candidate package validation",
      scope: "npm and Bun; primary and minimum Node; ESM and CJS; 8 consumer paths",
      prefix: "cdx-docx-package-",
      stage: () => stage,
      failure: () => `${stage}: passed no\n`,
      cleanupResult: true,
    },
    async (harness, temporary) => {
      const workspace = await realpath(temporary);
      assert.notEqual(process.platform, "win32", "Package checks require POSIX process groups");
      const npm = await npmCli();
      const bun = await executable("bun");
      const tar = await executable("tar");
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
        harness.command(path, args, {
          stage: "runner",
          label: stage,
          posixOnly: true,
          cwd,
          env,
          timeout,
          log: join(workspace, `command-${commandIndex++}.log`),
        });
      const npmRun = (args, cwd) => run(process.execPath, [npm, ...args], cwd);
      stage = "package process ownership";
      await harness.stage("Package process ownership probes");
      await verifyPackageProcessOwnership(workspace, env, async (path, args, options) => {
        try {
          return await harness.command(path, args, {
            ...options,
            stage: "runner",
            label: "Package process ownership probe",
            posixOnly: true,
            silent: true,
          });
        } catch (error) {
          if (harness.signal.aborted || harness.cleanupUnconfirmed) throw error;
          throw new Error("package command failed");
        }
      });
      await harness.success("Package process ownership probes");
      await harness.result("package process ownership: passed yes\n");
      stage = "build";
      const candidate = join(workspace, "candidate");
      const dist = join(candidate, "dist");
      await mkdir(dist, { recursive: true });
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
      await harness.command(
        process.execPath,
        [join(repo, "scripts/docx-candidate/build-run.mjs"), "package", dist, prepared],
        {
          stage: "build",
          label: "Build package assets",
          cwd: repo,
          env,
          timeout: 60_000,
          posixOnly: true,
        },
      );
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
      const expectedFiles = await inspectCandidatePackage(join(inspected, "package"), versions);
      await harness.result("candidate tarball: passed yes\n");
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
      let completed = 0;
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
            ["add", "--ignore-scripts", "--no-save", "--no-progress", archive],
            consumer,
          );
        }
        const installed = join(consumer, "node_modules", candidatePackageName);
        await inspectCandidatePackage(installed, versions, expectedFiles, consumer);
        const tree = await inspectDependencyTree(consumer, versions);
        await harness.result(`${installer} dependency tree: passed yes\n`);
        await harness.result(`${installer} retained dependencies: ${JSON.stringify(tree)}\n`);
        const driver = join(consumer, "consumer.mjs");
        await copyFile(
          join(repo, "test/document-rename/fixtures/docx-package-consumer.mjs"),
          driver,
        );
        for (const [runtimeName, node] of [
          ["primary", process.execPath],
          ["minimum", minimumNode],
        ]) {
          for (const format of ["esm", "cjs"]) {
            stage = `${installer} ${runtimeName} ${format}`;
            const output = await run(node, [driver, format, input], consumer, 30_000);
            assert.equal(output, `${format}: passed yes\n`);
            await harness.result(`${stage}: passed yes\n`);
            await harness.success(`Consumer ${++completed}/8 ${stage}`);
          }
        }
        await inspectCandidatePackage(installed, versions, expectedFiles, consumer);
      }
      return "";
    },
  );
}
