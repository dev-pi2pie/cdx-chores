import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
  createCandidateEvidenceExtractor,
  readDocxDocument,
} from "../../../scripts/docx-candidate/adapter";
import { createInitialReaderCases } from "../../../scripts/docx-candidate/cases";
import { compareDocxReader } from "../../../scripts/docx-candidate/compare";
import type { DocxCapture } from "../../../scripts/docx-baseline/capture";
import { buildDocxPackage, paragraph } from "../../../scripts/docx-baseline/corpus/builder";
import { readDocxXmlParts } from "../../../src/adapters/docx/ooxml-package";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";
import { startFixtureProcess } from "../../../scripts/testing/fixtures/fixture-process";

const baseline = JSON.parse(
  await readFile(
    join(REPO_ROOT, "test/document-rename/fixtures/docx-baseline/expected.json"),
    "utf8",
  ),
) as DocxCapture[];

const candidate = {
  readDocxDocument,
  extractCandidateDocxEvidence: createCandidateEvidenceExtractor(async (path) =>
    readDocxDocument(await readFile(path)),
  ),
};

for (const item of createInitialReaderCases()) {
  test(`initial DOCX reader preserves complete evidence and prompt: ${item.id}`, async () => {
    await withTempFixtureDir("docx-candidate", async (root) => {
      const expected = baseline.find((value) => value.id === item.id);
      if (!expected) throw new Error(`Missing frozen baseline: ${item.id}`);
      const bytes =
        "fixture" in item.input
          ? await readFile(join(REPO_ROOT, item.input.fixture))
          : item.input.bytes;
      const name = "fixture" in item.input ? basename(item.input.fixture) : `${item.id}.docx`;
      await mkdir(join(root, item.id));
      const path = join(root, item.id, name);
      await writeFile(path, bytes);
      await compareDocxReader(candidate, item, expected, bytes, path, root);
    });
  });
}

test("embedded style-map opt-in preserves default parts and the existing part cap", async () => {
  const map = "p.Heading1 => h2:fresh";
  const bytes = buildDocxPackage({
    body: paragraph("Package Helper Report"),
    extraParts: [["mammoth/style-map", map]],
  });
  const ordinary = await readDocxXmlParts(bytes);
  const selected = await readDocxXmlParts(bytes, { includeEmbeddedStyleMap: true });
  if ("reason" in ordinary || "reason" in selected) throw new Error("Expected valid package");
  expect(ordinary.has("/mammoth/style-map")).toBe(false);
  expect(selected.get("/mammoth/style-map")).toBe(map);
  selected.delete("/mammoth/style-map");
  expect(selected).toEqual(ordinary);
  for (const length of [256 * 1024, 256 * 1024 + 1]) {
    const parts = await readDocxXmlParts(
      buildDocxPackage({ extraParts: [["mammoth/style-map", "x".repeat(length)]] }),
      { includeEmbeddedStyleMap: true },
    );
    if ("reason" in parts) throw new Error("Expected valid package");
    expect(parts.has("/mammoth/style-map")).toBe(length <= 256 * 1024);
  }
});

test("built ESM/CJS reader smoke runs in Node and cleans temporary assets", async () => {
  const parent = await mkdtemp(join(tmpdir(), "docx-initial-reader-test-"));
  try {
    const output = execFileSync(
      "node",
      [join(REPO_ROOT, "scripts/docx-candidate/launch.mjs"), "--smoke"],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, TMPDIR: parent, TMP: parent, TEMP: parent },
        encoding: "utf8",
        timeout: 250_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    expect(output).toBe("guarded reader: passed yes\n");
    expect(await readdir(parent)).toEqual([]);
  } finally {
    await rm(parent, { recursive: true });
  }
}, 260_000);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  test(`candidate launcher streams before completion and cleans after ${signal}`, async () => {
    await withTempFixtureDir("docx-candidate-cancel", async (parent) => {
      const owned = startFixtureProcess({
        executable: "node",
        args: [join(REPO_ROOT, "scripts/docx-candidate/launch.mjs")],
        cwd: REPO_ROOT,
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          TMPDIR: parent,
          TMP: parent,
          TEMP: parent,
          FORCE_COLOR: "1",
          NO_COLOR: "",
        },
        timeoutMs: 30_000,
        graceMs: 2_000,
        cleanupMs: 4_000,
        maxOutputBytes: 128 * 1024,
      });
      let seen = "";
      let deliveredWhileRunning = false;
      owned.child.stderr.on("data", (chunk: Buffer) => {
        seen += chunk.toString("utf8");
        if (!deliveredWhileRunning && seen.includes("running seed-metadata-rich")) {
          deliveredWhileRunning = owned.child.exitCode === null;
          owned.child.kill(signal);
        }
      });
      const result = await owned.completion;
      expect(deliveredWhileRunning).toBe(true);
      expect(result.stopped).toBe(true);
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("guarded reader: passed no\n");
      expect(result.stderr).toContain("cancellation");
      expect(result.stderr).toContain("case seed-metadata-rich");
      expect(result.stderr).toContain("Temporary cleanup confirmed");
      expect(result.stderr).not.toContain("\u001b[");
      expect(result.stderr).not.toContain("guarded reader: passed yes");
      expect(await readdir(parent)).toEqual([]);
    });
  }, 40_000);
}
