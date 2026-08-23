import { describe, expect, test } from "bun:test";

import { runInteractiveHarness } from "../../cli-interactive-routing.helpers";

describe("interactive Markdown DOCX routing", () => {
  test("preserves the existing markdown to-docx route after the module move", () => {
    const result = runInteractiveHarness({
      mode: "run",
      selectQueue: ["md", "md:to-docx"],
      requiredPathQueue: ["fixtures/doc.md"],
      optionalPathQueue: ["fixtures/doc.docx"],
      confirmQueue: [true],
    });

    expect(result.actionCalls).toEqual([
      {
        name: "md:to-docx",
        options: {
          input: "fixtures/doc.md",
          output: "fixtures/doc.docx",
          overwrite: true,
        },
      },
    ]);
  });
});
