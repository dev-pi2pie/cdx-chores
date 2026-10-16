import assert from "node:assert/strict";

import {
  buildDocxPackage,
  coreXml,
  paragraph,
  REL_NS,
  run,
  WORD_NS,
} from "../../../scripts/docx-baseline/corpus/builder";
import { createResourceCases } from "../../../scripts/docx-baseline/resource-cases";
import { createSelectedBoundaryProbes } from "./docx-boundary-probes";

export interface DocxMeasureCase {
  id: string;
  kind: "supported" | "expected-limit";
  bytes: Buffer;
  diagnostic?: string;
}

const sentinel = "Measured report";

function mixedReport(): Buffer {
  const table = `<w:tbl><w:tr><w:tc>${paragraph("Quarter revenue")}</w:tc><w:tc>${paragraph("Result approved")}</w:tc></w:tr></w:tbl>`;
  const body = [
    paragraph(sentinel, "Heading1"),
    ...Array.from({ length: 200 }, (_, index) =>
      paragraph(`Section ${index}: report discussion and findings.`),
    ),
    table.repeat(20),
    `<w:sdt><w:sdtContent>${paragraph("Controlled report text")}</w:sdtContent></w:sdt>`,
    `<w:p>${run("Footnote included")}<w:r><w:footnoteReference w:id="1"/><w:sym w:font="Wingdings" w:char="F028"/></w:r></w:p>`,
    `<w:p><w:hyperlink r:id="external">${run("External reference")}</w:hyperlink></w:p>`,
  ].join("");
  return buildDocxPackage({
    body,
    core: coreXml("Measured metadata title", "Synthetic author"),
    relationships: `<Relationship Id="external" Type="${REL_NS}/hyperlink" Target="https://example.invalid/docx-measure" TargetMode="External"/>`,
    extraParts: [
      [
        "word/footnotes.xml",
        `<w:footnotes xmlns:w="${WORD_NS}"><w:footnote w:id="1">${paragraph("Measured note", "Heading2")}</w:footnote></w:footnotes>`,
      ],
    ],
  });
}

/** Fixed before measurement: no post-result pruning or automatic cap raises. */
export function createDocxMeasureCases(): DocxMeasureCase[] {
  const cases: DocxMeasureCase[] = [
    { id: "mixed-report", kind: "supported", bytes: mixedReport() },
    {
      id: "text-near-part-cap",
      kind: "supported",
      bytes: buildDocxPackage({
        body: paragraph(sentinel, "Heading1") + paragraph("Report discussion. ".repeat(54_000)),
      }),
    },
  ];
  const originalMetrics = [
    "compressedInputBytes",
    "entryCount",
    "maxPartDecompressedBytes",
    "maxXmlDepth",
  ];
  for (const item of createResourceCases()) {
    const metric = originalMetrics.find((name) => item.id.startsWith(`resource-${name}-`));
    if (!metric || item.id.endsWith("-below")) continue;
    assert("bytes" in item.input);
    const above = item.id.endsWith("-above");
    cases.push({
      id: item.id,
      kind: above ? "expected-limit" : "supported",
      bytes: item.input.bytes,
      ...(above ? { diagnostic: `docx_limit:${metric}` } : {}),
    });
  }
  for (const probe of createSelectedBoundaryProbes()) {
    if (probe.id.endsWith("-below")) continue;
    const above = probe.id.endsWith("-above");
    cases.push({
      id: probe.id,
      kind: above ? "expected-limit" : "supported",
      bytes: probe.bytes,
      ...(above ? { diagnostic: `docx_limit:${probe.metric}` } : {}),
    });
  }
  assert.equal(cases.length, 18);
  assert.equal(cases.filter((item) => item.kind === "supported").length, 10);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  return cases;
}
