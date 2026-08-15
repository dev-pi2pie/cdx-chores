import { readFile } from "node:fs/promises";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import type {
  CounterEvidencePattern,
  ExpectedCounterValues,
  ExpectedPdfDocument,
  ExpectedPhysicalPage,
  PageNumberRegion,
  PageOrientation,
} from "../../../test/fixtures/markdown-pdf/page-number-renderer-contract";
import type {
  BodyHookEvidence,
  OnePassCounterAssessment,
  PdfEvidence,
  PdfExtractionSummary,
  PdfInspector,
  PdfPageEvidence,
  PdfTextRunEvidence,
} from "./contract";
import { PAGE_NUMBER_BODY_HOOK_CASES } from "../../../test/fixtures/markdown-pdf/page-number-renderer-contract";

export function publicSafeText(value: string): string {
  return value
    .replace(/(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s"'<>|]+/gu, "[redacted-path]")
    .replace(/(?<![A-Za-z0-9:/])\/(?:[^\s"'<>|/]+\/)*[^\s"'<>|/]+/gu, "[redacted-path]");
}

function millimetersFromPoints(points: number): number {
  return (points * 25.4) / 72;
}

export const inspectPdf: PdfInspector = async (pdfPath) => {
  const bytes = await readFile(pdfPath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    worker: null as never,
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  } as never);
  const document = await loadingTask.promise;
  try {
    const pageLabels = await document.getPageLabels();
    const pages: PdfPageEvidence[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = page.view;
      const items = textContent.items as Array<{
        str?: string;
        transform?: readonly number[];
        width?: number;
        height?: number;
      }>;
      const runs = items
        .map((item): PdfTextRunEvidence | undefined => {
          const text = item.str?.replace(/\s+/gu, " ").trim() ?? "";
          const transform = item.transform;
          if (!text || !transform || transform.length < 6) return undefined;
          const heightPoints = Math.abs(item.height ?? transform[3] ?? 0);
          return {
            text,
            xMillimeters: millimetersFromPoints((transform[4] ?? 0) - x1),
            yMillimeters: millimetersFromPoints((transform[5] ?? 0) - y1 - heightPoints),
            widthMillimeters: millimetersFromPoints(Math.abs(item.width ?? 0)),
            heightMillimeters: millimetersFromPoints(heightPoints),
          };
        })
        .filter((run): run is PdfTextRunEvidence => run !== undefined);
      const text = items
        .map((item) => item.str ?? "")
        .join(" ")
        .replace(/\s+/gu, " ")
        .trim();
      pages.push({
        text,
        runs,
        widthMillimeters: millimetersFromPoints(Math.abs(x2 - x1)),
        heightMillimeters: millimetersFromPoints(Math.abs(y2 - y1)),
      });
    }
    return {
      pageCount: document.numPages,
      pages,
      pageLabelState: pageLabels === null ? "default-physical" : "unexpected-custom",
    };
  } finally {
    await loadingTask.destroy();
  }
};

export async function inspectBodyHookCases(
  bodyHookPaths?: Readonly<Record<string, string>>,
): Promise<BodyHookEvidence[]> {
  return await Promise.all(
    PAGE_NUMBER_BODY_HOOK_CASES.map(async (bodyHookCase) => {
      const html = bodyHookPaths
        ? await readFile(bodyHookPaths[bodyHookCase.id] ?? "", "utf8")
        : bodyHookCase.html;
      const hookCount = html.match(/class=["'][^"']*\bdocument-body\b[^"']*["']/gu)?.length ?? 0;
      const actual =
        hookCount === 1
          ? "supported"
          : bodyHookCase.countFrom === "document"
            ? "warning-fallback"
            : "hard-error";
      return {
        id: bodyHookCase.id,
        actual,
        expected: bodyHookCase.expected,
        passed: actual === bodyHookCase.expected,
      };
    }),
  );
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.6;
}

function runOccupiesRegion(
  run: PdfTextRunEvidence,
  page: PdfPageEvidence,
  region: PageNumberRegion,
): boolean {
  const horizontalCenter = run.xMillimeters + run.widthMillimeters / 2;
  const verticalCenter = run.yMillimeters + run.heightMillimeters / 2;
  const horizontal =
    region === "bottom-center"
      ? horizontalCenter >= page.widthMillimeters * 0.3 &&
        horizontalCenter <= page.widthMillimeters * 0.7
      : horizontalCenter >= page.widthMillimeters * 0.6;
  const vertical =
    region === "top-right"
      ? verticalCenter >= page.heightMillimeters * 0.8
      : verticalCenter <= page.heightMillimeters * 0.2;
  return horizontal && vertical;
}

function textWithoutWhitespace(value: string): string {
  return value.replace(/\s+/gu, "");
}

export function findContiguousLabelRun(
  page: PdfPageEvidence,
  label: string,
): PdfTextRunEvidence | undefined {
  const expected = textWithoutWhitespace(label);
  for (let start = 0; start < page.runs.length; start += 1) {
    let actual = "";
    let left = Number.POSITIVE_INFINITY;
    let bottom = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let top = Number.NEGATIVE_INFINITY;
    for (
      let index = start;
      index < page.runs.length && actual.length <= expected.length;
      index += 1
    ) {
      const run = page.runs[index];
      if (!run) break;
      actual += textWithoutWhitespace(run.text);
      left = Math.min(left, run.xMillimeters);
      bottom = Math.min(bottom, run.yMillimeters);
      right = Math.max(right, run.xMillimeters + run.widthMillimeters);
      top = Math.max(top, run.yMillimeters + run.heightMillimeters);
      if (actual === expected)
        return {
          text: label,
          xMillimeters: left,
          yMillimeters: bottom,
          widthMillimeters: right - left,
          heightMillimeters: top - bottom,
        };
      if (!expected.startsWith(actual)) break;
    }
  }
  return undefined;
}

export function validatePdfEvidence(
  scenario: { expected: ExpectedPdfDocument },
  evidence: PdfEvidence,
): string[] {
  const mismatches: string[] = [];
  if (evidence.pageLabelState !== "default-physical")
    mismatches.push("PDF contains unexpected custom page-label metadata");
  if (evidence.pageCount !== scenario.expected.pageCount)
    mismatches.push(
      `expected ${scenario.expected.pageCount} pages, received ${evidence.pageCount}`,
    );
  for (let index = 0; index < scenario.expected.pages.length; index += 1) {
    const expected = scenario.expected.pages[index];
    const page = evidence.pages[index];
    if (!expected || !page) {
      mismatches.push(`physical page ${index + 1} is missing`);
      continue;
    }
    if (expected.marker && !page.text.includes(expected.marker))
      mismatches.push(`physical page ${index + 1} is missing marker ${expected.marker}`);
    for (const label of expected.pageNumberLabels) {
      const labelRun = findContiguousLabelRun(page, label);
      if (!labelRun) mismatches.push(`physical page ${index + 1} is missing label ${label}`);
      else if (
        expected.pageNumberRegion &&
        !runOccupiesRegion(labelRun, page, expected.pageNumberRegion)
      )
        mismatches.push(
          `physical page ${index + 1} label ${label} is outside ${expected.pageNumberRegion}`,
        );
    }
    const normalizedPageText = textWithoutWhitespace(page.text);
    for (const required of expected.requiredText ?? [])
      if (!normalizedPageText.includes(textWithoutWhitespace(required)))
        mismatches.push(`physical page ${index + 1} is missing required text ${required}`);
    for (const forbidden of expected.forbiddenText ?? [])
      if (normalizedPageText.includes(textWithoutWhitespace(forbidden)))
        mismatches.push(`physical page ${index + 1} contains forbidden text ${forbidden}`);
    const allMarkers = scenario.expected.pages
      .map((item) => item.marker)
      .filter((marker) => marker.length > 0);
    if (expected.role !== "table-of-contents")
      for (const unexpected of allMarkers.filter((marker) => marker !== expected.marker))
        if (page.text.includes(unexpected))
          mismatches.push(`physical page ${index + 1} contains out-of-order marker ${unexpected}`);
    const allLabels = scenario.expected.pages.flatMap((item) => item.pageNumberLabels);
    for (const unexpected of allLabels.filter(
      (label) => !expected.pageNumberLabels.includes(label),
    ))
      if (findContiguousLabelRun(page, unexpected))
        mismatches.push(`physical page ${index + 1} contains out-of-order label ${unexpected}`);
    const [expectedWidth, expectedHeight] = scenario.expected.sizeMillimeters;
    if (
      !nearlyEqual(page.widthMillimeters, expectedWidth) ||
      !nearlyEqual(page.heightMillimeters, expectedHeight)
    )
      mismatches.push(`physical page ${index + 1} has unexpected dimensions`);
    const orientation: PageOrientation =
      page.widthMillimeters > page.heightMillimeters ? "landscape" : "portrait";
    if (orientation !== scenario.expected.orientation)
      mismatches.push(`physical page ${index + 1} has unexpected orientation ${orientation}`);
  }
  return mismatches;
}

export const actualLaunchExpected = {
  pageCount: 3,
  pages: [
    { role: "document-body", marker: "LAUNCH-PAGE-1", label: "LAUNCH-PN-1/3" },
    { role: "document-body", marker: "LAUNCH-PAGE-2", label: "LAUNCH-PN-2/3" },
    { role: "document-body", marker: "LAUNCH-PAGE-3", label: "LAUNCH-PN-3/3" },
  ],
  sizeMillimeters: [148, 210] as const,
} as const;

export function validateActualLaunch(evidence: PdfEvidence): string[] {
  const mismatches: string[] = [];
  if (evidence.pageLabelState !== "default-physical")
    mismatches.push("PDF contains unexpected custom page-label metadata");
  if (evidence.pageCount !== actualLaunchExpected.pageCount)
    mismatches.push(`expected 3 actual-launch pages, received ${evidence.pageCount}`);
  for (let index = 0; index < actualLaunchExpected.pages.length; index += 1) {
    const expected = actualLaunchExpected.pages[index];
    const page = evidence.pages[index];
    if (!expected || !page) {
      mismatches.push(`actual-launch physical page ${index + 1} is missing`);
      continue;
    }
    if (!page.text.includes(expected.marker) || !page.text.includes(expected.label))
      mismatches.push(`actual-launch physical page ${index + 1} has incorrect marker or label`);
    for (const other of actualLaunchExpected.pages.filter((_, otherIndex) => otherIndex !== index))
      if (page.text.includes(other.marker) || page.text.includes(other.label))
        mismatches.push(`actual-launch physical page ${index + 1} is out of order`);
    if (
      !nearlyEqual(page.widthMillimeters, actualLaunchExpected.sizeMillimeters[0]) ||
      !nearlyEqual(page.heightMillimeters, actualLaunchExpected.sizeMillimeters[1])
    )
      mismatches.push(`actual-launch physical page ${index + 1} has unexpected dimensions`);
  }
  return mismatches;
}

export function extractionSummary(
  evidence: PdfEvidence,
  expectedPages: readonly ExpectedPhysicalPage[],
  counterEvidencePattern?: CounterEvidencePattern,
): PdfExtractionSummary {
  const scenarioMarkers = expectedPages.map((page) => page.marker).filter(Boolean);
  return {
    pageCount: evidence.pageCount,
    dimensionsMillimeters: evidence.pages.map((page) => ({
      width: Number(page.widthMillimeters.toFixed(3)),
      height: Number(page.heightMillimeters.toFixed(3)),
    })),
    labelsByPhysicalPage: evidence.pages.map((page, index) =>
      [...(expectedPages[index]?.pageNumberLabels ?? [])].filter((label) =>
        findContiguousLabelRun(page, label),
      ),
    ),
    pageRolesByPhysicalPage: evidence.pages.map((page, index) => {
      const expected = expectedPages[index];
      if (!expected) return "unidentified";
      if (expected.marker)
        return page.text.includes(expected.marker) ? expected.role : "unidentified";
      return scenarioMarkers.some((marker) => page.text.includes(marker))
        ? "unidentified"
        : expected.role;
    }),
    counterValuesByPhysicalPage: evidence.pages.map((page) =>
      extractCounterValues(page.text, counterEvidencePattern),
    ),
    pageLabelState: evidence.pageLabelState,
  };
}

function extractCounterValues(
  text: string,
  pattern?: CounterEvidencePattern,
): ExpectedCounterValues | null {
  if (!pattern) return null;
  const normalizedText = text.replace(/\s+/gu, "");
  if (!normalizedText.includes(pattern.marker)) return null;
  const groups = new RegExp(pattern.source, "u").exec(normalizedText)?.groups;
  const page = groups?.page;
  const pages = groups?.pages;
  const pdfPage = groups?.pdfPage;
  const pdfPages = groups?.pdfPages;
  if (page === undefined || pages === undefined || pdfPage === undefined || pdfPages === undefined)
    return null;
  return {
    page: Number.parseInt(page, 10),
    pages: Number.parseInt(pages, 10),
    pdfPage: Number.parseInt(pdfPage, 10),
    pdfPages: Number.parseInt(pdfPages, 10),
  };
}

export function assessOnePassCounterEvidence(
  extraction: PdfExtractionSummary,
  expectedPages: readonly ExpectedPhysicalPage[],
  tokenAssertionsPassed = true,
): OnePassCounterAssessment {
  const expectedPhysicalPages = expectedPages.flatMap((page, index) =>
    page.counterValues ? [index + 1] : [],
  );
  const matchingPhysicalPages: number[] = [];
  const mismatches: string[] = [];
  const fields = ["page", "pages", "pdfPage", "pdfPages"] as const;
  for (const [index, expectedPage] of expectedPages.entries()) {
    const physicalPage = index + 1;
    const expected = expectedPage.counterValues;
    const actual = extraction.counterValuesByPhysicalPage[index];
    if (!expected) {
      if (actual) mismatches.push(`physical page ${physicalPage} has unexpected counter evidence`);
      continue;
    }
    if (!actual) {
      mismatches.push(`physical page ${physicalPage} is missing counter evidence`);
      continue;
    }
    const pageMismatches = fields.flatMap((field) =>
      actual[field] === expected[field]
        ? []
        : [
            `physical page ${physicalPage} ${field} expected ${expected[field]}, received ${actual[field]}`,
          ],
    );
    if (pageMismatches.length === 0) matchingPhysicalPages.push(physicalPage);
    else mismatches.push(...pageMismatches);
  }
  if (!tokenAssertionsPassed) mismatches.push("rendered label assertions failed");
  const allCounterValuesMatch =
    expectedPhysicalPages.length > 0 &&
    matchingPhysicalPages.length === expectedPhysicalPages.length &&
    mismatches.length === 0;
  return {
    mechanism: "one-pass",
    expectedPhysicalPages,
    matchingPhysicalPages,
    allCounterValuesMatch,
    evidencePassed: allCounterValuesMatch,
    mismatches,
  };
}
