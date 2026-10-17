import { expect, test } from "bun:test";

import { buildDocumentPrompt } from "../../../src/adapters/codex/document-rename/prompt";
import { createDocxProductFixture } from "../fixtures/docx-product/build";
import { createDocxDrawingCases } from "../fixtures/docx-drawing-cases";
import { createDocxFallbackCases } from "../fixtures/docx-fallback-cases";
import { createDocxXmlCases } from "../fixtures/docx-xml-cases";
import { createDocxFieldCases } from "../fixtures/docx-field-cases";
import { createDocxHyperlinkFragmentCases } from "../fixtures/docx-hyperlink-cases";
import {
  createDocxAmpersandCases,
  createDocxAmpersandClassificationCases,
} from "../fixtures/docx-ampersand-cases";
import {
  createDocxReviewCases,
  expectedReviewEvidence,
  reviewCaseInput,
} from "../fixtures/docx-review-cases";

test("compiled DOCX product preserves complete review-case evidence and prompts", async () => {
  const product = await createDocxProductFixture();
  try {
    for (const createCases of [
      createDocxReviewCases,
      createDocxDrawingCases,
      createDocxFallbackCases,
      createDocxXmlCases,
      createDocxAmpersandCases,
      createDocxAmpersandClassificationCases,
      createDocxFieldCases,
      createDocxHyperlinkFragmentCases,
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
  } finally {
    await product.cleanup();
  }
}, 30_000);
