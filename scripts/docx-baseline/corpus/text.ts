import { buildDocxPackage, paragraph, run, WORD_NS } from "./builder.ts";
import type { DocxBaselineCase } from "./types.ts";

export function textCases(): DocxBaselineCase[] {
  const numbering = `<w:numbering xmlns:w="${WORD_NS}"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  const listParagraph = (text: string) =>
    `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${run(text)}</w:p>`;
  return [
    {
      id: "text-split-unicode-spaces",
      category: "text-and-order",
      variations: ["split-runs", "unicode-text", "preserved-spaces"],
      input: {
        bytes: buildDocxPackage({
          body:
            `<w:p>${run("Split ")}${run("Run Report")}</w:p>` +
            paragraph("  臺灣 café é 😀\u00a0Report  "),
        }),
      },
      expected: {
        rawEquals: "Split Run Report\n\n  臺灣 café é 😀\u00a0Report  \n\n",
        htmlIncludes: ["Split Run Report", "  臺灣 café é 😀\u00a0Report  "],
        titleFirst: "Split Run Report",
      },
    },
    {
      id: "text-symbol-tabs-breaks",
      category: "text-and-order",
      variations: ["symbol-characters", "tabs", "line-break", "page-break"],
      input: {
        bytes: buildDocxPackage({
          body: `<w:p>${run("Symbol ")}<w:r><w:sym w:font="Wingdings" w:char="F0FC"/><w:tab/><w:t>Tab</w:t><w:br/><w:t>Line</w:t><w:br w:type="page"/><w:t>Page</w:t></w:r></w:p>`,
        }),
      },
      expected: { rawEquals: "Symbol ✓\tTabLinePage\n\n", htmlIncludes: ["✓\tTab<br />LinePage"] },
    },
    {
      id: "text-blank-paragraphs",
      category: "text-and-order",
      variations: ["blank-lines"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Before Blank") + "<w:p/>" + paragraph("After Blank"),
        }),
      },
      expected: {
        rawEquals: "Before Blank\n\n\n\nAfter Blank\n\n",
        htmlEquals: "<p>Before Blank</p><p>After Blank</p>",
      },
    },
    {
      id: "text-list-order",
      category: "text-and-order",
      variations: ["list-items", "list-body-order"],
      input: {
        bytes: buildDocxPackage({
          body:
            paragraph("Before List") +
            listParagraph("First Item") +
            listParagraph("Second Item") +
            paragraph("After List"),
          extraParts: [["word/numbering.xml", numbering]],
        }),
      },
      expected: {
        rawOrdered: ["Before List", "First Item", "Second Item", "After List"],
        htmlIncludes: ["<ul><li>First Item</li><li>Second Item</li></ul>"],
      },
    },
    {
      id: "text-table-content-control-order",
      category: "text-and-order",
      variations: [
        "paragraph-before-table",
        "paragraph-inside-table",
        "paragraph-after-table",
        "content-control-order",
      ],
      input: {
        bytes: buildDocxPackage({
          body:
            paragraph("Before Table") +
            `<w:tbl><w:tr><w:tc>${paragraph("Cell One")}</w:tc><w:tc><w:sdt><w:sdtContent>${paragraph("Controlled Cell")}</w:sdtContent></w:sdt></w:tc></w:tr></w:tbl>` +
            paragraph("After Table") +
            `<w:sdt><w:sdtContent>${paragraph("Controlled Body")}</w:sdtContent></w:sdt>` +
            paragraph("After Control"),
        }),
      },
      expected: {
        rawOrdered: [
          "Before Table",
          "Cell One",
          "Controlled Cell",
          "After Table",
          "Controlled Body",
          "After Control",
        ],
        htmlIncludes: [
          "<table><tr><td><p>Cell One</p></td><td><p>Controlled Cell</p></td></tr></table>",
        ],
        rawExcludes: ["w:sdt"],
      },
    },
  ];
}
