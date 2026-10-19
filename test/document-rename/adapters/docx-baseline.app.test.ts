import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { assertDocxProductObservation } from "../fixtures/docx-baseline/assertions";
import type { DocxCapture } from "../fixtures/docx-baseline/capture";
import { createBaselineCases } from "../fixtures/docx-baseline/corpus/index";
import { createDocxProductFixture } from "../fixtures/docx-product/build";
import { REPO_ROOT } from "../../helpers/cli-test-utils";

const fixtures = join(REPO_ROOT, "test/document-rename/fixtures/docx-baseline");
const expected = JSON.parse(
  await readFile(join(fixtures, "expected.json"), "utf8"),
) as DocxCapture[];
const manifest = JSON.parse(await readFile(join(fixtures, "manifest.json"), "utf8")) as Array<
  Record<string, unknown>
>;
const cases = createBaselineCases();
let product: Awaited<ReturnType<typeof createDocxProductFixture>>;
let observations: Awaited<ReturnType<typeof product.observeCases>>;
beforeAll(async () => {
  product = await createDocxProductFixture();
  observations = await product.observeCases(cases);
}, 45_000);
afterAll(async () => {
  await product?.cleanup();
});

test("DOCX product regression covers the complete frozen semantic manifest", () => {
  expect(cases).toHaveLength(70);
  expect(expected.map((item) => item.id)).toEqual(cases.map((item) => item.id));
  expect(manifest).toHaveLength(91);
  expect(manifest.filter((item) => item.category !== "resource")).toEqual(
    cases.map((item) => ({
      id: item.id,
      category: item.category,
      variations: item.variations,
      input: "fixture" in item.input ? item.input.fixture : "generated",
      expected: item.expected,
    })),
  );
  expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length);
  expect(cases.filter((item) => "fixture" in item.input)).toHaveLength(7);
  for (const item of cases) {
    expect(item.variations.length).toBeGreaterThan(0);
    expect(Object.keys(item.expected).length).toBeGreaterThan(0);
  }
});

for (const item of cases) {
  test(`compiled DOCX product preserves semantic evidence and prompt: ${item.id}`, () => {
    const baseline = expected.find((value) => value.id === item.id);
    const observed = observations.get(item.id);
    if (!baseline || !observed) throw new Error(`Missing baseline or observation: ${item.id}`);
    assertDocxProductObservation(item, baseline, observed.bytes, observed.observation);
  });
}
