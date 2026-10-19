import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { assertDocxProductObservation } from "../fixtures/docx-baseline/assertions";
import type { DocxCapture } from "../fixtures/docx-baseline/capture";
import { createContractCases } from "../fixtures/docx-baseline/corpus/contract/index";
import { createDocxProductFixture } from "../fixtures/docx-product/build";
import { REPO_ROOT } from "../../helpers/cli-test-utils";

const fixtures = join(REPO_ROOT, "test/document-rename/fixtures/docx-baseline");
const expected = JSON.parse(
  await readFile(join(fixtures, "contract.json"), "utf8"),
) as DocxCapture[];
const manifest = JSON.parse(await readFile(join(fixtures, "contract-manifest.json"), "utf8"));
const cases = createContractCases();
// Cycle probes remain in the explicit supervised comparison; they retain bounded product semantics.
const routineCases = cases.filter((item) => item.execution !== "bounded-node");
let product: Awaited<ReturnType<typeof createDocxProductFixture>>;
let observations: Awaited<ReturnType<typeof product.observeCases>>;
beforeAll(async () => {
  product = await createDocxProductFixture();
  observations = await product.observeCases(routineCases);
}, 45_000);
afterAll(async () => {
  await product?.cleanup();
});

test("completed empty document facts reject reader failure despite the same outward reason", () => {
  const item = cases.find((value) => value.id === "contract-symbol-unknown-only")!;
  const baseline = expected.find((value) => value.id === item.id)!;
  if (!("bytes" in item.input)) throw new Error("Contract inputs must be generated");
  const bytes = item.input.bytes;
  expect(() =>
    assertDocxProductObservation(item, baseline, bytes, {
      read: { ok: false, diagnostic: "docx_parse_error" },
      evidence: { reason: "docx_extract_error" },
      prompt: null,
    }),
  ).toThrow("expected document facts");
});

test("DOCX product contract retains frozen captures and independent expectations for every case", () => {
  expect(cases).toHaveLength(33);
  expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length);
  expect(expected.map((item) => item.id)).toEqual(cases.map((item) => item.id));
  expect(manifest).toEqual(
    cases.map((item) => ({
      id: item.id,
      category: item.category,
      variations: item.variations,
      ...(item.execution ? { execution: item.execution } : {}),
      input: "generated",
      expected: item.expected,
    })),
  );
  expect(cases.filter((item) => item.execution === "bounded-node").map((item) => item.id)).toEqual([
    "contract-note-self-cycle",
    "contract-note-mutual-cycle",
  ]);
  for (const item of cases) {
    expect(item.variations.length).toBeGreaterThan(0);
    expect(Object.keys(item.expected).length).toBeGreaterThan(0);
  }
});

for (const item of routineCases) {
  test(`compiled DOCX product preserves contract evidence and prompt: ${item.id}`, () => {
    const baseline = expected.find((value) => value.id === item.id);
    const observed = observations.get(item.id);
    if (!baseline || !observed)
      throw new Error(`Missing contract baseline or observation: ${item.id}`);
    assertDocxProductObservation(item, baseline, observed.bytes, observed.observation);
  });
}
