import assert from "node:assert/strict";

import { createBaselineCases } from "../docx-baseline/corpus/index";
import { createContractCases } from "../docx-baseline/corpus/contract/index";
import { createResourceCases } from "../docx-baseline/resource-cases";

const additionalIds = new Set([
  "heading-custom-id-standard-name",
  "heading-inherited",
  "heading-embedded-map",
  "text-table-content-control-order",
  "secondary-textbox-order",
  "empty-valid",
  "empty-image-only",
  "empty-table-only",
  "empty-line-break-only",
  "metadata-title-only",
  "metadata-author-only",
  "metadata-conversion-failure",
  "malformed-invalid-zip",
  "malformed-main-xml",
  "malformed-missing-main",
]);

/** Phase 3's trusted comparison slice, not the complete candidate support envelope. */
export function createInitialReaderCases() {
  const cases = createBaselineCases().filter(
    (item) => "fixture" in item.input || additionalIds.has(item.id),
  );
  assert.equal(cases.length, 22, "Initial reader case selection changed");
  assert.equal(cases.filter((item) => "fixture" in item.input).length, 7);
  return cases;
}

/** Full identified content corpus; resource envelope acceptance remains separate. */
export function createCompleteReaderCases() {
  const cases = [...createBaselineCases(), ...createContractCases()];
  assert.equal(cases.length, 103, "Complete reader case selection changed");
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  return cases;
}

/** Complete candidate validation includes the frozen structural corpus as well. */
export function createValidationReaderCases() {
  const cases = [...createCompleteReaderCases(), ...createResourceCases()];
  assert.equal(cases.length, 124, "Validation reader case selection changed");
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  return cases;
}
