import {
  buildDocxPackage,
  coreXml,
  encodeUtf16LeXml,
  paragraph,
  run,
  style,
  stylesXml,
  WORD_NS,
} from "../../../scripts/docx-baseline/corpus/builder";
import type { DocxBaselineCase } from "../../../scripts/docx-baseline/corpus/types";

const commentReference = '<w:r><w:commentReference w:id="1"/></w:r>';
const mappedComments = ["mammoth/style-map", "comment-reference => h2:fresh"] as [string, string];

function comments(contents: string): [string, string] {
  return ["word/comments.xml", `<w:comments xmlns:w="${WORD_NS}">${contents}</w:comments>`];
}

/** Small concrete probes supplement the frozen corpus without rewriting its captures. */
export function createAdditionalDocxContentProbes(): DocxBaselineCase[] {
  const listCases = [
    { id: "ordered", format: "decimal", level: 0, heading: 2 },
    { id: "unordered", format: "bullet", level: 1, heading: 3 },
  ].map(({ id, format, level, heading }): DocxBaselineCase => {
    const text = `${id} list report`;
    return {
      id: `projection-${id}-list-heading`,
      category: "content-projection-probes",
      variations: [`${id}-list-selector`, "numbering-selects-heading"],
      input: {
        bytes: buildDocxPackage({
          body: `<w:p><w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="7"/></w:numPr></w:pPr>${run(text)}</w:p>`,
          extraParts: [
            [
              "word/numbering.xml",
              `<w:numbering xmlns:w="${WORD_NS}"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="${level}"><w:numFmt w:val="${format}"/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="1"/></w:num></w:numbering>`,
            ],
            ["mammoth/style-map", `p:${id}-list(${level + 1}) => h${heading}:fresh`],
          ],
        }),
      },
      expected: {
        rawEquals: `${text}\n\n`,
        htmlEquals: `<h${heading}>${text}</h${heading}>`,
        headings: [text],
        titleFirst: text,
      },
    };
  });
  return [
    ...listCases,
    {
      id: "projection-style-linked-list-heading",
      category: "content-projection-probes",
      variations: ["paragraph-style-linked-numbering", "list-selector-heading"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Style linked list report", "ListReport"),
          styles: stylesXml(style("ListReport", "List Report")),
          extraParts: [
            [
              "word/numbering.xml",
              `<w:numbering xmlns:w="${WORD_NS}"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/><w:pStyle w:val="ListReport"/></w:lvl></w:abstractNum></w:numbering>`,
            ],
            ["mammoth/style-map", "p:unordered-list(2) => h2:fresh"],
          ],
        }),
      },
      expected: {
        rawEquals: "Style linked list report\n\n",
        htmlEquals: "<h2>Style linked list report</h2>",
        headings: ["Style linked list report"],
        titleFirst: "Style linked list report",
      },
    },
    {
      id: "projection-comment-heading-order",
      category: "content-projection-probes",
      variations: [
        "comment-reference-heading",
        "duplicate-comment-snapshot",
        "comments-after-notes",
        "comments-raw-excluded",
      ],
      input: {
        bytes: buildDocxPackage({
          body:
            paragraph("Main report", "Heading1") +
            `<w:p>${run("Before")}${commentReference}${commentReference}${run("After")}<w:r><w:footnoteReference w:id="2"/></w:r></w:p>`,
          extraParts: [
            comments(
              `<w:comment w:id="1" w:initials="AB">${paragraph("Comment heading", "Heading3")}</w:comment>`,
            ),
            [
              "word/footnotes.xml",
              `<w:footnotes xmlns:w="${WORD_NS}"><w:footnote w:id="2">${paragraph("Footnote heading", "Heading2")}</w:footnote></w:footnotes>`,
            ],
            mappedComments,
          ],
        }),
      },
      expected: {
        rawEquals: "Main report\n\nBeforeAfter\n\n",
        htmlIncludes: [
          "<h2><a",
          "[AB1]",
          "[AB2]",
          "<h2>Footnote heading</h2>",
          "<h3>Comment heading</h3>",
        ],
        htmlOccurrences: { "<h3>Comment heading</h3>": 2 },
        headings: ["Main report", "[AB1]", "[AB2]", "Footnote heading", "Comment heading"],
        titleFirst: "Main report",
      },
    },
    ...[false, true].map((mapped): DocxBaselineCase => ({
      id: mapped ? "projection-missing-comment-mapped" : "projection-missing-comment-ignored",
      category: "content-projection-probes",
      variations: [mapped ? "missing-visible-comment-fails" : "missing-ignored-comment-succeeds"],
      input: {
        bytes: buildDocxPackage({
          body: `<w:p>${run("Before")}${commentReference}${run("After")}</w:p>`,
          core: coreXml("Metadata title"),
          extraParts: mapped ? [mappedComments] : [],
        }),
      },
      expected: {
        rawEquals: "BeforeAfter\n\n",
        metadataTitle: "Metadata title",
        ...(mapped
          ? { reason: "docx_extract_error" }
          : { headings: [], titleFirst: "Metadata title" }),
      },
    })),
    {
      id: "projection-unused-comment-invalid-symbol",
      category: "content-projection-probes",
      variations: ["unused-comment-semantic-validation", "missing-font-fails-conversion"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Usable body report"),
          core: coreXml("Metadata title"),
          extraParts: [
            comments('<w:comment w:id="1"><w:p><w:r><w:sym w:char="28"/></w:r></w:p></w:comment>'),
          ],
        }),
      },
      expected: {
        reason: "docx_extract_error",
        metadataTitle: "Metadata title",
        htmlErrorIncludes: "toUpperCase",
        rawErrorIncludes: "toUpperCase",
      },
    },
    {
      id: "discovery-literal-percent-main-and-style",
      category: "content-projection-probes",
      variations: [
        "literal-percent-main-filename",
        "literal-percent-style-filename",
        "targets-not-uri-decoded",
      ],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Literal percent report", "Custom"),
          documentPath: "content/main%20part.xml",
          documentTarget: "content/main%20part.xml",
          stylesPath: "content/style%20part.xml",
          stylesTarget: "style%20part.xml",
          styles: stylesXml(style("Custom", "Heading 2")),
        }),
      },
      expected: {
        rawEquals: "Literal percent report\n\n",
        headings: ["Literal percent report"],
        titleFirst: "Literal percent report",
      },
    },
    {
      id: "discovery-percent-style-map-ignored",
      category: "content-projection-probes",
      variations: ["embedded-style-map-literal-filename", "encoded-filename-does-not-alias"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("Encoded map default heading", "Heading1"),
          extraParts: [["mammoth/style%2Dmap", "p.Heading1 => !"]],
        }),
      },
      expected: {
        rawEquals: "Encoded map default heading\n\n",
        htmlEquals: "<h1>Encoded map default heading</h1>",
        headings: ["Encoded map default heading"],
        titleFirst: "Encoded map default heading",
      },
    },
    {
      id: "projection-utf16-style-map-invalid",
      category: "content-projection-probes",
      variations: ["embedded-style-map-utf8-only", "utf16-rule-invalid-default-preserved"],
      input: {
        bytes: buildDocxPackage({
          body: paragraph("UTF16 map default heading", "Heading1"),
          extraParts: [["mammoth/style-map", encodeUtf16LeXml("p.Heading1 => !")]],
        }),
      },
      expected: {
        rawEquals: "UTF16 map default heading\n\n",
        htmlEquals: "<h1>UTF16 map default heading</h1>",
        htmlMessagesInclude: ["Did not understand this style mapping"],
        headings: ["UTF16 map default heading"],
        titleFirst: "UTF16 map default heading",
      },
    },
  ];
}
