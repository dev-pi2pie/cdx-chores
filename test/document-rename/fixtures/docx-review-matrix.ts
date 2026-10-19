import assert from "node:assert/strict";

import { createDocxDrawingCases } from "./docx-drawing-cases";
import { createDocxFallbackCases } from "./docx-fallback-cases";
import { createDocxXmlCases } from "./docx-xml-cases";
import { createDocxFieldCases } from "./docx-field-cases";
import { createDocxHyperlinkFragmentCases } from "./docx-hyperlink-cases";
import { createDocxRelationshipCases } from "./docx-relationship-cases";
import {
  createDocxAmpersandCases,
  createDocxAmpersandClassificationCases,
} from "./docx-ampersand-cases";
import { createDocxReviewCases } from "./docx-review-cases";

const groupFactories = [
  ["review", createDocxReviewCases],
  ["drawing", createDocxDrawingCases],
  ["fallback", createDocxFallbackCases],
  ["xml", createDocxXmlCases],
  ["ampersand", createDocxAmpersandCases],
  ["ampersand-classification", createDocxAmpersandClassificationCases],
  ["field", createDocxFieldCases],
  ["hyperlink-fragment", createDocxHyperlinkFragmentCases],
  ["relationship", createDocxRelationshipCases],
] as const;

// Selected by runtime boundary; the plan records each ID's retained responsibility.
const supervisedIds = [
  "review-xml-roots-valid-prolog",
  "review-xml-roots-stylesheet-bom",
  "review-xml-roots-metadata-cannot-rescue",
  "review-xml-numeric-text",
  "review-xml-xml-escapes",
  "review-cdata-mixed",
  "review-strong-heading-boundaries",
  "review-strong-embedded-suppress",
  "review-vertical-merge-discarded-span-column",
  "review-shared-malformed-metadata-budget",
  "review-checkbox-only-empty",
  "review-vertical-merge-eager-failure",
  "review-drawing-inline-valid",
  "review-drawing-anchor-valid",
  "review-drawing-inline-missing-image-relation",
  "review-drawing-inline-absent-media",
  "review-drawing-external-image-omitted",
  "review-fallback-selected",
  "review-fallback-absent",
  "review-fallback-eager-image-failure",
  "review-xml-namespace-renamed",
  "review-xml-namespace-default",
  "review-xml-namespace-unbound-main-metadata",
  "review-xml-attribute-tab-double",
  "review-xml-attribute-decimal-tab-double",
  "review-ampersand-text-mixed",
  "review-ampersand-relationship",
  "review-ampersand-classification-mixed-double",
  "review-ampersand-classification-undeclared-am-relationship",
  "review-field-hyperlink-nested-checkbox",
  "review-field-unseparated-outer-nested-checkbox",
  "review-hyperlink-fragment-document-line-separator",
  "review-hyperlink-fragment-footnote-lf",
  "review-hyperlink-fragment-endnote-lf",
  "review-hyperlink-fragment-comment-lf",
  "review-relationship-main-root-style",
  "review-relationship-main-nested",
  "review-relationship-main-literal-percent",
  "review-relationship-root-footnote-missing",
  "review-relationship-root-style-missing",
] as const;

export function createDocxReviewMatrix() {
  const groups = groupFactories.map(([name, createCases]) => ({ name, cases: createCases() }));
  const cases = groups.flatMap((group) => group.cases);
  const byId = new Map(cases.map((item) => [item.id, item]));
  assert.equal(byId.size, cases.length, "DOCX review IDs must be globally unique");
  assert.equal(new Set(supervisedIds).size, supervisedIds.length, "Duplicate supervised ID");
  const supervised = supervisedIds.map((id) => {
    const item = byId.get(id);
    assert(item, `Missing supervised DOCX case: ${id}`);
    return item;
  });
  const selected = new Set<string>(supervisedIds);
  for (const group of groups) {
    assert(group.cases.length > 0, `Empty DOCX group: ${group.name}`);
    assert(
      group.cases.some((item) => selected.has(item.id)),
      `Unrepresented DOCX group: ${group.name}`,
    );
  }
  const diagnostics = (items: typeof cases) =>
    [...new Set(items.flatMap((item) => (item.diagnostic ? [item.diagnostic] : [])))].sort();
  assert.deepEqual(
    diagnostics(supervised),
    diagnostics(cases),
    "Missing supervised reader diagnostic",
  );
  return { groups, cases, supervised };
}
