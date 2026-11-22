import { expect, test } from "bun:test";

import { scanMarkdownPdfFences } from "../../../../src/cli/markdown-pdf/profile/fence-signals";
import { collectMarkdownPdfDocumentSignals } from "../../../../src/cli/markdown-pdf/profile/signals";
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
