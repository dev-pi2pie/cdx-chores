import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-interactive-routing.helpers";

describe("CLI root interactive routing", () => {
  test("throws when a handler receives an unknown action", () => {
    const result = runInteractiveHarness({ mode: "invalid-data-action" }, { allowFailure: true });

    expect(result.error).toBe("Unhandled interactive action: data:unknown");
  });
});
