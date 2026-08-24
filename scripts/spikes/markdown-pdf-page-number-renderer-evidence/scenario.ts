import { readFile, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { inflateSync } from "node:zlib";

import type {
  CommandRunner,
  EvidenceFailure,
  EvidenceStage,
  PdfEvidence,
  PdfExtractionSummary,
  PdfInspector,
  TemporaryImageEvidence,
} from "./contract";
import type { WeasyPrintCandidate } from "../../../test/fixtures/markdown-pdf/page-number-renderer-contract";
import { commandRequest, runChecked } from "./subprocess";
import { publicSafeText } from "./pdf";

export function contractFailure(
  stage: EvidenceStage,
  message: string,
  candidateId?: WeasyPrintCandidate["id"],
  scenarioId?: string,
): EvidenceFailure {
  return { stage, classification: "contract-failure", message, candidateId, scenarioId };
}

function crc32(contents: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of contents) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(contents: Buffer): void {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (
    contents.length < signature.length ||
    !contents.subarray(0, signature.length).equals(signature)
  )
    throw new Error("invalid PNG signature");
  let offset = signature.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let sawHeader = false;
  let sawEnd = false;
  const imageData: Buffer[] = [];
  while (offset < contents.length) {
    if (contents.length - offset < 12) throw new Error("truncated PNG chunk header");
    const length = contents.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > contents.length) throw new Error("truncated PNG chunk payload");
    const type = contents.subarray(typeStart, dataStart).toString("ascii");
    const data = contents.subarray(dataStart, dataEnd);
    if (crc32(contents.subarray(typeStart, dataEnd)) !== contents.readUInt32BE(dataEnd))
      throw new Error(`invalid PNG ${type} checksum`);
    if (!sawHeader && type !== "IHDR") throw new Error("PNG must begin with IHDR");
    if (type === "IHDR") {
      if (sawHeader || length !== 13) throw new Error("invalid PNG IHDR");
      sawHeader = true;
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? -1;
      const validDepths: Record<number, readonly number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      if (
        width === 0 ||
        height === 0 ||
        !validDepths[colorType]?.includes(bitDepth) ||
        data[10] !== 0 ||
        data[11] !== 0 ||
        data[12] !== 0
      )
        throw new Error("invalid or unsupported PNG IHDR values");
    } else if (type === "IDAT") {
      if (!sawHeader || sawEnd || length === 0) throw new Error("invalid PNG IDAT");
      imageData.push(data);
    } else if (type === "IEND") {
      if (!sawHeader || sawEnd || length !== 0 || chunkEnd !== contents.length)
        throw new Error("invalid PNG IEND");
      sawEnd = true;
    }
    offset = chunkEnd;
  }
  if (!sawHeader || imageData.length === 0 || !sawEnd)
    throw new Error("PNG is missing required chunks");
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (!channels) throw new Error("unsupported PNG color type");
  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  const decoded = inflateSync(Buffer.concat(imageData));
  if (decoded.length !== height * (rowBytes + 1))
    throw new Error("PNG scanline data has unexpected length");
  for (let row = 0; row < height; row += 1)
    if ((decoded[row * (rowBytes + 1)] ?? 5) > 4)
      throw new Error("PNG scanline uses an invalid filter");
}

async function assertPngEvidence(paths: readonly string[]): Promise<string[]> {
  const mismatches: string[] = [];
  for (const path of paths) {
    try {
      const contents = await readFile(path);
      if (contents.length <= 0) mismatches.push(`${basename(path)} is empty`);
      else validatePng(contents);
    } catch {
      try {
        await readFile(path);
        mismatches.push(`${basename(path)} is not a valid PNG`);
      } catch {
        mismatches.push(`${basename(path)} is missing`);
      }
    }
  }
  return mismatches;
}

export interface RenderedScenarioEvidenceInput {
  runner: CommandRunner;
  pdfInspector: PdfInspector;
  failures: EvidenceFailure[];
  candidateId: WeasyPrintCandidate["id"];
  scenarioId: string;
  outputDirectory: string;
  renderStage: Extract<EvidenceStage, "actual-launch" | "contract-render">;
  extractionStage: Extract<EvidenceStage, "actual-launch-extraction" | "contract-extraction">;
  renderArgv: (pdfPath: string) => readonly string[];
  pngPages: readonly number[];
  validate: (evidence: PdfEvidence) => string[];
  summarize: (evidence: PdfEvidence) => PdfExtractionSummary;
  temporaryImages: TemporaryImageEvidence[];
  onExtraction: (summary: PdfExtractionSummary) => void;
  env?: NodeJS.ProcessEnv;
}

export async function runRenderedScenarioEvidence(
  input: RenderedScenarioEvidenceInput,
): Promise<boolean> {
  await mkdir(input.outputDirectory, { recursive: true });
  const pdfPath = join(input.outputDirectory, "output.pdf");
  const rendered = await runChecked(
    input.runner,
    commandRequest(input.renderStage, input.renderArgv(pdfPath), {
      candidateId: input.candidateId,
      scenarioId: input.scenarioId,
      ...(input.env ? { env: input.env } : {}),
    }),
  );
  if (rendered.failure) {
    input.failures.push(rendered.failure);
    return false;
  }
  let mismatches: string[];
  try {
    const evidence = await input.pdfInspector(pdfPath);
    mismatches = input.validate(evidence);
    input.onExtraction(input.summarize(evidence));
  } catch (error) {
    input.failures.push({
      stage: input.extractionStage,
      classification: "setup-failure",
      candidateId: input.candidateId,
      scenarioId: input.scenarioId,
      message: publicSafeText(error instanceof Error ? error.message : String(error)),
    });
    return false;
  }
  const pngPaths: string[] = [];
  let pngCommandFailed = false;
  for (const pageNumber of input.pngPages) {
    const pngBase = join(input.outputDirectory, `page-${pageNumber}`);
    const pngPath = `${pngBase}.png`;
    pngPaths.push(pngPath);
    input.temporaryImages.push({
      candidateId: input.candidateId,
      scenarioId: input.scenarioId,
      physicalPage: pageNumber,
      path: pngPath,
    });
    const renderedPng = await runChecked(
      input.runner,
      commandRequest(
        "png-render",
        [
          "pdftoppm",
          "-png",
          "-f",
          String(pageNumber),
          "-l",
          String(pageNumber),
          "-singlefile",
          pdfPath,
          pngBase,
        ],
        { candidateId: input.candidateId, scenarioId: input.scenarioId },
      ),
    );
    if (renderedPng.failure) {
      input.failures.push(renderedPng.failure);
      pngCommandFailed = true;
    }
  }
  if (!pngCommandFailed) mismatches.push(...(await assertPngEvidence(pngPaths)));
  if (mismatches.length > 0)
    input.failures.push(
      contractFailure(
        input.extractionStage,
        mismatches.join("; "),
        input.candidateId,
        input.scenarioId,
      ),
    );
  return mismatches.length === 0 && !pngCommandFailed;
}
