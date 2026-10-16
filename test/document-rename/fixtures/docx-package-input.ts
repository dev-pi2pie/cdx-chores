import { buildDocxPackage, coreXml, paragraph, run, WORD_NS } from "./docx-baseline/corpus/builder";

/** Generated only inside the owned package-check workspace. */
export function packageCheckInput(): Buffer {
  return buildDocxPackage({
    body:
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' +
      run("Installed Ω ") +
      '<w:r><w:sym w:font="Symbol" w:char="22"/><w:sym w:font="Wingdings" w:char="28"/></w:r>' +
      run(" report") +
      "</w:p>" +
      `<w:p>${run("Body report ")}<w:r><w:footnoteReference w:id="1"/></w:r></w:p>`,
    core: coreXml("Installed metadata report", "Synthetic author"),
    extraParts: [
      [
        "word/footnotes.xml",
        `<w:footnotes xmlns:w="${WORD_NS}"><w:footnote w:id="1">${paragraph("Installed note heading", "Heading2")}</w:footnote></w:footnotes>`,
      ],
    ],
  });
}
