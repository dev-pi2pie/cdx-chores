import assert from "node:assert/strict";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";

import { buildDocumentPrompt } from "../../../src/adapters/codex/document-rename/prompt";
import { createDocxProductFixture } from "../fixtures/docx-product/build";
import type { DocxProductObservation } from "../fixtures/docx-baseline/assertions";
import type { DocxBaselineCase } from "../fixtures/docx-baseline/corpus/index";
import { createDocxReviewMatrix } from "../fixtures/docx-review-matrix";
import {
  expectedReviewEvidence,
  reviewCaseInput,
  type ReviewCase,
} from "../fixtures/docx-review-cases";

const matrix = createDocxReviewMatrix();
const direct = new Map<string, { input: DocxBaselineCase; observation: DocxProductObservation }>();
let product: Awaited<ReturnType<typeof createDocxProductFixture>>;
beforeAll(async () => {
  product = await createDocxProductFixture();
}, 45_000);
afterAll(async () => {
  await product?.cleanup();
}, 15_000);

function assertReviewObservation(item: ReviewCase, observation: DocxProductObservation) {
  const expected = expectedReviewEvidence(item);
  expect(observation.evidence, item.id).toEqual(expected);
  expect(observation.prompt, item.id).toBe(
    "reason" in expected
      ? null
      : buildDocumentPrompt({
          evidences: [{ path: `${item.id}/${expected.filename}`, evidence: expected }],
          workingDirectory: ".",
        }),
  );
  if (item.diagnostic) {
    expect(observation.read, item.id).toEqual({ ok: false, diagnostic: item.diagnostic });
  } else {
    expect(observation.read.ok, item.id).toBe(true);
    if (!observation.read.ok) throw new Error(observation.read.diagnostic);
    expect(observation.read.facts.rawText, item.id).toBe(item.rawText!);
    expect(observation.read.facts.headings, item.id).toEqual(item.headings!);
  }
}

// Register sequentially: the supervised comparison requires every direct batch to finish.
for (const group of matrix.groups) {
  test(`compiled direct DOCX preserves ${group.name} evidence and prompts`, async () => {
    const deadline = performance.now() + 45_000;
    const inputs = group.cases.map(reviewCaseInput);
    const observations = await product.observeCases(inputs, { mode: "direct", deadline });
    for (const [index, item] of group.cases.entries()) {
      const actual = observations.get(item.id);
      assert(actual, `Missing direct DOCX observation: ${item.id}`);
      assertReviewObservation(item, actual.observation);
      direct.set(item.id, { input: inputs[index]!, observation: actual.observation });
    }
  }, 45_000);
}

test("supervised DOCX matrix preserves complete observations and agrees with direct parsing", async () => {
  const deadline = performance.now() + 45_000;
  expect([...direct.keys()]).toEqual(matrix.cases.map((item) => item.id));
  const inputs = matrix.supervised.map((item) => {
    const actual = direct.get(item.id);
    assert(actual, `Missing direct DOCX observation for parity: ${item.id}`);
    return actual.input;
  });
  const observations = await product.observeCases(inputs, { deadline });
  for (const item of matrix.supervised) {
    const actual = observations.get(item.id);
    assert(actual, `Missing supervised DOCX observation: ${item.id}`);
    assertReviewObservation(item, actual.observation);
    expect(actual.observation, item.id).toEqual(direct.get(item.id)!.observation);
  }
}, 45_000);

test("DOCX timeout settles its owned process before fixture removal", async () => {
  const events: string[] = [];
  const completion = product.probeTimeout().then((result) => {
    expect(existsSync(product.root)).toBe(true);
    events.push("settled");
    return result;
  });
  const cleanup = product.cleanup().then(() => events.push("removed"));
  const [result] = await Promise.all([completion, cleanup]);
  expect(result).toMatchObject({ ok: false, reason: "timeout", stopped: true, stdout: "ready\n" });
  expect(result.groupId).toBeGreaterThan(0);
  expect(result.signals.map((entry) => entry.signal)).toEqual(["SIGTERM"]);
  expect(events).toEqual(["settled", "removed"]);
  expect(existsSync(product.root)).toBe(false);
}, 15_000);
