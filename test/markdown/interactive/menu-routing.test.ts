import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-interactive-routing.helpers";

describe("interactive Markdown menu routing", () => {
  test("shows the markdown pdf submenu entries before the existing markdown routes", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["md", "cancel"],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.selectChoicesByMessage["Choose a command"]).toContainEqual({
      name: "md",
      value: "md",
      description: "Markdown utilities",
    });
    expect(
      result.selectChoicesByMessage["Choose a markdown command"]?.map((choice) => choice.value),
    ).toEqual([
      "md:to-pdf",
      "md:pdf-recipes",
      "md:to-docx",
      "md:frontmatter-to-json",
      "back",
      "cancel",
    ]);
    expect(
      result.selectChoicesByMessage["Choose a markdown command"]?.map(
        (choice) => choice.description ?? "",
      ),
    ).toEqual([
      "Create a PDF",
      "Prepare reusable PDF recipes",
      "",
      "",
      "Return to the main command menu",
      "Exit interactive mode",
    ]);
  });

  test("returns from the markdown submenu to the root menu", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["md", "back", "cancel"],
    });

    expect(result.actionCalls).toEqual([]);
    expect(result.promptCalls.map((call) => `${call.kind}:${call.message}`)).toEqual([
      "select:Choose a command",
      "select:Choose a markdown command",
      "select:Choose a command",
    ]);
  });
});
