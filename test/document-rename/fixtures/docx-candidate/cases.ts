import assert from "node:assert/strict";

import { createBaselineCases } from "../docx-baseline/corpus/index";
import { createContractCases } from "../docx-baseline/corpus/contract/index";
import { createResourceCases } from "../docx-baseline/resource-cases";
import { smokeCaseIds } from "./smoke-case-ids.mjs";

const initialIds = new Set(smokeCaseIds);

/** Fixed smoke corpus; broader content and resource checks are selected separately. */
export function createInitialReaderCases() {
  const cases = createBaselineCases().filter((item) => initialIds.has(item.id));
  assert.equal(cases.length, 22, "Initial reader case selection changed");
  assert.equal(cases.filter((item) => "fixture" in item.input).length, 7);
  return cases;
}

/** Semantic and symbol/style/note compatibility cases; resource checks are selected separately. */
export function createCompleteReaderCases() {
  const cases = [...createBaselineCases(), ...createContractCases()];
  assert.equal(cases.length, 103, "Complete reader case selection changed");
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  return cases;
}

/** Core validation corpus, including semantic, compatibility, and structural resource cases. */
export function createValidationReaderCases() {
  const cases = [...createCompleteReaderCases(), ...createResourceCases()];
  assert.equal(cases.length, 124, "Validation reader case selection changed");
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  return cases;
}
