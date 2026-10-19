import { buildDocxPackage, paragraph, run, style, stylesXml } from "../builder.ts";
import type { DocxBaselineCase } from "../types.ts";

function mapCase(
  id: string,
  variations: string[],
  map: string,
  expected: DocxBaselineCase["expected"],
  body = paragraph("First Mapping Report", "Heading1") +
    paragraph("Second Mapping Report", "Heading1"),
): DocxBaselineCase {
  return {
    id: `contract-map-${id}`,
    category: "contract-style-maps",
    variations,
    input: {
      bytes: buildDocxPackage({
        body,
        styles: stylesXml(style("Heading1", "Heading 1")),
        extraParts: [["mammoth/style-map", map]],
      }),
    },
    expected,
  };
}

export function contractStyleMapCases(): DocxBaselineCase[] {
  return [
    mapCase(
      "paragraph-prefix",
      ["style-name-prefix-selector", "case-insensitive-style-name-selector", "fresh-headings"],
      "p[style-name^='heading'] => h3:fresh",
      {
        rawEquals: "First Mapping Report\n\nSecond Mapping Report\n\n",
        htmlEquals: "<h3>First Mapping Report</h3><h3>Second Mapping Report</h3>",
        headings: ["First Mapping Report", "Second Mapping Report"],
      },
    ),
    mapCase(
      "invalid-ignored",
      ["invalid-rule-warning", "default-heading-map-remains"],
      "this is not a valid mapping",
      {
        htmlEquals: "<h1>First Mapping Report</h1><h1>Second Mapping Report</h1>",
        headings: ["First Mapping Report", "Second Mapping Report"],
        htmlMessagesInclude: ["Did not understand this style mapping"],
      },
    ),
    mapCase(
      "run-heading",
      ["run-selector", "run-rule-creates-evidence-heading"],
      "r => h1:fresh",
      {
        rawEquals: "Run Mapping Report\n\n",
        htmlEquals: "<p><h1>Run Mapping Report</h1></p>",
        headings: ["Run Mapping Report"],
        titleFirst: "Run Mapping Report",
      },
      `<w:p>${run("Run Mapping Report")}</w:p>`,
    ),
    mapCase(
      "nested-heading",
      ["nested-html-path", "nested-rule-creates-evidence-heading"],
      "p.Heading1 => div > h2:fresh",
      {
        htmlEquals: "<div><h2>First Mapping Report</h2><h2>Second Mapping Report</h2></div>",
        headings: ["First Mapping Report", "Second Mapping Report"],
      },
    ),
    mapCase("ignore", ["ignore-rule", "html-omitted-raw-preserved"], "p.Heading1 => !", {
      rawEquals: "First Mapping Report\n\nSecond Mapping Report\n\n",
      htmlEquals: "",
      headings: [],
      titleFirst: "First Mapping Report",
    }),
    mapCase("merge", ["non-fresh-heading-merge", "no-inserted-space"], "p.Heading1 => h1", {
      htmlEquals: "<h1>First Mapping ReportSecond Mapping Report</h1>",
      headings: ["First Mapping ReportSecond Mapping Report"],
      titleFirst: "First Mapping ReportSecond Mapping Report",
    }),
    mapCase(
      "separator",
      ["heading-merge-separator", "separator-affects-title-evidence"],
      "p.Heading1 => h1:separator(' / ')",
      {
        htmlEquals: "<h1>First Mapping Report / Second Mapping Report</h1>",
        headings: ["First Mapping Report / Second Mapping Report"],
        titleFirst: "First Mapping Report / Second Mapping Report",
      },
    ),
    mapCase(
      "table-heading",
      ["table-selector", "table-rule-creates-evidence-heading"],
      "table => h2:fresh",
      {
        rawEquals: "Table Mapping Report\n\n",
        htmlEquals: "<h2><tr><td><p>Table Mapping Report</p></td></tr></h2>",
        headings: ["Table Mapping Report"],
      },
      `<w:tbl><w:tr><w:tc>${paragraph("Table Mapping Report")}</w:tc></w:tr></w:tbl>`,
    ),
    mapCase(
      "first-matching-rule",
      ["overlapping-style-selectors", "first-matching-rule-wins", "embedded-rule-precedence"],
      "p[style-name^='heading'] => h3:fresh\np.Heading1 => h2:fresh\np[style-name='Heading 1'] => h1:fresh",
      {
        rawEquals: "First Mapping Report\n\nSecond Mapping Report\n\n",
        htmlEquals: "<h3>First Mapping Report</h3><h3>Second Mapping Report</h3>",
        headings: ["First Mapping Report", "Second Mapping Report"],
        titleCandidates: ["First Mapping Report"],
      },
    ),
  ];
}
