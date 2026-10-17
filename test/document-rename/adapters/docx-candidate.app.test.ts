import { test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import {
  createCandidateEvidenceExtractor,
  readDocxDocument,
} from "../fixtures/docx-candidate/adapter";
import { createInitialReaderCases } from "../fixtures/docx-candidate/cases";
import { compareDocxReader } from "../fixtures/docx-candidate/compare";
import type { DocxCapture } from "../fixtures/docx-baseline/capture";
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
