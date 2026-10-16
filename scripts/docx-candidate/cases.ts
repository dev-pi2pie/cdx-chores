import assert from "node:assert/strict";

import { createBaselineCases } from "../docx-baseline/corpus/index";

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
