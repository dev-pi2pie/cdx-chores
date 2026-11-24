import { expect, test } from "bun:test";

import { scanMarkdownPdfFences } from "../../../../src/cli/markdown-pdf/profile/fence-signals";
import { collectMarkdownPdfDocumentSignals } from "../../../../src/cli/markdown-pdf/profile/signals";
import { offlineBoundaryCases, pipeBody } from "../fixtures/list-block-boundaries";
import { markdownSourceFixtures } from "../fixtures/markdown-source-fixtures";

test.each(markdownSourceFixtures)("$name preserves source signals", (fixture) => {
  const scan = scanMarkdownPdfFences(fixture.markdown);
  const signals = collectMarkdownPdfDocumentSignals(fixture.markdown);
  const headings = scan.ordinaryLines.flatMap((line) => /^# (.+)$/.exec(line)?.[1] ?? []);

  expect(headings).toEqual(fixture.headings);
  expect(signals.headings).toEqual({
    total: headings.length,
    maxDepth: 1,
    byDepth: { 1: headings.length },
  });
  expect(signals.title.firstH1).toEqual({ present: true, charCount: headings[0]!.length });
  expect(signals.codeFences).toEqual({
    languages: fixture.languages,
    unlabeledCount: 0,
    overflowLanguageCount: 0,
  });
  expect(signals.tables).toEqual({
    scannedRows: 3,
    maxColumns: 2,
    maxLineWidth: "| ---- | ----: |".length,
    overflowRows: 0,
  });
});

for (const fixture of offlineBoundaryCases) {
  const { name, markdown } = fixture;
  const scan = scanMarkdownPdfFences(markdown);
  const signals = collectMarkdownPdfDocumentSignals(markdown);
  const headings = scan.ordinaryLines.flatMap((line) => /^# (.+)$/.exec(line)?.[1] ?? []);

  test(name + " exposes the expected headings", () => {
    expect(headings).toEqual(fixture.headings);
    expect(signals.headings.total).toBe(fixture.headings.length);
  });

  test(name + " reports the expected languages", () => {
    expect(signals.codeFences.languages).toEqual(fixture.languages);
  });

  test(name + " counts visible source rows", () => {
    expect(signals.tables.scannedRows).toBe(fixture.rows);
  });

  const { pipeBodyRows } = fixture;
  if (pipeBodyRows !== undefined) {
    const plain = collectMarkdownPdfDocumentSignals(markdown.replace(pipeBody, "plain"));
    test(name + " isolates the pipe body's contribution", () => {
      expect(signals.tables.scannedRows - plain.tables.scannedRows).toBe(pipeBodyRows);
    });
  }
}

test("keeps exact wrapped-token offsets with CRLF and CR", () => {
  const source = markdownSourceFixtures.find(
    ({ name }) => name === "wrapped-and-quoted-tag",
  )!.markdown;
  const expected = scanMarkdownPdfFences(source);
  expect(scanMarkdownPdfFences(source.replaceAll("\n", "\r\n"))).toEqual(expected);
  expect(scanMarkdownPdfFences(source.replaceAll("\n", "\r"))).toEqual(expected);
});

test.each(["span", "p", "summary"])(
  "retains inline %s tags in source heading and table metrics",
  (tag) => {
    const title = `Heading <${tag}>inside</${tag}>`;
    const row = `| <${tag}>value</${tag}> | 1 |`;
    const signals = collectMarkdownPdfDocumentSignals(`# ${title}\n\n${row}\n| - | - |`);
    expect(signals.title.firstH1).toEqual({ present: true, charCount: title.length });
    expect(signals.tables).toEqual({
      scannedRows: 2,
      maxColumns: 2,
      maxLineWidth: row.length,
      overflowRows: 0,
    });
  },
);

test.each([
  ["::: box", ":::"],
  ["<div>", "</div>"],
])("an outdented %s close ends a list continuation", (open, close) => {
  const item = ["- Item", "", "  ~~~python", "  " + pipeBody, close, "~~~"].join("\n");
  expect(scanMarkdownPdfFences(open + "\n\n" + item).fenceLanguages).toEqual([]);
  expect(scanMarkdownPdfFences(item).fenceLanguages).toEqual(["python"]);
});

test("a flush-left backtick fence can leave a quote and span a blank line", () => {
  const source = ["> Quote.", "```python", "", pipeBody, "```"].join("\n");
  const signals = collectMarkdownPdfDocumentSignals(source);
  expect(signals.codeFences.languages).toEqual(["python"]);
  expect(signals.tables.scannedRows).toBe(0);
});

const ending = "~~~python\n# Fenced example\n| A longer example row hidden by the fence | B |\n~~~";
const visibleTable = "| Item | Count |\n| --- | --- |\n| Live | 1 |";

test.each([
  ...["h1", "h2", "h3", "h4", "h5", "h6", "ol", "dl", "address", "details", "footer", "th"].map(
    (tag) => [tag + " block", "<" + tag + ">Example</" + tag + ">", true] as const,
  ),
  ["closed list", "<ul><li>Example</li></ul>", true] as const,
  ["closing tag after prose", "Text before </h2>", true] as const,
  ["standalone tag after prose", "Text before <hr>", true] as const,
  ["wrapped opening tag", '<h2\n title="a > b">Example</h2>', true] as const,
  ["adjacent comment after a matched close", "<h2>Example</h2><!-- note\nends -->", true] as const,
  ["spaced comment after a bare close", "</h2> <!-- note\nends -->", true] as const,
  ["spaced comment after a matched close", "<h2>Example</h2> <!-- note\nends -->", false] as const,
  ["context-dependent block", "<video>\nText <video>inline</video>\n</video>", true] as const,
  ["context-dependent tag in prose", "Prose <video>Example</video>", false] as const,
  ["context-dependent tag on a continuing line", "Prose\n<video>Example</video>", false] as const,
  ["context-dependent standalone tag", "<embed>", true] as const,
  ["prose after a close", "<h2>Example</h2> and prose", false] as const,
  ["block close inside a code span", "Prose `lines\n</h2>`", false] as const,
  ["block close inside a quoted attribute", '<span title="</h2>">Example</span>', false] as const,
  ["inline HTML", "<span>Example</span>", false] as const,
  ["inline HTML with wrapped attributes", 'Text <span\n title="xx">', false] as const,
  ["unknown HTML element", "<example-tag>Example</example-tag>", false] as const,
  ["nav differs between Pandoc versions", "<nav>Example</nav>", false] as const,
  ["track differs between Pandoc versions", "<track>", false] as const,
  ["HTML document title", "<title>Report</title>", true] as const,
  ["bare ordinary opener", "<h2>", true] as const,
  ["inline content inside an ordinary block", "<h2><em>Example</em></h2>", true] as const,
  [
    "context-dependent block with adjacent comment",
    "<video>Example</video><!-- note\nends -->",
    true,
  ] as const,
  [
    "context-dependent block with spaced comment",
    "<video>Example</video> <!-- note\nends -->",
    false,
  ] as const,
  [
    "context-dependent element spanning a paragraph",
    "Text <video>\nExample\n</video>",
    false,
  ] as const,
  [
    "context-dependent block adjacent to a paired close",
    "<h2>Title</h2><video>Example</video>",
    true,
  ] as const,
  [
    "context-dependent tag spaced after a paired close",
    "<h2>Title</h2> <video>Example</video>",
    false,
  ] as const,
  [
    "context-dependent block after a standalone boundary",
    "Text <hr> <video>Example</video>",
    true,
  ] as const,
])("%s applies one boundary rule to the following fence", (_name, prefix, acceptsFence) => {
  const source = [prefix, ending, "", "# Visible heading", "", visibleTable].join("\n");
  const scan = scanMarkdownPdfFences(source);
  const signals = collectMarkdownPdfDocumentSignals(source);

  expect(scan.ordinaryLines.filter((line) => line.startsWith("# "))).toEqual(
    acceptsFence ? ["# Visible heading"] : ["# Fenced example", "# Visible heading"],
  );
  expect(signals.codeFences.languages).toEqual(acceptsFence ? ["python"] : []);
  expect(signals.headings.total).toBe(acceptsFence ? 1 : 2);
  expect(signals.tables.scannedRows).toBe(acceptsFence ? 3 : 4);
  expect(signals.tables.maxLineWidth).toBe(
    acceptsFence
      ? "| Item | Count |".length
      : "| A longer example row hidden by the fence | B |".length,
  );
});
