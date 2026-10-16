import {
  buildDocxEntries,
  buildDocxPackage,
  buildStoredZip,
  documentXml,
  paragraph,
  style,
  stylesXml,
  type ZipEntry,
} from "./corpus/builder.ts";
import type { DocxBaselineCase } from "./corpus/index.ts";
import { countXmlDimensions, PROPOSED_DOCX_BUDGETS } from "./dimensions.ts";

export type ResourceBoundaryMetric =
  | "compressedInputBytes"
  | "entryCount"
  | "maxPartDecompressedBytes"
  | "totalDecompressedBytes"
  | "xmlElementCount"
  | "maxXmlDepth"
  | "maxStyleTraversalSteps";

export interface ResourceBoundary {
  caseId: string;
  metric: ResourceBoundaryMetric;
  position: "below" | "at" | "above";
  proposedCap: number;
  measuredTarget: number;
}

const SENTINEL = "Resource boundary sentinel";
const SMALL_BODY = paragraph(SENTINEL);
const POSITIONS = ["below", "at", "above"] as const;

/** Whole-package structural measurements; selected-content enforcement is tested separately. */
export const RESOURCE_BOUNDARIES: ResourceBoundary[] = (
  [
    "compressedInputBytes",
    "entryCount",
    "maxPartDecompressedBytes",
    "totalDecompressedBytes",
    "xmlElementCount",
    "maxXmlDepth",
    "maxStyleTraversalSteps",
  ] satisfies ResourceBoundaryMetric[]
).flatMap((metric) =>
  POSITIONS.map((position, index) => ({
    caseId: `resource-${metric}-${position}`,
    metric,
    position,
    proposedCap: PROPOSED_DOCX_BUDGETS[metric],
    measuredTarget: PROPOSED_DOCX_BUDGETS[metric] + index - 1,
  })),
);

function bytes(value: string | Buffer): number {
  return Buffer.isBuffer(value) ? value.length : Buffer.byteLength(value);
}

function totalBytes(entries: ZipEntry[]): number {
  return entries.reduce((sum, [, content]) => sum + bytes(content), 0);
}

function appendPadding(entries: ZipEntry[], count: number): ZipEntry[] {
  const result = [...entries];
  let remaining = count;
  let index = 0;
  // Several independently bounded non-XML parts keep body/raw captures small.
  while (remaining > 0) {
    const size = Math.min(512 * 1024, remaining);
    result.push([`resources/padding-${index++}.bin`, Buffer.alloc(size, 0x61)]);
    remaining -= size;
  }
  return result;
}

function withExactCompressedInputBytes(target: number): Buffer {
  const base = buildDocxEntries({ body: SMALL_BODY });
  // Stored ZIP fixtures have exact input size equal to data plus deterministic
  // headers. Work out the part count first, then fill the final part precisely.
  const partCount = Math.ceil(target / (512 * 1024));
  const entries: ZipEntry[] = [...base];
  for (let index = 0; index < partCount; index += 1) {
    entries.push([`resources/padding-${index}.bin`, Buffer.alloc(0)]);
  }
  let remaining = target - buildStoredZip(entries).length;
  for (let index = base.length; index < entries.length; index += 1) {
    const size = Math.min(512 * 1024, remaining);
    entries[index]![1] = Buffer.alloc(size, 0x61);
    remaining -= size;
  }
  if (remaining !== 0) throw new Error("Unable to construct compressed-input boundary");
  return buildStoredZip(entries);
}

function createBoundaryBuffer(boundary: ResourceBoundary): Buffer {
  const target = boundary.measuredTarget;
  const base = buildDocxEntries({ body: SMALL_BODY });
  switch (boundary.metric) {
    case "compressedInputBytes":
      return withExactCompressedInputBytes(target);
    case "entryCount":
      return buildStoredZip([
        ...base,
        ...Array.from({ length: target - base.length }, (_, index): ZipEntry => [
          `resources/empty-${index}.bin`,
          "",
        ]),
      ]);
    case "maxPartDecompressedBytes": {
      const emptyDocument = documentXml(`${SMALL_BODY}<!---->`);
      const fillerSize = target - Buffer.byteLength(emptyDocument);
      return buildDocxPackage({
        // Padding is in the main body part; this also exercises bodies >256 KiB.
        documentXml: documentXml(`${SMALL_BODY}<!--${"x".repeat(fillerSize)}-->`),
      });
    }
    case "totalDecompressedBytes":
      return buildStoredZip(appendPadding(base, target - totalBytes(base)));
    case "xmlElementCount": {
      const baseElements = base.reduce((sum, [name, value]) => {
        if (!/\.(?:xml|rels)$/.test(name)) return sum;
        return sum + countXmlDimensions(value.toString()).elementCount;
      }, 0);
      return buildStoredZip([
        ...base,
        ["resources/node-count.xml", `<nodes>${"<n/>".repeat(target - baseElements - 1)}</nodes>`],
      ]);
    }
    case "maxXmlDepth": {
      // document/body are two levels; paragraph/run/text add three more.
      const wrappers = target - 5;
      return buildDocxPackage({
        body: `${"<w:ins>".repeat(wrappers)}${SMALL_BODY}${"</w:ins>".repeat(wrappers)}`,
      });
    }
    case "maxStyleTraversalSteps": {
      const styles = Array.from({ length: target }, (_, index) =>
        style(
          `Chain${index}`,
          `Chain ${index}`,
          index === target - 1 ? "" : `<w:basedOn w:val="Chain${index + 1}"/>`,
        ),
      ).join("");
      return buildDocxPackage({ body: paragraph(SENTINEL, "Chain0"), styles: stylesXml(styles) });
    }
  }
}

export function createResourceCases(): DocxBaselineCase[] {
  return RESOURCE_BOUNDARIES.map((boundary) => ({
    id: boundary.caseId,
    category: "resource",
    variations: [
      `resource-${boundary.metric}-${boundary.position}`,
      ...(boundary.metric === "maxPartDecompressedBytes" ? ["body-above-metadata-cap"] : []),
    ],
    input: { bytes: createBoundaryBuffer(boundary) },
    expected: { rawIncludes: [SENTINEL], htmlIncludes: [SENTINEL] },
  }));
}
