import { expect, test } from "bun:test";

import { scanMarkdownPdfFences } from "../../../../src/cli/markdown-pdf/profile/fence-signals";
import { collectMarkdownPdfDocumentSignals as collect } from "../../../../src/cli/markdown-pdf/profile/signals";
import { listTransitionCases, pipeBody } from "../fixtures/list-block-boundaries";

test.each(listTransitionCases)(
  "$name keeps the trailing H1 and excludes only the fenced row",
  ({ markdown, rows }) => {
    const signals = collect(markdown);
    expect(signals.headings.total).toBe(1);
    expect(signals.codeFences.languages).toEqual(["python"]);
    expect(signals.tables.scannedRows).toBe(
      collect(markdown.replace(pipeBody, "plain")).tables.scannedRows,
    );
    expect(signals.tables.scannedRows).toBe(rows);
  },
);

const ticks = "```";
const table = "- Item\n\n  | Key | Value |\n  | --- | --- |\n  | In item | 1 |";
const longRow = "| a deliberately wide source cell | original width |";
test.each([
  ["tab stop after ordered marker", "12.\tItem\n", "\t", ticks, true],
  ["lettered marker", "a) Item\n", "    ", ticks, true],
  ["Roman marker", "(iv) Item\n", "     ", ticks, true],
  ["automatic marker", "#. Item\n", "    ", ticks, true],
  ["an initial in prose", "A. Item\n", "    ", ticks, false],
  ["wide marker padding leaves literal code", "-     <!-- literal", "    ", ticks, true],
  ["compact markers", "- - # Inner", "    ", "~~~", true],
  ["thematic rule", "- - -\n", "    ", ticks, false],
  ["document prose with a marker-like suffix", "Prose\n- Item\n", "    ", ticks, false],
  [
    "loose child keeps lazy prose",
    "- Parent\n  - Child\n\n    Second paragraph",
    "  ",
    "~~~",
    false,
  ],
  [
    "aligned backticks interrupt loose child prose",
    "- Parent\n  - Child\n\n    Second paragraph",
    "  ",
    ticks,
    true,
  ],
  [
    "sibling with a marker-line heading",
    "- First\n\n  Second paragraph\n- # Sibling",
    "  ",
    "~~~",
    true,
  ],
  ["heading-like continuation", "- Item\n  # prose", "  ", "~~~", false],
  ["dashes in multiline prose", "- Item\n  second line\n  ---", "  ", "~~~", false],
  ["Div boundary", "- Item\n\n  ::: note", "  ", "~~~", true],
  ["inline HTML continues prose", "- Item\n  <span>text</span>", "  ", "~~~", false],
  ["comment continues prose", "- Item\n  <!-- note -->", "  ", "~~~", false],
  ["matched list table", table, "  ", "~~~", true],
  ["pipe in math ends the table", table + "\n  $a | b$", "  ", "~~~", false],
  ["pipe in inline code ends the table", table + "\n  `a | b`", "  ", "~~~", false],
  ["bare verse line", "- |", "   ", "~~~", true],
] as const)("%s resolves the opener against its owner", (_name, prefix, margin, marker, fenced) => {
  const markdown = [
    prefix,
    margin + marker + "python",
    margin + longRow,
    margin + marker,
    "",
    "# Visible",
  ].join("\n");
  const signals = collect(markdown);
  expect(signals.codeFences.languages).toEqual(fenced ? ["python"] : []);
  expect(signals.headings.total).toBe(1);
  const plain = collect(markdown.replace(longRow, "plain"));
  expect(signals.tables.scannedRows - plain.tables.scannedRows).toBe(fenced ? 0 : 1);
  if (!fenced) expect(signals.tables.maxLineWidth).toBe(margin.length + longRow.length);
});

test.each(["~~~", ticks])("%s must close inside the opening item", (marker) => {
  const first = "- " + marker + "python\n  " + longRow;
  const last = "\n\n# Visible\n\n| Key | Value |";
  const inside = collect(first + "\n  " + marker + "\n- Second" + last);
  const sibling = collect(first + "\n- Second\n\n  " + marker + last);
  expect(inside.codeFences.languages).toEqual(["python"]);
  expect(sibling.codeFences.languages).toEqual([]);
  expect([inside.headings.total, sibling.headings.total]).toEqual([1, 1]);
  expect([inside.tables.scannedRows, sibling.tables.scannedRows]).toEqual([1, 2]);
});

test("only a sufficient empty closer ends a list fence; marker-like body text is literal", () => {
  const body = [
    "- ~~~~python",
    "  ~~~",
    "  " + ticks,
    "  ~~~~tail",
    "  - Inner",
    "  " + longRow,
    "  ~~~~~",
  ];
  expect(scanMarkdownPdfFences(body.join("\n"))).toEqual({
    fenceLanguages: ["python"],
    ordinaryLines: [],
  });
});

test("raw and unlabeled spans skip their bodies and preserve the width of a visible tabbed row", () => {
  const row = "\t" + longRow;
  const lines = [
    "- Item",
    "",
    "  ~~~{=html}",
    "  " + longRow,
    "  ~~~",
    "",
    "  ~~~",
    "  " + longRow,
    "  ~~~",
    "",
    row,
  ];
  const s = collect(lines.join("\r\n"));
  expect(s.codeFences).toEqual({ languages: [], unlabeledCount: 1, overflowLanguageCount: 0 });
  expect(s.tables).toEqual({
    scannedRows: 1,
    maxColumns: 2,
    maxLineWidth: row.length,
    overflowRows: 0,
  });
});

test.each(["- inline `start", "- Item\n   ```inline"])(
  "an inline backtick run after %j cannot consume a sibling opener",
  (first) => {
    const s = collect(
      [first, "- ```python", "  " + longRow, "  ```", "  `", "", "# Visible"].join("\n"),
    );
    expect(s.codeFences.languages).toEqual(["python"]);
    expect(s.tables.scannedRows).toBe(0);
    expect(s.headings.total).toBe(1);
  },
);

test.each(["<span>words</span>", "<!-- note -->", "# heading-like prose"])(
  "outdented %s can continue a loose paragraph inside the list",
  (continuation) => {
    const source = [
      "- Item",
      "",
      "  Paragraph",
      continuation,
      "",
      "    ~~~python",
      "    " + longRow,
      "    ~~~",
    ].join("\n");
    expect(collect(source).codeFences.languages).toEqual(["python"]);
  },
);

test.each([
  ["same item", "- <audio>\n  more", true],
  ["sibling item", "- <audio>\n- more", false],
])("a contextual HTML close in the %s uses that item's openings", (_name, prefix, matched) => {
  const source = [prefix, "  </audio>", "  ~~~python", "  " + longRow, "  ~~~"].join("\n");
  expect(collect(source).codeFences.languages).toEqual(matched ? ["python"] : []);
});

test("inline code keeps a lazy continuation in the same item", () => {
  const source =
    "- `words\nlazy continuation\n  <textarea>`\n\n  ~~~python\n  ok\n  ~~~\n\n</textarea>";
  expect(collect(source).codeFences.languages).toEqual(["python"]);
});

test("repeated unmatched openers leave a later sibling and heading visible", () => {
  const source =
    "- Item\n" + "\n  ~~~~missing\n".repeat(2048) + "- ~~~js\n  code\n  ~~~\n\n# Visible";
  const s = collect(source);
  expect(s.codeFences.languages).toEqual(["js"]);
  expect(s.headings.total).toBe(1);
});
