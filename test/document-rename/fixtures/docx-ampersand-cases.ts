import { documentXml, paragraph, run, stylesXml } from "./docx-baseline/corpus/builder";
import type { ReviewCase } from "./docx-review-cases";

/** Literal ampersands and reference controls with independently authored outcomes. */
export function createDocxAmpersandCases(): ReviewCase[] {
  const text = [
    { id: "spaced", xml: "Research & Development", value: "Research & Development" },
    { id: "joined", xml: "AT&T Report", value: "AT&T Report" },
    { id: "repeated", xml: "Research && Development", value: "Research && Development" },
    { id: "trailing", xml: "Research Report &", value: "Research Report &" },
    { id: "incomplete-name", xml: "Research &copy Report", value: "Research &copy Report" },
    { id: "empty-reference", xml: "Research &; Report", value: "Research &; Report" },
    { id: "named", xml: "Research &amp; Development", value: "Research & Development" },
    { id: "decimal", xml: "Research &#38; Development", value: "Research & Development" },
    { id: "hex", xml: "Research &#x26; Development", value: "Research & Development" },
    { id: "escaped-reference", xml: "Research &amp;#38; Report", value: "Research &#38; Report" },
    { id: "mixed", xml: "Research &amp; Development & QA", value: "Research & Development & QA" },
  ];
  return [
    ...text.map(({ id, xml, value }): ReviewCase => ({
      id: `review-ampersand-text-${id}`,
      options: {
        body: `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${xml}</w:t></w:r></w:p>`,
      },
      rawText: `${value}\n\n`,
      headings: [{ level: 1, text: value }],
    })),
    ...text.slice(0, 10).flatMap(({ id, xml, value }): ReviewCase[] =>
      ['"', "'"].map((quote) => ({
        id: `review-ampersand-attribute-${id}-${quote === '"' ? "double" : "single"}`,
        options: {
          documentXml: documentXml(paragraph("Attribute Report", value)).replace(
            /w:val="[^"]*"/,
            `w:val=${quote}${xml}${quote}`,
          ),
          styles: stylesXml(
            `<w:style w:type="paragraph" w:styleId=${quote}${xml}${quote}><w:name w:val="Heading 1"/></w:style>`,
          ),
        },
        rawText: "Attribute Report\n\n",
        headings: [{ level: 1, text: "Attribute Report" }],
      })),
    ),
    {
      id: "review-ampersand-trailing-root",
      options: { documentXml: documentXml(paragraph("Boundary Report", "Heading1")) + "&" },
      rawText: "Boundary Report\n\n",
      headings: [{ level: 1, text: "Boundary Report" }],
    },
    {
      id: "review-ampersand-relationship",
      options: {
        body: `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:hyperlink r:id="R&D">${run("Linked Report")}</w:hyperlink></w:p>`,
        relationships:
          '<Relationship Id="R&D" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/?a=1&b=2"/>',
      },
      rawText: "Linked Report\n\n",
      headings: [{ level: 1, text: "Linked Report" }],
    },
    ...["copy", "unknown"].map((name): ReviewCase => ({
      id: `review-ampersand-undeclared-${name}`,
      options: { body: `<w:p><w:r><w:t>Research & ${name} &${name};</w:t></w:r></w:p>` },
      diagnostic: "docx_xml_invalid",
    })),
  ];
}

/** Physical selected-part size is unchanged by temporary source escaping. */
export function ampersandHeavyDocument(partBytes: number): { xml: string; rawText: string } {
  const empty = documentXml("<w:p><w:r><w:t></w:t></w:r></w:p>");
  const text = "&".repeat(partBytes - Buffer.byteLength(empty));
  return {
    xml: documentXml(`<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`),
    rawText: `${text}\n\n`,
  };
}
