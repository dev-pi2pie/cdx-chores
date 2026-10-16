import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { assertCaseExpectations, captureDocx } from "../fixtures/docx-baseline/capture";
import type { DocxCapture } from "../fixtures/docx-baseline/capture";
import { createContractCases } from "../fixtures/docx-baseline/corpus/contract/index";
import { REPO_ROOT, withTempFixtureDir } from "../../helpers/cli-test-utils";

const fixtures = join(REPO_ROOT, "test/document-rename/fixtures/docx-baseline");
const expected = JSON.parse(
  await readFile(join(fixtures, "contract.json"), "utf8"),
) as DocxCapture[];
const manifest = JSON.parse(await readFile(join(fixtures, "contract-manifest.json"), "utf8"));
const cases = createContractCases();

test("empty conversion expectations reject thrown converters despite the same outward reason", () => {
  const item = cases.find((value) => value.id === "contract-symbol-unknown-only")!;
  const baseline = expected.find((value) => value.id === item.id)!;
  const empty = {
    ...baseline,
    html: { value: "", messages: [] },
    rawText: { value: "", messages: [] },
  };
  const emptyCase = { ...item, expected: { ...item.expected, rawEquals: "", htmlEquals: "" } };
  for (const stream of ["html", "rawText"] as const) {
    expect(() =>
      assertCaseExpectations(emptyCase, { ...empty, [stream]: { error: "conversion failed" } }),
    ).toThrow("expected a completed");
  }
});

test("DOCX contract research has separate captures and independent expectations for every case", () => {
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

// Cycle probes stay in the bounded Node launcher, rather than the application test process.
for (const item of cases.filter((item) => item.execution !== "bounded-node")) {
  test(`DOCX contract baseline: ${item.id}`, async () => {
    await withTempFixtureDir("docx-baseline-contract", async (root) => {
      if (!("bytes" in item.input)) throw new Error("Contract inputs must be generated");
      const directory = join(root, item.id);
      await mkdir(directory);
      const path = join(directory, `${item.id}.docx`);
      await writeFile(path, item.input.bytes);
      const captured = await captureDocx(path, root, item.id);
      assertCaseExpectations(item, captured);
      const baseline = expected.find((value) => value.id === item.id);
      if (!baseline) throw new Error(`Missing contract baseline: ${item.id}`);
      // Runtime TypeError wording differs in Bun; complete Node captures are verified manually.
      const { html, rawText, ...evidence } = captured;
      const { html: expectedHtml, rawText: expectedRawText, ...expectedEvidence } = baseline;
      expect(evidence).toEqual(expectedEvidence);
      if ("value" in expectedHtml) expect(html).toEqual(expectedHtml);
      else expect("error" in html).toBe(true);
      if ("value" in expectedRawText) expect(rawText).toEqual(expectedRawText);
      else expect("error" in rawText).toBe(true);
    });
  }, 15_000);
}
