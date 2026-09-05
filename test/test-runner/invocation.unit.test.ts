import { describe, expect, test } from "bun:test";

import { parseInvocation } from "../../scripts/testing/suites/invocation";

describe("managed invocation arguments", () => {
  test("selects each leaf or the ordered aggregate and snapshots retention", () => {
    for (const suite of ["unit", "app", "codex", "pandoc"] as const) {
      expect(parseInvocation([suite])).toEqual({ suites: [suite], keepResults: false });
      expect(parseInvocation([suite, "--keep-results"])).toEqual({
        suites: [suite],
        keepResults: true,
      });
    }
    expect(parseInvocation(["all"]).suites).toEqual(["unit", "app", "codex", "pandoc"]);
    expect(Object.isFrozen(parseInvocation(["all"]).suites)).toBe(true);
  });

  test.each([
    { args: [] },
    { args: ["unknown"] },
    { args: ["unit", "app"] },
    { args: ["all", "--retry"] },
    { args: ["unit", "--keep-results=false"] },
    { args: ["all", "--keep-results", "--keep-results"] },
    { args: ["unit", "--root", "/other"] },
  ])("rejects invalid invocation $args", ({ args }) => {
    expect(() => parseInvocation(args)).toThrow();
  });
});
