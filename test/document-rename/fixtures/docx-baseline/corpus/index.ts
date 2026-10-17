import { boundaryCases } from "./boundaries.ts";
import { discoveryCases } from "./discovery.ts";
import { fieldCases } from "./fields.ts";
import { existingCases } from "./seeds.ts";
import { secondaryCases } from "./secondary.ts";
import { headingCases } from "./styles.ts";
import { textCases } from "./text.ts";
import type { DocxBaselineCase } from "./types.ts";

export type { DocxBaselineCase } from "./types.ts";

/** Semantic fixtures with historical Mammoth expectations and independent assertions. */
export function createBaselineCases(): DocxBaselineCase[] {
  return [
    ...existingCases(),
    ...discoveryCases(),
    ...textCases(),
    ...headingCases(),
    ...fieldCases(),
    ...secondaryCases(),
    ...boundaryCases(),
  ];
}
