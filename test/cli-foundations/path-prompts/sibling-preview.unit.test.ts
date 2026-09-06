import { describe, expect, test } from "bun:test";

import { deriveSiblingPreviewScopeKey } from "../../../src/cli/prompts/path-sibling-preview";

describe("path sibling preview candidates", () => {
  test("scope keys are stable for the same segment scope and differ when the fragment changes", () => {
    const baseOptions = {
      cwd: "/tmp/example",
      includeHidden: false,
      maxSuggestions: 12,
      targetKind: "any" as const,
    };

    const first = deriveSiblingPreviewScopeKey({
      ...baseOptions,
      input: "./docs/re",
    });
    const second = deriveSiblingPreviewScopeKey({
      ...baseOptions,
      input: "./docs/re",
    });
    const third = deriveSiblingPreviewScopeKey({
      ...baseOptions,
      input: "./docs/gu",
    });

    expect(first).toBe(second);
    expect(first).not.toBe(third);
  });
});
