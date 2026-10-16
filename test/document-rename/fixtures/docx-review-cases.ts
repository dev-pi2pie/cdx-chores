import type { DocumentTitleEvidence } from "../../../src/adapters/codex/document-rename/types";
import {
  buildDocxPackage,
  paragraph,
  REL_NS,
  run,
  stylesXml,
  WORD_NS,
  type DocxPackageOptions,
} from "./docx-baseline/corpus/builder";
import type { DocxBaselineCase } from "./docx-baseline/corpus/types";

interface ReviewCase {
  id: string;
  options: DocxPackageOptions;
  rawText?: string;
  headings?: Array<{ level: number; text: string }>;
  titleCandidates?: string[];
  leadText?: string;
  diagnostic?: string;
  reason?: string;
}

interface HyperlinkCase {
  id: string;
  attributes: string;
  text?: string;
  contents?: string;
  rawText?: string;
  relationships?: string;
  styleMap?: string;
  diagnostic?: string;
}

const strongStyles = stylesXml(
  '<w:style w:type="character" w:styleId="Important"><w:name w:val="Strong"/></w:style>',
);
const strongRun = '<w:r><w:rPr><w:rStyle w:val="Important"/></w:rPr><w:t>Financial</w:t></w:r>';
const heading = (contents: string) =>
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${contents}</w:p>`;
const cell = (text: string, properties = "") =>
  `<w:tc><w:tcPr>${properties}</w:tcPr>${paragraph(text, "Heading1")}</w:tc>`;
const row = (contents: string) => `<w:tr>${contents}</w:tr>`;
const table = (contents: string) => `<w:tbl>${contents}</w:tbl>`;
const checkbox = (contents: string, checked = "1") =>
  `<w:sdt xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:sdtPr><w14:checkbox><w14:checked w14:val="${checked}"/></w14:checkbox></w:sdtPr><w:sdtContent>${contents}</w:sdtContent></w:sdt>`;

/** Explicit review expectations; original historical captures remain unchanged. */
export function createDocxReviewCases(): ReviewCase[] {
  const visible = "Visible report";
  const hidden = "Hidden continuation";
  const merged = table(
    row(cell(visible, '<w:vMerge w:val="restart"/>')) + row(cell(hidden, "<w:vMerge/>")),
  );
  return [
    {
      id: "review-shared-malformed-metadata-budget",
      options: {
        body: paragraph("Metadata Accounting Report", "Heading1"),
        extraParts: [["docProps/shared.xml", "<root>" + "<a/>".repeat(50_000)]],
        replaceParts: [
          [
            "[Content_Types].xml",
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/shared.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/shared.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
          ],
        ],
      },
      rawText: "Metadata Accounting Report\n\n",
      headings: [{ level: 1, text: "Metadata Accounting Report" }],
    },
    ...[
      { id: "no-id", attributes: "", text: "AnnualFinancialReport" },
      { id: "empty-id", attributes: 'r:id=""', text: "AnnualFinancialReport" },
      { id: "empty-anchor", attributes: 'w:anchor=""', text: "AnnualFinancialReport" },
      { id: "anchor", attributes: 'w:anchor="part"', text: "Annual Financial Report" },
      {
        id: "empty-id-anchor",
        attributes: 'r:id="" w:anchor="part"',
        text: "Annual Financial Report",
      },
      ...[
        { id: "valid", target: 'Target="https://example.invalid/report#old"' },
        { id: "empty-target", target: 'Target=""' },
        { id: "missing-target", target: "", diagnostic: "docx_initial_reader_error" },
      ].map(({ id, target, diagnostic }) => ({
        id,
        attributes: 'r:id="link"',
        relationships: `<Relationship Id="link" Type="${REL_NS}/hyperlink" ${target}/>`,
        text: "Annual Financial Report",
        diagnostic,
      })),
      { id: "unresolved", attributes: 'r:id="missing"', diagnostic: "docx_initial_reader_error" },
      {
        id: "unresolved-empty",
        attributes: 'r:id="missing"',
        contents: run(""),
        rawText: "AnnualReport\n\n",
        text: "AnnualReport",
      },
      {
        id: "unresolved-suppressed",
        attributes: 'r:id="missing"',
        styleMap: "p.Heading1 => !",
        text: "",
      },
      {
        id: "unresolved-hidden-run",
        attributes: 'r:id="missing"',
        contents: '<w:r><w:rPr><w:rStyle w:val="Hidden"/></w:rPr><w:t>Financial</w:t></w:r>',
        styleMap: "r.Hidden => !",
        text: "AnnualReport",
      },
      {
        id: "unresolved-anchor-suppressed",
        attributes: 'r:id="missing" w:anchor="part"',
        styleMap: "p.Heading1 => !",
        diagnostic: "docx_initial_reader_error",
      },
      {
        id: "unresolved-anchor-empty",
        attributes: 'r:id="missing" w:anchor="part"',
        contents: run(""),
        diagnostic: "docx_initial_reader_error",
      },
      ...[false, true].map((empty) => ({
        id: `duplicate-${empty ? "empty" : "missing"}-target`,
        attributes: 'r:id="link"',
        relationships: `<Relationship Id="link" Type="${REL_NS}/hyperlink" Target="https://example.invalid/report"/><Relationship Id="link" Type="${REL_NS}/hyperlink"${empty ? ' Target=""' : ""}/>`,
        text: "Annual Financial Report",
        diagnostic: empty ? undefined : "docx_initial_reader_error",
      })),
    ].map((item: HyperlinkCase): ReviewCase => {
      const rawText = item.rawText ?? "AnnualFinancialReport\n\n";
      const text = item.text ?? "";
      return {
        id: `review-hyperlink-${item.id}`,
        options: {
          body: heading(
            run("Annual") +
              `<w:hyperlink ${item.attributes}>${item.contents ?? run("Financial")}</w:hyperlink>` +
              run("Report"),
          ),
          relationships: item.relationships,
          extraParts:
            item.styleMap === undefined ? undefined : [["mammoth/style-map", item.styleMap]],
        },
        rawText,
        headings: text ? [{ level: 1, text }] : [],
        titleCandidates: [...new Set([text, rawText.trim()].filter(Boolean))],
        diagnostic: item.diagnostic,
      };
    }),
    {
      id: "review-hyperlink-empty-field-anchor",
      options: {
        body: heading(
          run("Annual") +
            '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>HYPERLINK \\l &quot;&quot;</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
            run("Financial") +
            '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
            run("Report"),
        ),
      },
      diagnostic: "docx_initial_reader_error",
    },
    {
      id: "review-hyperlink-fragment-merge",
      options: {
        body: heading(
          run("Annual") +
            `<w:hyperlink r:id="link" w:anchor="part">${run("Financial")}</w:hyperlink><w:hyperlink r:id="direct">${run("Report")}</w:hyperlink>`,
        ),
        relationships: `<Relationship Id="link" Type="${REL_NS}/hyperlink" Target="https://example.invalid/report#old"/><Relationship Id="direct" Type="${REL_NS}/hyperlink" Target="https://example.invalid/report#part"/>`,
      },
      rawText: "AnnualFinancialReport\n\n",
      headings: [{ level: 1, text: "Annual FinancialReport" }],
      titleCandidates: ["Annual FinancialReport", "AnnualFinancialReport"],
    },
    ...["footnote", "endnote", "comment"].flatMap((kind) =>
      [false, true].map((anchor): ReviewCase => ({
        id: `review-hyperlink-unresolved${anchor ? "-anchor" : ""}-unused-${kind}`,
        options: {
          body: paragraph("Main report", "Heading1"),
          extraParts: [
            [
              `word/${kind}s.xml`,
              `<w:${kind}s xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}"><w:${kind} w:id="1"><w:p><w:hyperlink r:id="missing"${anchor ? ' w:anchor="part"' : ""}>${run("Unused")}</w:hyperlink></w:p></w:${kind}></w:${kind}s>`,
            ],
          ],
        },
        rawText: "Main report\n\n",
        headings: [{ level: 1, text: "Main report" }],
        diagnostic: anchor ? "docx_initial_reader_error" : undefined,
      })),
    ),
    {
      id: "review-strong-heading-boundaries",
      options: { body: heading(run("Annual") + strongRun + run("Report")), styles: strongStyles },
      rawText: "AnnualFinancialReport\n\n",
      headings: [{ level: 1, text: "Annual Financial Report" }],
      titleCandidates: ["Annual Financial Report", "AnnualFinancialReport"],
      leadText: "AnnualFinancialReport",
    },
    ...[
      { map: "r.Important =>", text: "Annual FinancialReport", suffix: "unwrap" },
      { map: "r.Important => !", text: "Annual Report", suffix: "suppress" },
    ].map(({ map, text, suffix }): ReviewCase => ({
      id: `review-strong-embedded-${suffix}`,
      options: {
        body: heading(run("Annual ") + strongRun + run("Report")),
        styles: strongStyles,
        extraParts: [["mammoth/style-map", map]],
      },
      rawText: "Annual FinancialReport\n\n",
      headings: [{ level: 1, text }],
      titleCandidates: [text, ...(suffix === "suppress" ? ["Annual FinancialReport"] : [])],
      leadText: "Annual FinancialReport",
    })),
    ...["b", "i"].map((property): ReviewCase => ({
      id: `review-direct-${property}-heading-boundaries`,
      options: {
        body: heading(
          run("Annual") +
            `<w:r><w:rPr><w:${property}/></w:rPr><w:t>Financial</w:t></w:r>` +
            run("Report"),
        ),
      },
      rawText: "AnnualFinancialReport\n\n",
      headings: [{ level: 1, text: "Annual Financial Report" }],
      titleCandidates: ["Annual Financial Report", "AnnualFinancialReport"],
      leadText: "AnnualFinancialReport",
    })),
    {
      id: "review-vertical-merge-continuation",
      options: { body: merged },
      rawText: `${visible}\n\n`,
      headings: [{ level: 1, text: visible }],
    },
    {
      id: "review-vertical-merge-ordinary-column",
      options: {
        body: table(
          row(cell("Spanning report", '<w:gridSpan w:val="2"/>') + cell(visible)) +
            row(
              cell("Other report", '<w:gridSpan w:val="2"/>') +
                cell(hidden, '<w:vMerge w:val="continue"/>'),
            ),
        ),
      },
      rawText: `Spanning report\n\n${visible}\n\nOther report\n\n`,
      headings: ["Spanning report", visible, "Other report"].map((text) => ({ level: 1, text })),
    },
    {
      id: "review-vertical-merge-discarded-span-column",
      options: {
        body: table(
          row(cell("Spanning report", '<w:gridSpan w:val="2"/><w:vMerge w:val="restart"/>')) +
            row(
              cell(hidden, '<w:gridSpan w:val="2"/><w:vMerge w:val="continue"/>') +
                cell("Retained report", '<w:vMerge w:val="continue"/>'),
            ),
        ),
      },
      rawText: "Spanning report\n\nRetained report\n\n",
      headings: ["Spanning report", "Retained report"].map((text) => ({ level: 1, text })),
    },
    {
      id: "review-vertical-merge-orphan-and-restart",
      options: {
        body: table(
          row(cell("Orphan report", "<w:vMerge/>")) +
            row(cell("Restart report", '<w:vMerge w:val="restart"/>')) +
            row(cell(hidden, "<w:vMerge/>")),
        ),
      },
      rawText: "Orphan report\n\nRestart report\n\n",
      headings: ["Orphan report", "Restart report"].map((text) => ({ level: 1, text })),
    },
    ...[false, true].map((nonRow): ReviewCase => ({
      id: `review-vertical-merge-malformed-${nonRow ? "table" : "row"}`,
      options: {
        body: table(
          row(cell(visible)) +
            row(cell(hidden, "<w:vMerge/>")) +
            (nonRow ? paragraph("Outside cell") : row(paragraph("Outside cell"))),
        ),
      },
      rawText: `${visible}\n\n${hidden}\n\nOutside cell\n\n`,
      headings: [visible, hidden].map((text) => ({ level: 1, text })),
    })),
    {
      id: "review-vertical-merge-eager-failure",
      options: {
        body: merged.replace(run(hidden), '<w:r><w:sym w:char="28"/></w:r>'),
      },
      diagnostic: "docx_symbol_font_missing",
    },
    ...["0", "1"].map((checked): ReviewCase => ({
      id: `review-checkbox-${checked === "1" ? "checked" : "unchecked"}`,
      options: {
        body: heading(checkbox(run(checked === "1" ? "☒" : "☐"), checked) + run(" Project Report")),
      },
      rawText: " Project Report\n\n",
      headings: [{ level: 1, text: "Project Report" }],
    })),
    {
      id: "review-checkbox-first-nonempty-text",
      options: {
        body: heading(
          run("Before") +
            checkbox(
              `<w:hyperlink w:anchor="report">${run("")}${run("☒ placeholder")}${run("Project")}</w:hyperlink>${run(" Report")}`,
            ) +
            run("After"),
        ),
      },
      rawText: "BeforeProject ReportAfter\n\n",
      headings: [{ level: 1, text: "Before Project ReportAfter" }],
      titleCandidates: ["Before Project ReportAfter", "BeforeProject ReportAfter"],
      leadText: "BeforeProject ReportAfter",
    },
    {
      id: "review-checkbox-no-text",
      options: { body: checkbox(paragraph("")) + paragraph("Project Report", "Heading1") },
      rawText: "Project Report\n\n",
      headings: [{ level: 1, text: "Project Report" }],
    },
    {
      id: "review-checkbox-only-empty",
      options: { body: checkbox(paragraph("")) },
      rawText: "",
      headings: [],
      reason: "docx_no_title_signal",
    },
    {
      id: "review-checkbox-eager-failure",
      options: { body: checkbox(`<w:p>${run("☒")}<w:r><w:sym w:char="28"/></w:r></w:p>`) },
      diagnostic: "docx_symbol_font_missing",
    },
    {
      id: "review-ordinary-content-control",
      options: {
        body: heading(
          `<w:sdt><w:sdtPr/><w:sdtContent>${run("Project Report")}</w:sdtContent></w:sdt>`,
        ),
      },
      rawText: "Project Report\n\n",
      headings: [{ level: 1, text: "Project Report" }],
    },
    ...[
      { id: "plain", xml: "<![CDATA[CDATA Report]]>", text: "CDATA Report" },
      { id: "mixed", xml: "Before<![CDATA[ & <Draft> ]]>After", text: "Before & <Draft> After" },
    ].map(({ id, xml, text }): ReviewCase => ({
      id: `review-cdata-${id}`,
      options: { body: heading(`<w:r><w:t>${xml}</w:t></w:r>`) },
      rawText: `${text}\n\n`,
      headings: [{ level: 1, text }],
    })),
  ];
}

export function reviewCaseInput(item: ReviewCase): DocxBaselineCase {
  return {
    id: item.id,
    category: "review-follow-up",
    variations: [item.id],
    input: { bytes: buildDocxPackage(item.options) },
    expected: {},
  };
}

/** Expected policy fields are authored from the named source-text consequences. */
export function expectedReviewEvidence(
  item: ReviewCase,
): DocumentTitleEvidence | { reason: string } {
  if (item.diagnostic || item.reason) return { reason: item.reason ?? "docx_extract_error" };
  const headings = item.headings!.map(({ text }) => text);
  return {
    filename: `${item.id}.docx`,
    extension: ".docx",
    detectedType: "docx",
    titleCandidates: item.titleCandidates ?? headings,
    headings: headings.length ? headings : undefined,
    tocCandidates: headings.length ? headings : undefined,
    leadText: item.leadText ?? item.rawText!.trim().replace(/\n+/g, " "),
    metadata: { extractor: "docx-reader" },
    warnings: ["docx_metadata_unavailable"],
  };
}
