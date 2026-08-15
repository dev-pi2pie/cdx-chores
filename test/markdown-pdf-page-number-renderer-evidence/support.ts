import { writeFile } from "node:fs/promises";
import { normalize, sep } from "node:path";
import { deflateSync } from "node:zlib";

import type {
  CommandRequest,
  CommandResult,
  PdfEvidence,
  PdfTextRunEvidence,
} from "../../scripts/spikes/markdown-pdf-page-number-renderer-evidence";
import {
  PAGE_NUMBER_COUNTER_EXPERIMENTS,
  PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
  PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
  PAGE_NUMBER_RENDERER_SCENARIOS,
  WEASYPRINT_CANDIDATES,
} from "../fixtures/markdown-pdf/page-number-renderer-contract";
import type {
  ProductRendererScenario,
  ProjectRendererScenario,
  RendererContractScenario,
} from "../fixtures/markdown-pdf/page-number-renderer-contract";
import { withTempFixtureDir } from "../helpers/cli-test-utils";

export interface MockExecutionOptions {
  fail?: (request: CommandRequest) => CommandResult | undefined;
  corruptPng?: boolean;
  skipPng?: boolean;
  inspect?: (path: string, expected: PdfEvidence) => PdfEvidence;
}

export function evidenceRun(
  text: string,
  xMillimeters: number,
  yMillimeters: number,
  widthMillimeters: number,
  heightMillimeters: number,
): PdfTextRunEvidence {
  return { text, xMillimeters, yMillimeters, widthMillimeters, heightMillimeters };
}

function expectedScenarioEvidence(
  scenario: RendererContractScenario | ProductRendererScenario | ProjectRendererScenario,
): PdfEvidence {
  const [widthMillimeters, heightMillimeters] = scenario.expected.sizeMillimeters;
  return {
    pageCount: scenario.expected.pageCount,
    pageLabelState: "default-physical",
    pages: scenario.expected.pages.map((page) => {
      const labelRuns = page.pageNumberLabels.map((label) =>
        evidenceRun(
          label,
          page.pageNumberRegion === "bottom-center" ? 60 : 110,
          page.pageNumberRegion === "top-right" ? 190 : 10,
          28,
          4,
        ),
      );
      return {
        text: [page.marker, ...page.pageNumberLabels].filter(Boolean).join(" "),
        runs: [evidenceRun(page.marker, 20, 100, 40, 5), ...labelRuns].filter(
          (run) => run.text.length > 0,
        ),
        widthMillimeters,
        heightMillimeters,
      };
    }),
  };
}

function expectedActualLaunchEvidence(): PdfEvidence {
  return {
    pageCount: 3,
    pageLabelState: "default-physical",
    pages: [1, 2, 3].map((pageNumber) => ({
      text: `LAUNCH-PAGE-${pageNumber} LAUNCH-PN-${pageNumber}/3`,
      runs: [
        evidenceRun(`LAUNCH-PAGE-${pageNumber}`, 20, 100, 40, 5),
        evidenceRun(`LAUNCH-PN-${pageNumber}/3`, 60, 10, 28, 4),
      ],
      widthMillimeters: 148,
      heightMillimeters: 210,
    })),
  };
}

export function pathHasSegment(path: string, segment: string): boolean {
  return normalize(path).split(sep).includes(segment);
}

function crc32(contents: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of contents) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return chunk;
}

export function mockPng(imageData = deflateSync(Buffer.from([0, 0]))): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", imageData),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function createMockExecution(options: MockExecutionOptions = {}) {
  const requests: CommandRequest[] = [];
  const runner = async (request: CommandRequest): Promise<CommandResult> => {
    requests.push(request);
    const failed = options.fail?.(request);
    if (failed) return failed;
    if (request.stage === "png-render" && !options.skipPng) {
      const pngBase = request.argv.at(-1);
      if (!pngBase) throw new Error("mock png request has no output base");
      await writeFile(
        `${pngBase}.png`,
        options.corruptPng ? Buffer.from("not-a-png", "utf8") : mockPng(),
      );
    }
    if (request.stage === "environment-inspection") {
      const candidate = WEASYPRINT_CANDIDATES.find((item) =>
        request.argv.some((argument) => argument.includes(item.id)),
      );
      if (!candidate) throw new Error("mock candidate is missing");
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          python: "3.13.7",
          weasyprint: candidate.weasyPrintVersion,
          pydyf: candidate.dependencies.pydyf,
          fontTools: candidate.dependencies.fontTools,
          pango: "1.56.4",
        }),
        stderr: "",
      };
    }
    if (request.stage === "doctor") {
      const candidate = WEASYPRINT_CANDIDATES.find((item) =>
        request.env?.PATH?.split(process.platform === "win32" ? ";" : ":")[0]?.includes(item.id),
      );
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          tools: { weasyprint: { version: candidate?.weasyPrintVersion } },
        }),
        stderr: "",
      };
    }
    return { exitCode: 0, stdout: "", stderr: "" };
  };
  const inspectPdf = async (path: string): Promise<PdfEvidence> => {
    const scenario = [
      ...PAGE_NUMBER_RENDERER_SCENARIOS,
      ...PAGE_NUMBER_COUNTER_EXPERIMENTS,
      ...PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
      ...PAGE_NUMBER_PROJECT_RENDERER_SCENARIOS,
    ].find((item) => pathHasSegment(path, item.id));
    const expected = scenario ? expectedScenarioEvidence(scenario) : expectedActualLaunchEvidence();
    return options.inspect?.(path, expected) ?? expected;
  };
  return { runner, inspectPdf, requests };
}

export async function withEvidenceRoot(
  callback: (temporaryRoot: string) => Promise<void>,
): Promise<void> {
  await withTempFixtureDir("page-number-renderer-evidence", callback);
}

export function minimalPdf(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 36 540 Td (${text}) Tj ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 419.5276 595.2756] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(output));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, "ascii");
}
