import { buildDocxPackage, paragraph, REL_NS, run } from "./builder.ts";
import type { DocxBaselineCase } from "./types.ts";

function complexField(instruction: string, displayed: string): string {
  return `<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">${instruction.replaceAll('"', "&quot;")}</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run(displayed)}<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
}

export function fieldCases(): DocxBaselineCase[] {
  return [
    {
      id: "link-visible-text",
      category: "links-and-fields",
      variations: ["visible-hyperlink-text"],
      input: {
        bytes: buildDocxPackage({
          body: `<w:p><w:hyperlink r:id="link">${run("Visible Partner Report")}</w:hyperlink></w:p>`,
          relationships: `<Relationship Id="link" Type="${REL_NS}/hyperlink" Target="https://example.invalid/reference" TargetMode="External"/>`,
        }),
      },
      expected: {
        rawEquals: "Visible Partner Report\n\n",
        rawExcludes: ["example.invalid"],
        htmlEquals: '<p><a href="https://example.invalid/reference">Visible Partner Report</a></p>',
        titleFirst: "Visible Partner Report",
      },
    },
    ...[
      {
        id: "field-hyperlink-quoted",
        variation: "quoted-hyperlink-field",
        instruction: ' HYPERLINK "https://example.invalid/quoted" ',
        href: "https://example.invalid/quoted",
        text: "Quoted Field Report",
      },
      {
        id: "field-hyperlink-unquoted",
        variation: "unquoted-hyperlink-field-historical-syntax",
        instruction: " HYPERLINK https://example.invalid/unquoted \\o Tooltip ",
        href: "https://example.invalid/unquoted",
        text: "Unquoted Field Report",
      },
      {
        id: "field-hyperlink-anchor",
        variation: "hyperlink-local-anchor-field",
        instruction: ' HYPERLINK \\l "report-section" ',
        href: "#report-section",
        text: "Anchor Field Report",
      },
    ].map(({ id, variation, instruction, href, text }): DocxBaselineCase => ({
      id,
      category: "links-and-fields",
      variations: [variation, "field-result-versus-instruction"],
      input: { bytes: buildDocxPackage({ body: complexField(instruction, text) }) },
      expected: {
        rawEquals: `${text}\n\n`,
        rawExcludes: ["HYPERLINK", "example.invalid", "report-section"],
        htmlEquals: `<p><a href="${href}">${text}</a></p>`,
      },
    })),
    {
      id: "field-simple-and-page-result",
      category: "links-and-fields",
      variations: ["simple-field-result-excluded", "non-hyperlink-complex-field-result"],
      input: {
        bytes: buildDocxPackage({
          body:
            `<w:p><w:fldSimple w:instr="AUTHOR">${run("Displayed Author")}</w:fldSimple></w:p>` +
            complexField(" PAGE ", "Page Display Result") +
            paragraph("Body After Fields"),
        }),
      },
      expected: {
        rawOrdered: ["Page Display Result", "Body After Fields"],
        rawExcludes: ["AUTHOR", "PAGE", "Displayed Author"],
        htmlIncludes: ["Page Display Result"],
        htmlExcludes: ["Displayed Author"],
      },
    },
  ];
}
