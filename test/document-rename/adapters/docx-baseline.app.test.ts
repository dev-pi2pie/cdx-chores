import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { assertCaseExpectations, captureDocx } from "../../../scripts/docx-baseline/capture";
import type { DocxCapture } from "../../../scripts/docx-baseline/capture";
import { createBaselineCases } from "../../../scripts/docx-baseline/corpus/index";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

const expected = JSON.parse(
  await readFile(
    join(REPO_ROOT, "test/document-rename/fixtures/docx-baseline/expected.json"),
    "utf8",
  ),
) as DocxCapture[];
const cases = createBaselineCases();

test("DOCX baseline covers the complete semantic manifest with unique captured inputs", () => {
  expect(expected.map((item) => item.id)).toEqual(cases.map((item) => item.id));
  expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length);
  expect(cases.filter((item) => "fixture" in item.input)).toHaveLength(7);
  for (const item of cases) {
    expect(item.variations.length).toBeGreaterThan(0);
    expect(Object.keys(item.expected).length).toBeGreaterThan(0);
  }
});

for (const item of cases) {
  test(`DOCX baseline: ${item.id}`, async () => {
    await withTempFixtureDir("docx-baseline", async (root) => {
      const directory = join(root, item.id);
      await mkdir(directory);
      const name = "fixture" in item.input ? basename(item.input.fixture) : `${item.id}.docx`;
      const bytes =
        "fixture" in item.input
          ? await readFile(join(REPO_ROOT, item.input.fixture))
          : item.input.bytes;
      const path = join(directory, name);
      await writeFile(path, bytes);
      const captured = await captureDocx(path, root, item.id);
      assertCaseExpectations(item, captured);
      const baseline = expected.find((value) => value.id === item.id);
      if (!baseline) throw new Error(`Missing baseline: ${item.id}`);
      expect(captured).toEqual(baseline);
    });
  }, 15_000);
}
