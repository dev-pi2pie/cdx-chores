import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import * as candidate from "../../../scripts/docx-candidate/adapter";
import { createInitialReaderCases } from "../../../scripts/docx-candidate/cases";
import { compareInitialReader } from "../../../scripts/docx-candidate/compare";
import type { DocxCapture } from "../../../scripts/docx-baseline/capture";
import { buildDocxPackage, paragraph } from "../../../scripts/docx-baseline/corpus/builder";
import { readDocxXmlParts } from "../../../src/adapters/docx/ooxml-package";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

const baseline = JSON.parse(
  await readFile(
    join(REPO_ROOT, "test/document-rename/fixtures/docx-baseline/expected.json"),
    "utf8",
  ),
) as DocxCapture[];

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
      await compareInitialReader(candidate, item, expected, bytes, path, root);
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

test("built ESM/CJS reader comparisons run in Node and clean temporary assets", async () => {
  const parent = await mkdtemp(join(tmpdir(), "docx-initial-reader-test-"));
  try {
    const output = execFileSync("node", [join(REPO_ROOT, "scripts/docx-candidate/launch.mjs")], {
      cwd: REPO_ROOT,
      env: { ...process.env, TMPDIR: parent, TMP: parent, TEMP: parent },
      encoding: "utf8",
      timeout: 60_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(output).toBe("initial reader: passed yes\n");
    expect(await readdir(parent)).toEqual([]);
  } finally {
    await rm(parent, { recursive: true });
  }
}, 70_000);
