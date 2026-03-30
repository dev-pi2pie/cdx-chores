import { describe, expect, test } from "bun:test";

import {
  getInteractiveContextualTip,
  type InteractiveContextualTipId,
} from "../src/cli/interactive/contextual-tip";

const EXPECTED_TIPS: Record<InteractiveContextualTipId, string> = {
  "data-query:mode-selection": "Manual is best for joins or custom SQL.",
  "data-query:sql-review": "SQL limit and preview rows are separate controls.",
  "data-query:output-selection": "Rows to show only affects terminal preview.",
  "data-extract:review": "Source interpretation is reviewed before output setup.",
  "data-extract:write-boundary": "Change destination keeps the current extraction setup.",
};

describe("interactive contextual tip resolver", () => {
  for (const [tipId, expectedText] of Object.entries(EXPECTED_TIPS)) {
    test(`returns the expected text for ${tipId}`, () => {
      expect(getInteractiveContextualTip(tipId as InteractiveContextualTipId)).toBe(expectedText);
    });
  }
});
