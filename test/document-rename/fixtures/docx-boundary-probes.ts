import {
  buildDocxEntries,
  buildStoredZip,
  documentXml,
  paragraph,
  REL_NS,
  run,
  stylesXml,
  WORD_NS,
} from "./docx-baseline/corpus/builder";
import type { ResourceBoundaryMetric } from "./docx-baseline/resource-cases";
import { DEFAULT_DOCX_LIMITS } from "../../../src/docx/limits";

/** The frozen inspector measures all entries; the reader charges only selected content. */
export const ORIGINAL_RESOURCE_RECONCILIATION = {
  compressedInputBytes: { selected: true, aboveDiagnostic: "docx_limit:compressedInputBytes" },
  entryCount: { selected: true, aboveDiagnostic: "docx_limit:entryCount" },
  maxPartDecompressedBytes: {
    selected: true,
    aboveDiagnostic: "docx_limit:maxPartDecompressedBytes",
  },
  totalDecompressedBytes: { selected: false, aboveDiagnostic: undefined },
  xmlElementCount: { selected: false, aboveDiagnostic: undefined },
  maxXmlDepth: { selected: true, aboveDiagnostic: "docx_limit:maxXmlDepth" },
  maxStyleTraversalSteps: { selected: false, aboveDiagnostic: undefined },
} satisfies Record<
  ResourceBoundaryMetric,
  { selected: boolean; aboveDiagnostic: string | undefined }
>;

export interface SelectedBoundaryProbe {
  id: string;
  metric: "totalDecompressedBytes" | "xmlElementCount" | "maxStyleTraversalSteps";
  observed: number;
  bytes: Buffer;
}

export const BOUNDARY_SENTINEL = "Selected resource boundary report";

function selectedAggregateBytes(observed: number): Buffer {
  const images = Array.from({ length: 4 }, (_, index) => `image${index}`);
  const entries = buildDocxEntries({
    body:
      paragraph(BOUNDARY_SENTINEL) +
      images
        .map((id) => `<w:p><w:r><w:pict><v:imagedata r:id="${id}"/></w:pict></w:r></w:p>`)
        .join(""),
    relationships: images
      .map((id) => `<Relationship Id="${id}" Type="${REL_NS}/image" Target="media/${id}.png"/>`)
      .join(""),
  });
  let remaining = observed - entries.reduce((sum, [, value]) => sum + Buffer.byteLength(value), 0);
  for (const id of images) {
    const size = Math.min(remaining, DEFAULT_DOCX_LIMITS.maxPartDecompressedBytes);
    entries.push([`word/media/${id}.png`, Buffer.alloc(size, 0x61)]);
    remaining -= size;
  }
  if (remaining !== 0) throw new Error("Selected-byte boundary construction failed");
  return buildStoredZip(entries);
}

function selectedXmlElements(observed: number): Buffer {
  // Five main-document nodes, one selected styles root, and the selected empty nodes.
  // Splitting the nodes across parts proves a cumulative physical-entry budget.
  const extra = observed - 6;
  const mainExtra = Math.floor(extra / 2);
  return buildStoredZip([
    [
      "word/document.xml",
      documentXml(paragraph(BOUNDARY_SENTINEL) + "<unused/>".repeat(mainExtra)),
    ],
    ["word/styles.xml", stylesXml("<unused/>".repeat(extra - mainExtra))],
  ]);
}

function selectedStyleWork(observed: number): Buffer {
  // One name lookup, each nonmatching rule, then the Heading1 ID lookup.
  const rules = Array.from(
    { length: observed - 2 },
    (_, index) => `p.Unrelated${index} => h2:fresh`,
  );
  return buildStoredZip([
    ["word/document.xml", documentXml(paragraph(BOUNDARY_SENTINEL, "Heading1"))],
    ["mammoth/style-map", rules.join("\n")],
  ]);
}

function selectedNumberingWork(observed: number): Buffer {
  // Direct lookup consumes two steps; every numbering-style link consumes two more.
  // Missing ilvl plus an unrelated paragraph style adds one independent lookup step.
  const styledFallback = observed % 2 === 1;
  const links = (observed - (styledFallback ? 3 : 2)) / 2;
  const definitions: string[] = [];
  const styles: string[] = [];
  for (let index = 0; index <= links; index += 1) {
    definitions.push(
      `<w:abstractNum w:abstractNumId="${index}">${
        index === links
          ? '<w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl>'
          : `<w:numStyleLink w:val="Linked${index}"/>`
      }</w:abstractNum><w:num w:numId="${index}"><w:abstractNumId w:val="${index}"/></w:num>`,
    );
    if (index < links)
      styles.push(
        `<w:style w:type="numbering" w:styleId="Linked${index}"><w:pPr><w:numPr><w:numId w:val="${index + 1}"/></w:numPr></w:pPr></w:style>`,
      );
  }
  const properties =
    (styledFallback ? '<w:pStyle w:val="Unrelated"/>' : "") +
    `<w:numPr><w:numId w:val="0"/>${styledFallback ? "" : '<w:ilvl w:val="0"/>'}</w:numPr>`;
  return buildStoredZip([
    [
      "word/document.xml",
      documentXml(`<w:p><w:pPr>${properties}</w:pPr>${run(BOUNDARY_SENTINEL)}</w:p>`),
    ],
    [
      "word/numbering.xml",
      `<w:numbering xmlns:w="${WORD_NS}">${definitions.join("")}</w:numbering>`,
    ],
    ["word/styles.xml", stylesXml(styles.join(""))],
    ["mammoth/style-map", "p:ordered-list(1) => h2:fresh"],
  ]);
}

/** Complements the frozen whole-package probes without changing their expectations. */
export function* createSelectedBoundaryProbes(): Generator<SelectedBoundaryProbe> {
  for (const [name, metric, create] of [
    ["selected-total", "totalDecompressedBytes", selectedAggregateBytes],
    ["selected-elements", "xmlElementCount", selectedXmlElements],
    ["selected-style-work", "maxStyleTraversalSteps", selectedStyleWork],
    ["selected-numbering-work", "maxStyleTraversalSteps", selectedNumberingWork],
  ] as const) {
    for (const [position, offset] of [
      ["below", -1],
      ["at", 0],
      ["above", 1],
    ] as const) {
      const observed = DEFAULT_DOCX_LIMITS[metric] + offset;
      yield { id: `${name}-${position}`, metric, observed, bytes: create(observed) };
    }
  }
}
