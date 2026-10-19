import { run, xmlEscape } from "./docx-baseline/corpus/builder";
import type { ReviewCase } from "./docx-review-cases";

interface FieldCase extends ReviewCase {
  checkboxes: number;
}

const marker = (type: string) => `<w:r><w:fldChar w:fldCharType="${type}"/></w:r>`;
const start = (instruction: string, separate: boolean) =>
  marker("begin") +
  `<w:r><w:instrText xml:space="preserve">${xmlEscape(instruction)}</w:instrText></w:r>` +
  (separate ? marker("separate") : "");
const checkbox = (separate = false) => start(" FORMCHECKBOX ", separate) + marker("end");

/** Nested-field expectations preserve the original classifier's separator/end boundary. */
export function createDocxFieldCases(): FieldCase[] {
  const cases = [
    ...[false, true].map((separate) => ({
      id: `unknown-nested-checkbox-${separate ? "separated" : "unseparated"}`,
      contents:
        start(" IF 1 = 1 ", true) +
        checkbox(separate) +
        run("Annual") +
        marker("end") +
        run("Report"),
      title: "AnnualReport",
      checkboxes: 1,
    })),
    {
      id: "hyperlink-nested-checkbox",
      contents:
        start(' HYPERLINK "https://example.invalid/report" ', true) +
        checkbox() +
        run("Annual") +
        marker("end") +
        run("Report"),
      title: "Annual Report",
      checkboxes: 1,
    },
    {
      id: "unseparated-outer-nested-checkbox",
      contents:
        start(" IF 1 = 1 ", false) + checkbox() + run("Annual") + marker("end") + run("Report"),
      title: "Annual Report",
      checkboxes: 2,
    },
    ...[false, true].flatMap((separate) => [
      {
        id: `checkbox-${separate ? "separated" : "unseparated"}`,
        contents: checkbox(separate) + run("Annual") + run("Report"),
        title: "AnnualReport",
        checkboxes: 1,
      },
      {
        id: `unknown-${separate ? "separated" : "unseparated"}`,
        contents: start(" PAGE ", separate) + run("Annual") + marker("end") + run("Report"),
        title: "AnnualReport",
        checkboxes: 0,
      },
    ]),
    {
      id: "checkbox-nested-unknown",
      contents:
        start(" FORMCHECKBOX ", true) +
        start(" PAGE ", true) +
        marker("end") +
        run("Annual") +
        marker("end") +
        run("Report"),
      title: "Annual Report",
      checkboxes: 1,
    },
  ];
  return cases.map(({ id, contents, title, checkboxes }) => ({
    id: `review-field-${id}`,
    options: { body: `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${contents}</w:p>` },
    rawText: "AnnualReport\n\n",
    headings: [{ level: 1, text: title }],
    titleCandidates: title === "AnnualReport" ? [title] : [title, "AnnualReport"],
    checkboxes,
  }));
}
