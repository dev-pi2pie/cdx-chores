import {
  coreXml,
  documentXml,
  paragraph,
  REL_NS,
  run,
  stylesXml,
  WORD_NS,
} from "./docx-baseline/corpus/builder";
import type { ReviewCase } from "./docx-review-cases";

const report = "Namespace Review Report";
const reportBody = paragraph(report, "Heading1");
const document = documentXml(reportBody);
const wordBinding = / xmlns:w="[^"]*"/;
const renamed = document.replaceAll("w:", "x:").replace("xmlns:w=", "xmlns:x=");
const heading = (contents: string) =>
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${contents}</w:p>`;

/** Namespace and CDATA outcomes authored independently of the replacement reader. */
export function createDocxXmlCases(): ReviewCase[] {
  const content = { rawText: report + "\n\n", headings: [{ level: 1, text: report }] };
  const plain = { rawText: report + "\n\n", headings: [], titleCandidates: [report] };
  return [
    ...[false, true].map((metadata): ReviewCase => ({
      id: `review-xml-namespace-unbound-main${metadata ? "-metadata" : ""}`,
      options: {
        documentXml: document.replace(wordBinding, ""),
        core: metadata ? coreXml("Usable metadata title") : undefined,
      },
      diagnostic: "docx_main_document_unavailable",
    })),
    {
      id: "review-xml-namespace-renamed",
      options: { documentXml: renamed },
      ...content,
    },
    {
      id: "review-xml-namespace-default",
      options: {
        documentXml: document
          .replace(/(<\/?)w:/g, "$1")
          .replace("<document", `<document xmlns="${WORD_NS}"`),
      },
      ...content,
    },
    ...["", "urn:unrelated"].map((uri): ReviewCase => ({
      id: `review-xml-namespace-${uri ? "foreign" : "unbound"}-subtree`,
      options: {
        documentXml: documentXml(paragraph("Hidden report", "Heading1") + reportBody).replace(
          "<w:p>",
          `<w:p xmlns:w="${uri}">`,
        ),
      },
      ...content,
    })),
    {
      id: "review-xml-namespace-unbound-attribute",
      options: { documentXml: renamed.replace('x:val="Heading1"', 'w:val="Heading1"') },
      ...plain,
    },
    {
      id: "review-xml-namespace-unprefixed-attribute",
      options: { documentXml: document.replace('w:val="Heading1"', 'val="Heading1"') },
      ...plain,
    },
    {
      id: "review-xml-namespace-unbound-styles",
      options: {
        body: paragraph(report, "Custom"),
        styles: stylesXml(
          '<w:style w:type="paragraph" w:styleId="Custom"><w:name w:val="Heading 1"/></w:style>',
        ).replace(wordBinding, ""),
      },
      ...plain,
    },
    {
      id: "review-xml-namespace-renamed-styles",
      options: {
        body: paragraph(report, "Custom"),
        styles: stylesXml(
          '<w:style w:type="paragraph" w:styleId="Custom"><w:name w:val="Heading 1"/></w:style>',
        )
          .replaceAll("w:", "x:")
          .replace("xmlns:w=", "xmlns:x="),
      },
      ...content,
    },
    {
      id: "review-xml-namespace-unbound-link-attribute",
      options: {
        documentXml: documentXml(
          heading(run("Annual") + '<w:hyperlink r:id="link">' + run("Report") + "</w:hyperlink>"),
        ).replace(/ xmlns:r="[^"]*"/, ""),
        relationships: `<Relationship Id="link" Type="${REL_NS}/hyperlink" Target="https://example.invalid/report"/>`,
      },
      rawText: "AnnualReport\n\n",
      headings: [{ level: 1, text: "AnnualReport" }],
    },
    ...[
      { id: "text", suffix: "<![CDATA[extra]]>" },
      { id: "whitespace", suffix: "<![CDATA[ ]]>" },
      { id: "after-prolog-records", suffix: "<?after data?><!-- ignored --><![CDATA[extra]]>" },
    ].map(({ id, suffix }): ReviewCase => ({
      id: `review-xml-cdata-trailing-${id}`,
      options: { documentXml: document + suffix },
      diagnostic: "docx_xml_invalid",
    })),
    {
      id: "review-xml-cdata-trailing-empty",
      options: { documentXml: document + "<![CDATA[]]>" },
      ...content,
    },
    {
      id: "review-xml-cdata-leading",
      options: { documentXml: document.replace("?><w:document", "?><![CDATA[extra]]><w:document") },
      ...content,
    },
    {
      id: "review-xml-cdata-comment-control",
      options: { documentXml: document + "<!-- <![CDATA[extra]]> --><?after data?>" },
      ...content,
    },
    {
      id: "review-xml-cdata-styles",
      options: { body: reportBody, styles: stylesXml("") + "<![CDATA[extra]]>" },
      diagnostic: "docx_xml_invalid",
    },
    {
      id: "review-xml-cdata-relationships",
      options: {
        body: reportBody,
        replaceParts: [
          [
            "word/_rels/document.xml.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/><![CDATA[extra]]>',
          ],
        ],
      },
      diagnostic: "docx_xml_invalid",
    },
    {
      id: "review-xml-cdata-unused-notes",
      options: {
        body: reportBody,
        extraParts: [
          ["word/footnotes.xml", `<w:footnotes xmlns:w="${WORD_NS}"/><![CDATA[extra]]>`],
        ],
      },
      diagnostic: "docx_xml_invalid",
    },
    {
      id: "review-xml-cdata-metadata-cannot-rescue",
      options: {
        documentXml: document + "<![CDATA[extra]]>",
        core: coreXml("Usable metadata title"),
      },
      diagnostic: "docx_xml_invalid",
    },
  ];
}
