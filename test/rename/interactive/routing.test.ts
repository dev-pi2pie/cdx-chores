import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-interactive-routing.helpers";

describe("interactive Rename routing", () => {
  test("routes a rename flow through apply", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["rename", "rename:apply"],
      requiredPathQueue: ["plans/rename.csv"],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "rename:apply",
        options: {
          csv: "plans/rename.csv",
          autoClean: true,
        },
      },
    ]);
  });
});
