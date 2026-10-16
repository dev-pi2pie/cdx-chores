import type { DocxBaselineCase } from "./types.ts";

export function existingCases(): DocxBaselineCase[] {
  return [
    { id: "metadata-rich", title: "Quarterly Operating Plan 2026", warnings: [] },
    { id: "heading-rich", title: "CLI Action Tool Integration Guide", warnings: [] },
    {
      id: "weak-heading",
      title: "Customer Launch Checklist",
      warnings: ["docx_metadata_unavailable"],
    },
    { id: "no-heading", title: "Q2 Hiring Plan", warnings: ["docx_metadata_unavailable"] },
    { id: "table-heavy", title: "Roadmap Milestones", warnings: [] },
    { id: "hyperlink-heavy", title: "Partner Reference Guide", warnings: [] },
    {
      id: "textutil-alt-editor",
      title: "Partner Enablement Guide",
      warnings: ["docx_metadata_unavailable"],
    },
  ].map(({ id, title, warnings }) => ({
    id: `seed-${id}`,
    category: "existing-evidence",
    variations: [id],
    input: { fixture: `test/fixtures/docs/${id}.docx` },
    expected: { titleFirst: title, warningsInclude: warnings },
  }));
}
