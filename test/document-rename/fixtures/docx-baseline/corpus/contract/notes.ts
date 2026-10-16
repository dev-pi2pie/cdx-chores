import {
  buildDocxPackage,
  coreXml,
  paragraph,
  run,
  style,
  stylesXml,
  WORD_NS,
} from "../builder.ts";
import type { DocxBaselineCase } from "../types.ts";

function reference(id: number): string {
  return `<w:r><w:footnoteReference w:id="${id}"/></w:r>`;
}

function note(id: number, body: string): string {
  return `<w:footnote w:id="${id}">${body}</w:footnote>`;
}

function noteCase(
  id: string,
  variations: string[],
  body: string,
  notes: string,
  expected: DocxBaselineCase["expected"],
  options: { bounded?: boolean; core?: string; styleMap?: string; styles?: string } = {},
): DocxBaselineCase {
  return {
    id: `contract-note-${id}`,
    category: "contract-notes",
    variations,
    ...(options.bounded ? { execution: "bounded-node" as const } : {}),
    input: {
      bytes: buildDocxPackage({
        body,
        core: options.core,
        styles: stylesXml(style("Heading1", "Heading 1") + (options.styles ?? "")),
        extraParts: [
          ["word/footnotes.xml", `<w:footnotes xmlns:w="${WORD_NS}">${notes}</w:footnotes>`],
          ...(options.styleMap === undefined
            ? []
            : [["mammoth/style-map", options.styleMap] as [string, string]]),
        ],
      }),
    },
    expected,
  };
}

export function contractNoteCases(): DocxBaselineCase[] {
  const body = `<w:p>${run("Note Body Report")}${reference(1)}</w:p>`;
  return [
    noteCase(
      "repeated",
      ["repeated-body-reference", "duplicate-html-note", "deduplicated-evidence-heading"],
      `<w:p>${run("Repeated Note Report")}${reference(1)}${reference(1)}</w:p>`,
      note(1, paragraph("Repeated Note Heading", "Heading1")),
      {
        rawEquals: "Repeated Note Report\n\n",
        htmlIncludes: [
          '<sup><a href="#footnote-1" id="footnote-ref-1">[1]</a></sup>',
          '<sup><a href="#footnote-1" id="footnote-ref-1">[2]</a></sup>',
          "<h1>Repeated Note Heading</h1>",
        ],
        headings: ["Repeated Note Heading"],
        htmlOccurrences: { "<h1>Repeated Note Heading</h1>": 2 },
        titleFirst: "Repeated Note Heading",
      },
    ),
    noteCase(
      "nested",
      ["nested-reference-not-expanded", "only-document-reference-snapshot-rendered"],
      body,
      note(1, `<w:p>${run("First Note Report")}${reference(2)}</w:p>`) +
        note(2, paragraph("Nested Note Excluded", "Heading1")),
      {
        rawEquals: "Note Body Report\n\n",
        htmlIncludes: ["First Note Report", 'href="#footnote-2"'],
        htmlExcludes: ["Nested Note Excluded"],
        headings: [],
      },
    ),
    noteCase(
      "self-cycle",
      ["self-referencing-note", "bounded-reference-snapshot", "no-recursive-expansion"],
      body,
      note(1, `<w:p>${run("Self Cycle Note")}${reference(1)}</w:p>`),
      {
        rawEquals: "Note Body Report\n\n",
        htmlIncludes: ["Self Cycle Note", 'id="footnote-1"'],
        headings: [],
        htmlOccurrences: { "Self Cycle Note": 1 },
      },
      { bounded: true },
    ),
    noteCase(
      "mutual-cycle",
      ["mutually-referencing-notes", "unreferenced-nested-note-excluded"],
      body,
      note(1, `<w:p>${run("First Cycle Note")}${reference(2)}</w:p>`) +
        note(2, `<w:p>${run("Second Cycle Excluded")}${reference(1)}</w:p>`),
      {
        rawEquals: "Note Body Report\n\n",
        htmlIncludes: ["First Cycle Note", 'href="#footnote-2"'],
        htmlExcludes: ["Second Cycle Excluded"],
        headings: [],
      },
      { bounded: true },
    ),
    noteCase("missing", ["missing-document-note-target", "html-error-fails-adapter"], body, "", {
      rawEquals: "Note Body Report\n\n",
      htmlErrorIncludes: "type",
      reason: "docx_extract_error",
    }),
    noteCase(
      "missing-metadata",
      ["missing-document-note-target", "metadata-does-not-rescue-conversion-error"],
      body,
      "",
      {
        rawEquals: "Note Body Report\n\n",
        htmlErrorIncludes: "type",
        metadataTitle: "Metadata With Missing Note",
        reason: "docx_extract_error",
      },
      { core: coreXml("Metadata With Missing Note") },
    ),
    noteCase(
      "heading-only",
      ["note-only-document", "heading-evidence-without-raw-lead"],
      `<w:p>${reference(1)}</w:p>`,
      note(1, paragraph("Note Only Heading Report", "Heading1")),
      {
        rawEquals: "\n\n",
        htmlIncludes: ["<h1>Note Only Heading Report</h1>"],
        headings: ["Note Only Heading Report"],
        titleFirst: "Note Only Heading Report",
        warningsInclude: ["docx_metadata_unavailable", "docx_no_lead_text"],
      },
    ),
    noteCase(
      "plain-only",
      ["note-only-document", "non-heading-html-without-title-signal"],
      `<w:p>${reference(1)}</w:p>`,
      note(1, paragraph("Note Only Plain Text")),
      {
        rawEquals: "\n\n",
        htmlIncludes: ["Note Only Plain Text"],
        reason: "docx_no_title_signal",
      },
    ),
    noteCase(
      "nested-missing",
      ["missing-nested-target", "unresolved-link-does-not-fail-conversion"],
      body,
      note(1, `<w:p>${run("Nested Missing Target")}${reference(999)}</w:p>`),
      {
        rawEquals: "Note Body Report\n\n",
        htmlIncludes: ["Nested Missing Target", 'href="#footnote-999"'],
        titleFirst: "Note Body Report",
        headings: [],
      },
    ),
    noteCase(
      "heading-reference",
      ["note-reference-inside-heading", "reference-label-affects-heading-evidence"],
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run("Main Report ")}${reference(1)}</w:p>`,
      note(1, paragraph("Heading Note Detail")),
      {
        rawEquals: "Main Report \n\n",
        htmlIncludes: ["<h1>Main Report <sup>", "Heading Note Detail"],
        headings: ["Main Report [1]"],
        titleFirst: "Main Report [1]",
      },
    ),
    noteCase(
      "unused-invalid-symbol",
      ["unused-note-body-read-eagerly", "missing-font-fails-before-note-rendering"],
      `<w:p>${run("Unused Note Body Report")}</w:p>`,
      note(1, '<w:p><w:r><w:sym w:char="28"/></w:r></w:p>'),
      {
        htmlErrorIncludes: "toUpperCase",
        rawErrorIncludes: "toUpperCase",
        reason: "docx_extract_error",
      },
    ),
    noteCase(
      "ignored-missing",
      ["style-map-hides-missing-reference", "html-selection-affects-note-validation"],
      `<w:p><w:pPr><w:pStyle w:val="Ignore"/></w:pPr>${run("Ignored Missing Note")}${reference(999)}</w:p>${paragraph("Visible Note Report")}`,
      "",
      {
        rawEquals: "Ignored Missing Note\n\nVisible Note Report\n\n",
        htmlEquals: "<p>Visible Note Report</p>",
        titleFirst: "Ignored Missing Note",
      },
      { styleMap: "p.Ignore => !" },
    ),
    noteCase(
      "heading-order-and-rank",
      [
        "main-headings-before-note-headings",
        "repeated-note-heading-signals",
        "first-four-ranking-before-heading-deduplication",
        "late-h2-heading-excluded-from-titles",
      ],
      paragraph("Main Document Heading", "Heading2") +
        `<w:p>${run("Main Body Detail")}${reference(1)}${reference(1)}${reference(1)}${reference(2)}</w:p>`,
      note(1, paragraph("Repeated Note Heading", "Heading2")) +
        note(2, paragraph("Late Note Heading", "Heading2")),
      {
        rawEquals: "Main Document Heading\n\nMain Body Detail\n\n",
        htmlIncludes: [
          "<h2>Main Document Heading</h2>",
          "<h2>Repeated Note Heading</h2>",
          "<h2>Late Note Heading</h2>",
        ],
        htmlOccurrences: { "<h2>Repeated Note Heading</h2>": 3 },
        headings: ["Main Document Heading", "Repeated Note Heading", "Late Note Heading"],
        titleCandidates: ["Main Document Heading", "Repeated Note Heading"],
      },
      { styles: style("Heading2", "Heading 2") },
    ),
  ];
}
