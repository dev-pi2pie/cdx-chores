import { describe, expect, test } from "bun:test";

import {
  chunkItems,
  normalizeTitle,
  parseFilenameTitleSuggestions,
} from "../../../src/adapters/codex/shared";

describe("Codex filename-title primitives", () => {
  test("normalizeTitle strips punctuation and collapses whitespace", () => {
    expect(normalizeTitle('  "Quarterly: Revenue & Growth!"  ')).toBe("Quarterly Revenue Growth");
  });

  test("chunkItems groups arrays by chunk size", () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkItems([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });

  test("parseFilenameTitleSuggestions normalizes titles and keeps latest duplicate filename", () => {
    const response = JSON.stringify({
      suggestions: [
        { filename: " report.pdf ", title: ' "Q4: Results!" ' },
        { filename: "image.png", title: "  " },
        { filename: "report.pdf", title: "Q4 Summary" },
        { filename: "", title: "ignored" },
      ],
    });

    const map = parseFilenameTitleSuggestions(response);
    expect([...map.entries()]).toEqual([["report.pdf", "Q4 Summary"]]);
  });
});
