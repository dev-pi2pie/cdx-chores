import { expect, test } from "bun:test";
import { copyFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "tsdown";

import { buildStoredZip, documentXml, paragraph } from "../../scripts/docx-baseline/corpus/builder";
import { createBaselineCases } from "../../scripts/docx-baseline/corpus/index";
import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

const protocolModes = [
  "valid",
  "malformed",
  "oversized",
  "truncated",
  "trailing",
  "second",
  "utf8",
  "schema",
  "early-exit",
  "crash",
  "success-crash",
  "valid-success-stubborn",
  "stubborn",
];

test("Node DOCX process boundary settles failures and leaves no live work", async () => {
  await withTempFixtureDir("docx-runtime", async (root) => {
    const sourceRoot = join(import.meta.dir, "fixtures/docx-runtime");
    const runtimeRoot = join(REPO_ROOT, "src/docx/runtime");
    await build({
      config: false,
      entry: Object.fromEntries(
        [
          ...[
            "driver",
            "blocked-child",
            "blocked-worker",
            "crash-child",
            "crash-worker",
            "rss-child",
            "rss-worker",
            "success-worker",
            "tracked-child",
            "protocol-child",
            "offline-probe-parser",
          ].map((name) => join(sourceRoot, `${name}.ts`)),
          join(runtimeRoot, "docx-child.ts"),
          join(runtimeRoot, "docx-worker.ts"),
          join(REPO_ROOT, "src/docx/reader.ts"),
        ].map((path) => [path.slice(path.lastIndexOf("/") + 1, -3), path]),
      ),
      cwd: REPO_ROOT,
      outDir: root,
      platform: "node",
      target: "node22",
      format: ["esm"],
      fixedExtension: true,
      dts: false,
      clean: false,
      logLevel: "silent",
      deps: { onlyBundle: [] },
    });
    await copyFile(join(root, "reader.mjs"), join(root, "docx-parser.mjs"));
    await symlink(join(REPO_ROOT, "node_modules"), join(root, "node_modules"), "junction");
    for (const name of ["below", "at", "above"]) {
      await copyFile(join(root, "rss-child.mjs"), join(root, `rss-${name}-child.mjs`));
    }
    for (const mode of protocolModes) {
      await copyFile(join(root, "protocol-child.mjs"), join(root, `protocol-${mode}-child.mjs`));
    }
    const ordinaryInput = buildStoredZip([
      ["word/document.xml", documentXml(paragraph("Independent runtime report"))],
    ]);
    const offlineCases = createBaselineCases().filter((item) => item.id.startsWith("offline-"));
    const modes = [
      "guarded",
      "caller-heap",
      "deadline",
      "cancel",
      "busy",
      "pre-cancel",
      "input-limit",
      "input-close-rejected",
      ...["deadline", "cancel", "grace"].flatMap((cause) =>
        ["open", "stat", "read", "close"].map((operation) => `input-${cause}-${operation}`),
      ),
      "startup",
      "worker-crash",
      "unconfirmed-cleanup",
      "offline-probe",
      ...offlineCases.map((item) => item.id),
      "rss-below",
      "rss-at",
      "rss-above",
      "rss-real",
      "parent-disconnect",
      "request-magic",
      "request-metadata-limit",
      "request-document-limit",
      "request-truncated",
      "request-trailing",
      ...protocolModes.map((mode) => `protocol-${mode}`),
    ];
    for (const mode of modes) {
      for (const name of ["child-pid", "child-heartbeat", "worker-heartbeat"]) {
        await rm(join(root, name), { force: true });
      }
      await copyFile(
        join(root, mode === "offline-probe" ? "offline-probe-parser.mjs" : "reader.mjs"),
        join(root, "docx-parser.mjs"),
      );
      const offline = offlineCases.find((item) => item.id === mode);
      if (offline && !("bytes" in offline.input))
        throw new Error("Expected generated offline case");
      await writeFile(
        join(root, "input.docx"),
        offline && "bytes" in offline.input ? offline.input.bytes : ordinaryInput,
      );
      const owned = startFixtureProcess({
        executable: "node",
        args: [join(root, "driver.mjs"), mode, root],
        cwd: root,
        env: { PATH: process.env.PATH, NO_COLOR: "1" },
        timeoutMs: 10_000,
        graceMs: 250,
        cleanupMs: 3_000,
        maxOutputBytes: 65_536,
      });
      const result = await owned.completion;
      expect(result.stopped, `${mode}: ${JSON.stringify(result.issues)}`).toBe(true);
      expect(result.ok, `${mode}: ${result.stderr}`).toBe(true);
      expect(JSON.parse(result.stdout), mode).toEqual({ passed: true });
    }
  });
}, 60_000);
