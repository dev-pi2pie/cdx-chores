import { paragraph, REL_NS, run, style, stylesXml, WORD_NS } from "./docx-baseline/corpus/builder";
import type { ReviewCase } from "./docx-review-cases";

const relationshipNamespace = "http://schemas.openxmlformats.org/package/2006/relationships";
const hyperlink = `<Relationship Id="link" Type="${REL_NS}/hyperlink" Target="https://example.invalid/report"/>`;
const linkedText = `<w:hyperlink r:id="link">${run("Supporting details")}</w:hyperlink>`;
const customStyles = stylesXml(style("ReportTitle", "Heading 1"));

/** Root-level parts must resolve their own relationships without normalizing literal targets. */
export function createDocxRelationshipCases(): ReviewCase[] {
  const title = "Annual report";
  return [
    ...[
      { id: "root-style", main: "report.xml", styles: "report-styles.xml", link: false },
      { id: "root-link", main: "report.xml", styles: "report-styles.xml", link: true },
      { id: "ordinary", main: "word/document.xml", styles: "word/report-styles.xml", link: true },
      {
        id: "nested",
        main: "content/sections/report.xml",
        styles: "format/report-styles.xml",
        link: true,
      },
      {
        id: "literal-percent",
        main: "report%20title.xml",
        styles: "report-styles.xml",
        link: true,
      },
    ].map(({ id, main, styles, link }): ReviewCase => ({
      id: `review-relationship-main-${id}`,
      options: {
        documentPath: main,
        stylesPath: styles,
        styles: customStyles,
        body: paragraph(title, "ReportTitle") + (link ? `<w:p>${linkedText}</w:p>` : ""),
        relationships: link ? hyperlink : "",
      },
      rawText: `${title}\n\n${link ? "Supporting details\n\n" : ""}`,
      headings: [{ level: 1, text: title }],
    })),
    ...["footnote", "endnote", "comment"].flatMap((source) =>
      [false, true].map((missing): ReviewCase => {
        const part = `${source}s.xml`;
        const sourceTitle = "Source report";
        return {
          id: `review-relationship-root-${source}-${missing ? "missing" : "linked"}`,
          options: {
            body: paragraph("Main report").replace(
              "</w:p>",
              `<w:r><w:${source}Reference w:id="1"/></w:r></w:p>`,
            ),
            relationships: `<Relationship Id="source" Type="${REL_NS}/${source}s" Target="/${part}"/>`,
            extraParts: [
              [
                part,
                `<w:${source}s xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}"><w:${source} w:id="1">` +
                  paragraph(sourceTitle, "Heading1").replace(
                    run(sourceTitle),
                    `<w:hyperlink r:id="link">${run(sourceTitle)}</w:hyperlink>`,
                  ) +
                  `</w:${source}></w:${source}s>`,
              ],
              ...(!missing
                ? [
                    [
                      `_rels/${part}.rels`,
                      `<Relationships xmlns="${relationshipNamespace}">${hyperlink}</Relationships>`,
                    ] as [string, string],
                  ]
                : []),
              ...(source === "comment"
                ? [["mammoth/style-map", "comment-reference =>"] as [string, string]]
                : []),
            ],
          },
          ...(missing
            ? { diagnostic: "docx_initial_reader_error" }
            : {
                rawText: "Main report\n\n",
                headings: [{ level: 1, text: sourceTitle }],
                titleCandidates: [sourceTitle, "Main report"],
              }),
        };
      }),
    ),
    {
      id: "review-relationship-main-missing",
      options: {
        documentPath: "report.xml",
        body: `<w:p>${linkedText}</w:p>`,
        relationships: hyperlink,
        omit: ["_rels/report.xml.rels"],
      },
      diagnostic: "docx_initial_reader_error",
    },
    ...[
      { id: "missing", path: "report-styles.xml", target: "absent.xml", omit: true },
      { id: "dot-segment", path: "report-styles.xml", target: "./report-styles.xml", omit: false },
      {
        id: "escaped-space",
        path: "report styles.xml",
        target: "report%20styles.xml",
        omit: false,
      },
    ].map(({ id, path, target, omit }): ReviewCase => ({
      id: `review-relationship-root-style-${id}`,
      options: {
        documentPath: "report.xml",
        body: paragraph(title, "ReportTitle"),
        styles: customStyles,
        stylesPath: path,
        stylesTarget: target,
        omit: omit ? [path] : [],
      },
      rawText: `${title}\n\n`,
      headings: [],
      titleCandidates: [title],
    })),
  ];
}
