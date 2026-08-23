import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-interactive-routing.helpers";

describe("interactive data menu routing", () => {
  test("shows the broadened data menu copy and includes data stack plus query and extract", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["data", "cancel"],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.stackPlanWrites).toHaveLength(0);
    expect(result.selectChoicesByMessage["Choose a command"]).toContainEqual({
      name: "data",
      value: "data",
      description: "Preview and convert tabular data",
    });
    expect(
      result.selectChoicesByMessage["Choose a data command"]?.map((choice) => choice.value),
    ).toEqual([
      "data:preview",
      "data:extract",
      "data:stack",
      "data:query",
      "data:parquet-preview",
      "data:convert",
      "back",
      "cancel",
    ]);
  });
});
