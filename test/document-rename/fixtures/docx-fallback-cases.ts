import { paragraph, run } from "./docx-baseline/corpus/builder";
import type { ReviewCase } from "./docx-review-cases";

const alternate = (choice: string, fallback?: string) =>
  `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="w">${choice}</mc:Choice>${fallback === undefined ? "" : `<mc:Fallback>${fallback}</mc:Fallback>`}</mc:AlternateContent>`;
const invalidImage = '<w:r><w:pict><v:imagedata r:id="missing"/></w:pict></w:r>';

/** The XML reader selects fallback children before semantic content is interpreted. */
export function createDocxFallbackCases(): ReviewCase[] {
  return [
    {
      id: "review-fallback-selected",
      options: {
        body: `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run("Annual")}${alternate(invalidImage, run("Financial"))}${run("Report")}</w:p>`,
      },
      rawText: "AnnualFinancialReport\n\n",
      headings: [{ level: 1, text: "AnnualFinancialReport" }],
    },
    {
      id: "review-fallback-nested",
      options: {
        body: alternate(
          paragraph("Excluded outer choice", "Heading1"),
          alternate(invalidImage, paragraph("Nested report", "Heading1")),
        ),
      },
      rawText: "Nested report\n\n",
      headings: [{ level: 1, text: "Nested report" }],
    },
    {
      id: "review-fallback-absent",
      options: { body: paragraph("Main report", "Heading1") + alternate(invalidImage) },
      rawText: "Main report\n\n",
      headings: [{ level: 1, text: "Main report" }],
    },
    {
      id: "review-fallback-eager-image-failure",
      options: {
        body: paragraph("Main report", "Heading1") + alternate(run("Unused"), invalidImage),
      },
      diagnostic: "docx_initial_reader_error",
    },
  ];
}
