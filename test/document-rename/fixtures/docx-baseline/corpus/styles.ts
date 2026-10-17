import { buildDocxPackage, paragraph, run, style, stylesXml } from "./builder.ts";
import type { DocxBaselineCase } from "./types.ts";

function headingCase(
  id: string,
  variations: string[],
  text: string,
  styleId: string,
  definitions: string,
  html: string,
  headings: string[],
): DocxBaselineCase {
  return {
    id,
    category: "heading-styles",
    variations,
    input: {
      bytes: buildDocxPackage({ body: paragraph(text, styleId), styles: stylesXml(definitions) }),
    },
    expected: { rawEquals: `${text}\n\n`, htmlEquals: html, headings },
  };
}

export function headingCases(): DocxBaselineCase[] {
  return [
    headingCase(
      "heading-standard-id",
      ["standard-heading-style", "default-style-map-by-id"],
      "Standard Heading Report",
      "Heading1",
      style("Heading1", "Heading 1"),
      "<h1>Standard Heading Report</h1>",
      ["Standard Heading Report"],
    ),
    headingCase(
      "heading-custom-id-standard-name",
      ["custom-style-id", "default-style-map-by-name"],
      "Named Heading Report",
      "ReportTop",
      style("ReportTop", "heading 2"),
      "<h2>Named Heading Report</h2>",
      ["Named Heading Report"],
    ),
    headingCase(
      "heading-apple-default-map",
      ["apple-heading-default-mapping"],
      "Apple Heading Report",
      "Heading",
      style("Heading", "Heading"),
      "<h1>Apple Heading Report</h1>",
      ["Apple Heading Report"],
    ),
    headingCase(
      "heading-localized-unmapped",
      ["localized-heading-name"],
      "Localized Heading Report",
      "Titre1",
      style("Titre1", "Titre 1"),
      "<p>Localized Heading Report</p>",
      [],
    ),
    headingCase(
      "heading-inherited",
      ["inherited-heading-style"],
      "Inherited Heading Report",
      "Derived",
      style("Heading1", "Heading 1") +
        style("Derived", "Derived Report", '<w:basedOn w:val="Heading1"/>'),
      "<p>Inherited Heading Report</p>",
      [],
    ),
    headingCase(
      "heading-cycle",
      ["cyclic-style-inheritance"],
      "Cyclic Style Report",
      "CycleA",
      style("CycleA", "Cycle A", '<w:basedOn w:val="CycleB"/>') +
        style("CycleB", "Cycle B", '<w:basedOn w:val="CycleA"/>'),
      "<p>Cyclic Style Report</p>",
      [],
    ),
    headingCase(
      "heading-outline-style",
      ["style-outline-level"],
      "Outline Style Report",
      "OutlineTop",
      style("OutlineTop", "Outline Top", '<w:pPr><w:outlineLvl w:val="0"/></w:pPr>'),
      "<p>Outline Style Report</p>",
      [],
    ),
    {
      id: "heading-outline-paragraph",
      category: "heading-styles",
      variations: ["paragraph-outline-level"],
      input: {
        bytes: buildDocxPackage({
          body: `<w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr>${run("Outline Paragraph Report")}</w:p>`,
        }),
      },
      expected: {
        htmlEquals: "<p>Outline Paragraph Report</p>",
        rawEquals: "Outline Paragraph Report\n\n",
        headings: [],
      },
    },
    {
      id: "heading-missing-definition",
      category: "heading-styles",
      variations: ["missing-style-definition"],
      input: {
        bytes: buildDocxPackage({ body: paragraph("Undefined Heading Report", "Heading1") }),
      },
      expected: {
        htmlEquals: "<h1>Undefined Heading Report</h1>",
        headings: ["Undefined Heading Report"],
      },
    },
    {
      id: "heading-default-style",
      category: "heading-styles",
      variations: ["default-paragraph-style"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Default Style Report"),
          styles: stylesXml(
            '<w:style w:type="paragraph" w:default="1" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style>',
          ),
        }),
      },
      expected: { htmlEquals: "<p>Default Style Report</p>", headings: [] },
    },
    {
      id: "heading-embedded-map",
      category: "heading-styles",
      variations: [
        "embedded-style-map",
        "embedded-localized-style-map",
        "embedded-map-overrides-default",
      ],
      input: {
        bytes: buildDocxPackage({
          body:
            paragraph("Mapped Localized Report", "Titre1") +
            paragraph("Mapped Standard Report", "Heading1"),
          styles: stylesXml(style("Titre1", "Titre 1") + style("Heading1", "Heading 1")),
          extraParts: [
            ["mammoth/style-map", "p[style-name='Titre 1'] => h3:fresh\np.Heading1 => h2:fresh"],
          ],
        }),
      },
      expected: {
        htmlEquals: "<h3>Mapped Localized Report</h3><h2>Mapped Standard Report</h2>",
        rawOrdered: ["Mapped Localized Report", "Mapped Standard Report"],
        headings: ["Mapped Localized Report", "Mapped Standard Report"],
        titleFirst: "Mapped Standard Report",
      },
    },
  ];
}
