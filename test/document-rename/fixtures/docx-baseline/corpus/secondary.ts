import { buildDocxPackage, paragraph, REL_NS, run, style, stylesXml, WORD_NS } from "./builder.ts";
import type { DocxBaselineCase } from "./types.ts";

export function secondaryCases(): DocxBaselineCase[] {
  return [
    {
      id: "secondary-revisions-hidden",
      category: "revisions-and-secondary-content",
      variations: ["inserted-runs", "deleted-runs", "hidden-runs"],
      input: {
        bytes: buildDocxPackage({
          body: `<w:p>${run("Revision Report ")}<w:ins>${run("Inserted Text ")}</w:ins><w:del><w:r><w:delText>Deleted Text </w:delText></w:r></w:del><w:r><w:rPr><w:vanish/></w:rPr><w:t>Hidden Text</w:t></w:r></w:p>`,
        }),
      },
      expected: {
        rawEquals: "Revision Report Inserted Text Hidden Text\n\n",
        htmlIncludes: ["Inserted Text", "Hidden Text"],
        rawExcludes: ["Deleted Text"],
        htmlExcludes: ["Deleted Text"],
      },
    },
    {
      id: "secondary-textbox-order",
      category: "revisions-and-secondary-content",
      variations: ["vml-textbox", "textbox-headings", "textbox-body-order"],
      input: {
        bytes: buildDocxPackage({
          body:
            `<w:p>${run("Before Textbox")}<w:r><w:pict><v:shape><v:textbox><w:txbxContent>${paragraph("Textbox Heading Report", "Heading1")}${paragraph("Textbox Body")}</w:txbxContent></v:textbox></v:shape></w:pict></w:r>${run(" After Textbox")}</w:p>` +
            paragraph("Following Paragraph"),
          styles: stylesXml(style("Heading1", "Heading 1")),
        }),
      },
      expected: {
        rawOrdered: [
          "Before Textbox",
          "After Textbox",
          "Textbox Heading Report",
          "Textbox Body",
          "Following Paragraph",
        ],
        htmlIncludes: ["<h1>Textbox Heading Report</h1>"],
        headings: ["Textbox Heading Report"],
        titleFirst: "Textbox Heading Report",
      },
    },
    {
      id: "secondary-header-footer",
      category: "revisions-and-secondary-content",
      variations: ["referenced-header", "referenced-footer"],
      input: {
        bytes: buildDocxPackage({
          body:
            paragraph("Main Body Report") +
            '<w:sectPr><w:headerReference w:type="default" r:id="header"/><w:footerReference w:type="default" r:id="footer"/></w:sectPr>',
          relationships: `<Relationship Id="header" Type="${REL_NS}/header" Target="header.xml"/><Relationship Id="footer" Type="${REL_NS}/footer" Target="footer.xml"/>`,
          extraParts: [
            [
              "word/header.xml",
              `<w:hdr xmlns:w="${WORD_NS}">${paragraph("Header Excluded Text", "Heading1")}</w:hdr>`,
            ],
            [
              "word/footer.xml",
              `<w:ftr xmlns:w="${WORD_NS}">${paragraph("Footer Excluded Text")}</w:ftr>`,
            ],
          ],
        }),
      },
      expected: {
        rawEquals: "Main Body Report\n\n",
        htmlEquals: "<p>Main Body Report</p>",
        rawExcludes: ["Header Excluded Text", "Footer Excluded Text"],
        htmlExcludes: ["Header Excluded Text", "Footer Excluded Text"],
      },
    },
    ...["footnote", "endnote"].map((kind): DocxBaselineCase => ({
      id: `secondary-${kind}`,
      category: "revisions-and-secondary-content",
      variations: [`referenced-${kind}`, `${kind}-html-raw-difference`, `${kind}-heading`],
      input: {
        bytes: buildDocxPackage({
          body:
            `<w:p>${run("Before Note")}<w:r><w:${kind}Reference w:id="1"/></w:r>${run(" After Note")}</w:p>` +
            paragraph("Following Body"),
          styles: stylesXml(style("Heading1", "Heading 1")),
          extraParts: [
            [
              `word/${kind}s.xml`,
              `<w:${kind}s xmlns:w="${WORD_NS}"><w:${kind} w:id="1">${paragraph(`${kind} Heading Report`, "Heading1")}${paragraph(`${kind} Detail`)}</w:${kind}></w:${kind}s>`,
            ],
          ],
        }),
      },
      expected: {
        rawEquals: "Before Note After Note\n\nFollowing Body\n\n",
        rawExcludes: [`${kind} Heading Report`, `${kind} Detail`],
        htmlIncludes: [`<h1>${kind} Heading Report</h1>`, `${kind} Detail`],
        headings: [`${kind} Heading Report`],
        titleFirst: `${kind} Heading Report`,
      },
    })),
    {
      id: "secondary-comment",
      category: "revisions-and-secondary-content",
      variations: ["referenced-comment", "comment-body-excluded-by-default"],
      input: {
        bytes: buildDocxPackage({
          body: `<w:p>${run("Before Comment")}<w:r><w:commentReference w:id="1"/></w:r>${run(" After Comment")}</w:p>`,
          extraParts: [
            [
              "word/comments.xml",
              `<w:comments xmlns:w="${WORD_NS}"><w:comment w:id="1" w:author="Comment Author">${paragraph("Comment Excluded Heading", "Heading1")}</w:comment></w:comments>`,
            ],
          ],
        }),
      },
      expected: {
        rawEquals: "Before Comment After Comment\n\n",
        htmlEquals: "<p>Before Comment After Comment</p>",
        rawExcludes: ["Comment Excluded Heading"],
        htmlExcludes: ["Comment Excluded Heading"],
        headings: [],
      },
    },
  ];
}
