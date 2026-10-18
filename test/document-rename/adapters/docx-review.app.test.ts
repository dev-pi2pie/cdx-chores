import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";

import { buildDocumentPrompt } from "../../../src/adapters/codex/document-rename/prompt";
import { createDocxProductFixture } from "../fixtures/docx-product/build";
import { createDocxDrawingCases } from "../fixtures/docx-drawing-cases";
import { createDocxFallbackCases } from "../fixtures/docx-fallback-cases";
import { createDocxXmlCases } from "../fixtures/docx-xml-cases";
import { createDocxFieldCases } from "../fixtures/docx-field-cases";
import { createDocxHyperlinkFragmentCases } from "../fixtures/docx-hyperlink-cases";
import { createDocxRelationshipCases } from "../fixtures/docx-relationship-cases";
import {
  createDocxAmpersandCases,
  createDocxAmpersandClassificationCases,
} from "../fixtures/docx-ampersand-cases";
import {
  createDocxReviewCases,
  expectedReviewEvidence,
  reviewCaseInput,
} from "../fixtures/docx-review-cases";

let product: Awaited<ReturnType<typeof createDocxProductFixture>>;
beforeAll(async () => {
  product = await createDocxProductFixture();
}, 45_000);
afterAll(async () => {
  await product?.cleanup();
}, 15_000);

test("compiled DOCX product preserves complete review-case evidence and prompts", async () => {
  for (const createCases of [
    createDocxReviewCases,
    createDocxDrawingCases,
    createDocxFallbackCases,
    createDocxXmlCases,
    createDocxAmpersandCases,
    createDocxAmpersandClassificationCases,
    createDocxFieldCases,
    createDocxHyperlinkFragmentCases,
    createDocxRelationshipCases,
  ]) {
    const cases = createCases();
    const observations = await product.observeCases(cases.map(reviewCaseInput));
    for (const item of cases) {
      const { observation } = observations.get(item.id)!;
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
  }
}, 30_000);

test("compiled direct DOCX observation agrees with the supervised reader", async () => {
  const cases = [reviewCaseInput(createDocxReviewCases()[0]!)];
  const direct = await product.observeCases(cases, { mode: "direct" });
  const supervised = await product.observeCases(cases);
  expect(direct.get(cases[0]!.id)?.observation).toEqual(supervised.get(cases[0]!.id)?.observation);
}, 70_000);

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
