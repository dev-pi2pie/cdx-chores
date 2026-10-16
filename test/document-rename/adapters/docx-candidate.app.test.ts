import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import {
  createCandidateEvidenceExtractor,
  readDocxDocument,
} from "../fixtures/docx-candidate/adapter";
import { createInitialReaderCases } from "../fixtures/docx-candidate/cases";
import { compareDocxReader } from "../fixtures/docx-candidate/compare";
import type { DocxCapture } from "../fixtures/docx-baseline/capture";
import { buildDocxPackage, paragraph } from "../fixtures/docx-baseline/corpus/builder";
import { readDocxXmlParts } from "../../../src/adapters/docx/ooxml-package";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

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
