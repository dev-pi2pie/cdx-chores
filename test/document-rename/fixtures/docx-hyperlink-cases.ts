import { paragraph, REL_NS, run, WORD_NS } from "./docx-baseline/corpus/builder";
import type { ReviewCase } from "./docx-review-cases";

/** Independent heading expectations expose whether replacement targets still merge. */
export function createDocxHyperlinkFragmentCases(): ReviewCase[] {
  const base = "https://example.invalid/report";
  const terminators = [
    { id: "lf", value: "&#10;" },
    { id: "cr", value: "&#13;" },
    { id: "line-separator", value: "\u2028" },
    { id: "paragraph-separator", value: "\u2029" },
  ];
  const variants: { id: string; target: string; direct?: string }[] = [
    ...terminators.map(({ id, value }) => ({ id, target: `${base}#old${value}fragment` })),
    { id: "ordinary", target: `${base}#old` },
    { id: "no-fragment", target: base },
    { id: "empty-fragment", target: `${base}#` },
    { id: "multiple-hashes", target: `${base}#old#later` },
    { id: "escaped-hash", target: `${base}%23old`, direct: `${base}%23old#part` },
    { id: "leading-hash", target: "#old", direct: "#part" },
    {
      id: "prefix-line-terminator",
      target: `${base}&#10;prefix#old`,
      direct: `${base}&#10;prefix#part`,
    },
  ];
  return ["document", "footnote", "endnote", "comment"].flatMap((source) =>
    (source === "document" ? variants : variants.slice(0, terminators.length)).map(
      ({ id, target, direct }): ReviewCase => {
        const title = "Annual FinancialReport";
        const heading =
          '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' +
          run("Annual") +
          `<w:hyperlink r:id="link" w:anchor="part">${run("Financial")}</w:hyperlink>` +
          `<w:hyperlink r:id="direct">${run("Report")}</w:hyperlink></w:p>`;
        const relationships =
          `<Relationship Id="link" Type="${REL_NS}/hyperlink" Target="${target}"/>` +
          `<Relationship Id="direct" Type="${REL_NS}/hyperlink" Target="${direct ?? `${base}#part`}"/>`;
        const main = source === "document";
        const raw = main ? "AnnualFinancialReport" : "Main report";
        return {
          id: `review-hyperlink-fragment-${source}-${id}`,
          options: main
            ? { body: heading, relationships }
            : {
                body: paragraph("Main report").replace(
                  "</w:p>",
                  `<w:r><w:${source}Reference w:id="1"/></w:r></w:p>`,
                ),
                extraParts: [
                  [
                    `word/${source}s.xml`,
                    `<w:${source}s xmlns:w="${WORD_NS}" xmlns:r="${REL_NS}"><w:${source} w:id="1">${heading}</w:${source}></w:${source}s>`,
                  ],
                  [
                    `word/_rels/${source}s.xml.rels`,
                    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
                  ],
                  ...(source === "comment"
                    ? [["mammoth/style-map", "comment-reference =>"] as [string, string]]
                    : []),
                ],
              },
          rawText: `${raw}\n\n`,
          headings: [{ level: 1, text: title }],
          titleCandidates: [title, raw],
        };
      },
    ),
  );
}
