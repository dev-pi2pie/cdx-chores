import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { devNull, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  materializePageNumberRendererContract,
  PAGE_NUMBER_AUTOMATED_EVIDENCE,
  PAGE_NUMBER_BODY_HOOK_CASES,
  PAGE_NUMBER_LAB_MARKER_CONTENT,
  PAGE_NUMBER_LAB_MARKER_NAME,
  PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS,
  PAGE_NUMBER_RENDERER_SCENARIOS,
  WEASYPRINT_CANDIDATES,
} from "../../test/fixtures/markdown-pdf/page-number-renderer-contract";
import type {
  ExpectedPdfDocument,
  PageNumberRegion,
  PageOrientation,
  ProductRendererScenario,
  RendererContractScenario,
  WeasyPrintCandidate,
} from "../../test/fixtures/markdown-pdf/page-number-renderer-contract";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "../..");
const labPrefix = "cdx-chores-weasyprint-matrix-";
const reportName = "renderer-evidence-report.json";
const maximumOutputBytes = 64 * 1024;
const commandTimeoutMs = 120_000;

const harnessContract = {
  version: 3,
  candidates: WEASYPRINT_CANDIDATES.map((candidate) => candidate.id),
  productScenarios: PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.map((scenario) => scenario.id),
  stages: [
    "setup",
    "dependency-install",
    "environment-inspection",
    "contract-render",
    "contract-extraction",
    "png-render",
    "doctor",
    "actual-launch",
    "actual-launch-extraction",
    "cleanup",
  ],
  timeoutMs: commandTimeoutMs,
  maximumOutputBytes,
} as const;

export const PAGE_NUMBER_RENDERER_HARNESS_DIGEST = createHash("sha256")
  .update(JSON.stringify(harnessContract))
  .digest("hex");

export type EvidenceStage = (typeof harnessContract.stages)[number] | "initialization";

export type EvidenceClassification =
  | "contract-failure"
  | "dependency-failure"
  | "executable-launch-failure"
  | "font-discovery-failure"
  | "native-library-failure"
  | "pass"
  | "setup-failure";

export interface CommandRequest {
  argv: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  maximumOutputBytes: number;
  stage: EvidenceStage;
  candidateId?: WeasyPrintCandidate["id"];
  scenarioId?: string;
}

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  errorCode?: string;
  timedOut?: boolean;
  outputTruncated?: boolean;
}

export type CommandRunner = (request: CommandRequest) => Promise<CommandResult>;

export interface PdfPageEvidence {
  text: string;
  runs: readonly PdfTextRunEvidence[];
  widthMillimeters: number;
  heightMillimeters: number;
}

export interface PdfTextRunEvidence {
  text: string;
  xMillimeters: number;
  yMillimeters: number;
  widthMillimeters: number;
  heightMillimeters: number;
}

export interface PdfEvidence {
  pageCount: number;
  pages: readonly PdfPageEvidence[];
}

export type PdfInspector = (pdfPath: string) => Promise<PdfEvidence>;

export interface EvidenceFailure {
  candidateId?: WeasyPrintCandidate["id"];
  scenarioId?: string;
  stage: EvidenceStage;
  classification: Exclude<EvidenceClassification, "pass">;
  message: string;
}

export interface CandidateEvidence {
  candidateId: WeasyPrintCandidate["id"];
  weasyPrintVersion: string;
  environment?: Record<string, string>;
  scenarios: Array<{ id: string; passed: boolean }>;
  doctorPassed: boolean;
  actualLaunchPassed: boolean;
  productScenarios: Array<{ id: string; passed: boolean }>;
}

export interface BodyHookEvidence {
  id: string;
  actual: "hard-error" | "supported" | "warning-fallback";
  expected: "hard-error" | "supported" | "warning-fallback";
  passed: boolean;
}

export interface RendererEvidenceReport {
  schemaVersion: 2;
  catalogDigest: string;
  harnessDigest: string;
  outcome: "failed" | "inconclusive" | "passed";
  evidenceStatus: "complete" | "visual-review-required";
  retained: boolean;
  labPath: string;
  bodyHooks: BodyHookEvidence[];
  candidates: CandidateEvidence[];
  failures: EvidenceFailure[];
  evidenceBoundary: {
    automated: readonly string[];
    visualReviewRequired: Array<{ scenarioId: string; assertions: readonly string[] }>;
  };
}

export interface RunRendererEvidenceOptions {
  keep?: boolean;
  pythonExecutable?: string;
  temporaryRoot?: string;
  uniqueId?: string;
  runner?: CommandRunner;
  inspectPdf?: PdfInspector;
  materializeContract?: typeof materializePageNumberRendererContract;
  initializeMarker?: (markerPath: string) => Promise<void>;
}

export function safeSubprocessEnvironment(pathPrefix?: string): NodeJS.ProcessEnv {
  const delimiter = process.platform === "win32" ? ";" : ":";
  const inheritedKeys = [
    "COMSPEC",
    "DYLD_FALLBACK_LIBRARY_PATH",
    "LANG",
    "LC_ALL",
    "LD_LIBRARY_PATH",
    "REQUESTS_CA_BUNDLE",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "SYSTEMROOT",
    "TMPDIR",
    "WINDIR",
  ] as const;
  const environment: NodeJS.ProcessEnv = {
    PATH: pathPrefix
      ? `${pathPrefix}${delimiter}${process.env.PATH ?? ""}`
      : (process.env.PATH ?? ""),
    PIP_CONFIG_FILE: devNull,
    PIP_DISABLE_PIP_VERSION_CHECK: "1",
    PIP_NO_INPUT: "1",
    PYTHONNOUSERSITE: "1",
  };
  for (const key of inheritedKeys) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  return environment;
}

function truncateOutput(value: string): { value: string; truncated: boolean } {
  const bytes = Buffer.from(value);
  if (bytes.byteLength <= maximumOutputBytes) {
    return { value, truncated: false };
  }
  return {
    value: Buffer.from(bytes.subarray(0, maximumOutputBytes)).toString("utf8"),
    truncated: true,
  };
}

export const defaultCommandRunner: CommandRunner = async (request) => {
  const executable = request.argv[0];
  if (!executable) throw new Error("Command request must include an executable.");
  const result = spawnSync(executable, request.argv.slice(1), {
    cwd: request.cwd,
    env: request.env,
    encoding: "utf8",
    timeout: request.timeoutMs,
    maxBuffer: request.maximumOutputBytes,
    windowsHide: true,
  });
  const stdout = truncateOutput(result.stdout ?? "");
  const stderr = truncateOutput(result.stderr ?? "");
  return {
    exitCode: result.status,
    stdout: stdout.value,
    stderr: stderr.value,
    errorCode: (result.error as NodeJS.ErrnoException | undefined)?.code,
    timedOut: result.error?.name === "ETIMEDOUT",
    outputTruncated:
      stdout.truncated ||
      stderr.truncated ||
      (result.error as NodeJS.ErrnoException | undefined)?.code === "ENOBUFS",
  };
};

function commandRequest(
  stage: EvidenceStage,
  argv: readonly string[],
  input: Partial<Pick<CommandRequest, "candidateId" | "scenarioId" | "env">> = {},
): CommandRequest {
  return {
    argv,
    cwd: repoRoot,
    timeoutMs: commandTimeoutMs,
    maximumOutputBytes,
    stage,
    env: safeSubprocessEnvironment(),
    ...input,
  };
}

function commandFailure(
  request: CommandRequest,
  result: CommandResult,
): EvidenceFailure | undefined {
  if (result.exitCode === 0 && !result.timedOut && !result.outputTruncated) {
    return undefined;
  }
  const detail = `${result.stderr}\n${result.stdout}`;
  let classification: EvidenceFailure["classification"];
  if (["EACCES", "ENOENT", "ENOEXEC"].includes(result.errorCode ?? "")) {
    classification = "executable-launch-failure";
  } else if (/fontconfig|font discovery|fontconfig error|no fonts?/iu.test(detail)) {
    classification = "font-discovery-failure";
  } else if (/pango|cairo|gobject|harfbuzz|native librar/iu.test(detail)) {
    classification = "native-library-failure";
  } else if (request.stage === "dependency-install" || request.stage === "environment-inspection") {
    classification = "dependency-failure";
  } else if (request.stage === "contract-render") {
    classification = "contract-failure";
  } else if (
    request.stage === "doctor" ||
    request.stage === "actual-launch" ||
    request.stage === "png-render"
  ) {
    classification = "executable-launch-failure";
  } else {
    classification = "setup-failure";
  }
  const condition = result.timedOut
    ? "timed out"
    : result.outputTruncated
      ? "exceeded bounded output"
      : `exited ${result.exitCode ?? "without status"}`;
  return {
    stage: request.stage,
    classification,
    candidateId: request.candidateId,
    scenarioId: request.scenarioId,
    message: `${basename(request.argv[0] ?? "command")} ${condition}`,
  };
}

async function runChecked(
  runner: CommandRunner,
  request: CommandRequest,
): Promise<{ result: CommandResult; failure?: EvidenceFailure }> {
  let result: CommandResult;
  try {
    result = await runner(request);
  } catch (error) {
    const commandError = error as NodeJS.ErrnoException;
    result = {
      exitCode: null,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      errorCode: commandError.code,
    };
  }
  return { result, failure: commandFailure(request, result) };
}

function environmentExecutable(environmentDirectory: string, command: string): string {
  return process.platform === "win32"
    ? join(environmentDirectory, "Scripts", `${command}.exe`)
    : join(environmentDirectory, "bin", command);
}

function candidateEnvironmentScript(): string {
  return [
    "import json, platform",
    "import fontTools, pydyf, weasyprint",
    "from weasyprint.text.ffi import pango",
    "print(json.dumps({",
    '  "python": platform.python_version(),',
    '  "weasyprint": weasyprint.__version__,',
    '  "pydyf": pydyf.__version__,',
    '  "fontTools": fontTools.__version__,',
    '  "pango": ".".join(str(part) for part in (lambda value: (value // 10000, (value // 100) % 100, value % 100))(pango.pango_version())),',
    "}, sort_keys=True))",
  ].join("\n");
}

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
    return { pageCount: document.numPages, pages };
  } finally {
    await loadingTask.destroy();
  }
};

export async function inspectBodyHookCases(
  bodyHookPaths?: Readonly<Record<string, string>>,
): Promise<BodyHookEvidence[]> {
  return Promise.all(
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

function normalizedLabelText(value: string): string {
  return value.replace(/\s+/gu, "");
}

function findContiguousLabelRun(
  page: PdfPageEvidence,
  label: string,
): PdfTextRunEvidence | undefined {
  const expected = normalizedLabelText(label);
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
      actual += normalizedLabelText(run.text);
      left = Math.min(left, run.xMillimeters);
      bottom = Math.min(bottom, run.yMillimeters);
      right = Math.max(right, run.xMillimeters + run.widthMillimeters);
      top = Math.max(top, run.yMillimeters + run.heightMillimeters);
      if (actual === expected) {
        return {
          text: label,
          xMillimeters: left,
          yMillimeters: bottom,
          widthMillimeters: right - left,
          heightMillimeters: top - bottom,
        };
      }
      if (!expected.startsWith(actual)) break;
    }
  }
  return undefined;
}

function validatePdfEvidence(
  scenario: { expected: ExpectedPdfDocument },
  evidence: PdfEvidence,
): string[] {
  const mismatches: string[] = [];
  if (evidence.pageCount !== scenario.expected.pageCount) {
    mismatches.push(
      `expected ${scenario.expected.pageCount} pages, received ${evidence.pageCount}`,
    );
  }
  for (let index = 0; index < scenario.expected.pages.length; index += 1) {
    const expected = scenario.expected.pages[index];
    const page = evidence.pages[index];
    if (!expected || !page) {
      mismatches.push(`physical page ${index + 1} is missing`);
      continue;
    }
    if (expected.marker && !page.text.includes(expected.marker)) {
      mismatches.push(`physical page ${index + 1} is missing marker ${expected.marker}`);
    }
    for (const label of expected.pageNumberLabels) {
      const labelRun = findContiguousLabelRun(page, label);
      if (!labelRun) {
        mismatches.push(`physical page ${index + 1} is missing label ${label}`);
      } else if (
        expected.pageNumberRegion &&
        !runOccupiesRegion(labelRun, page, expected.pageNumberRegion)
      ) {
        mismatches.push(
          `physical page ${index + 1} label ${label} is outside ${expected.pageNumberRegion}`,
        );
      }
    }
    for (const forbidden of expected.forbiddenText ?? []) {
      if (page.text.includes(forbidden)) {
        mismatches.push(`physical page ${index + 1} contains forbidden text ${forbidden}`);
      }
    }
    const allLabels = scenario.expected.pages.flatMap((item) => item.pageNumberLabels);
    for (const unexpected of allLabels.filter(
      (label) => !expected.pageNumberLabels.includes(label),
    )) {
      if (findContiguousLabelRun(page, unexpected)) {
        mismatches.push(`physical page ${index + 1} contains out-of-order label ${unexpected}`);
      }
    }
    const [expectedWidth, expectedHeight] = scenario.expected.sizeMillimeters;
    if (
      !nearlyEqual(page.widthMillimeters, expectedWidth) ||
      !nearlyEqual(page.heightMillimeters, expectedHeight)
    ) {
      mismatches.push(`physical page ${index + 1} has unexpected dimensions`);
    }
    const orientation: PageOrientation =
      page.widthMillimeters > page.heightMillimeters ? "landscape" : "portrait";
    if (orientation !== scenario.expected.orientation) {
      mismatches.push(`physical page ${index + 1} has unexpected orientation ${orientation}`);
    }
  }
  return mismatches;
}

const actualLaunchExpected = {
  pageCount: 3,
  pages: [
    { marker: "LAUNCH-PAGE-1", label: "LAUNCH-PN-1/3" },
    { marker: "LAUNCH-PAGE-2", label: "LAUNCH-PN-2/3" },
    { marker: "LAUNCH-PAGE-3", label: "LAUNCH-PN-3/3" },
  ],
  sizeMillimeters: [148, 210] as const,
};

function validateActualLaunch(evidence: PdfEvidence): string[] {
  const mismatches: string[] = [];
  if (evidence.pageCount !== actualLaunchExpected.pageCount) {
    mismatches.push(`expected 3 actual-launch pages, received ${evidence.pageCount}`);
  }
  for (let index = 0; index < actualLaunchExpected.pages.length; index += 1) {
    const expected = actualLaunchExpected.pages[index];
    const page = evidence.pages[index];
    if (!expected || !page) {
      mismatches.push(`actual-launch physical page ${index + 1} is missing`);
      continue;
    }
    if (!page.text.includes(expected.marker) || !page.text.includes(expected.label)) {
      mismatches.push(`actual-launch physical page ${index + 1} has incorrect marker or label`);
    }
    for (const other of actualLaunchExpected.pages.filter(
      (_, otherIndex) => otherIndex !== index,
    )) {
      if (page.text.includes(other.marker) || page.text.includes(other.label)) {
        mismatches.push(`actual-launch physical page ${index + 1} is out of order`);
      }
    }
    if (
      !nearlyEqual(page.widthMillimeters, actualLaunchExpected.sizeMillimeters[0]) ||
      !nearlyEqual(page.heightMillimeters, actualLaunchExpected.sizeMillimeters[1])
    ) {
      mismatches.push(`actual-launch physical page ${index + 1} has unexpected dimensions`);
    }
  }
  return mismatches;
}

export async function initializeEvidenceLaboratory(
  options: Pick<RunRendererEvidenceOptions, "temporaryRoot" | "uniqueId" | "initializeMarker"> = {},
): Promise<string> {
  const temporaryRoot = await realpath(options.temporaryRoot ?? tmpdir());
  const labRoot = join(temporaryRoot, `${labPrefix}${options.uniqueId ?? randomUUID()}`);
  await mkdir(labRoot);
  try {
    const markerPath = join(labRoot, PAGE_NUMBER_LAB_MARKER_NAME);
    if (options.initializeMarker) {
      await options.initializeMarker(markerPath);
    } else {
      await writeFile(markerPath, PAGE_NUMBER_LAB_MARKER_CONTENT, { encoding: "utf8", flag: "wx" });
    }
    if ((await readFile(markerPath, "utf8")) !== PAGE_NUMBER_LAB_MARKER_CONTENT) {
      throw new Error("Ownership marker verification failed.");
    }
    return await realpath(labRoot);
  } catch (error) {
    await rm(labRoot, { recursive: true, force: true });
    throw error;
  }
}

async function assertSafeLaboratory(labPath: string, temporaryRoot = tmpdir()): Promise<string> {
  const canonicalTemporaryRoot = await realpath(temporaryRoot);
  const canonicalLab = await realpath(labPath);
  const relativePath = relative(canonicalTemporaryRoot, canonicalLab);
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath) ||
    dirname(canonicalLab) !== canonicalTemporaryRoot ||
    !basename(canonicalLab).startsWith(labPrefix) ||
    (await lstat(canonicalLab)).isSymbolicLink()
  ) {
    throw new Error("Refusing to clean an unsafe renderer-evidence laboratory path.");
  }
  let marker: string;
  try {
    marker = await readFile(join(canonicalLab, PAGE_NUMBER_LAB_MARKER_NAME), "utf8");
  } catch {
    throw new Error("Refusing to clean a renderer-evidence laboratory without its marker.");
  }
  if (marker !== PAGE_NUMBER_LAB_MARKER_CONTENT) {
    throw new Error("Refusing to clean a renderer-evidence laboratory with a foreign marker.");
  }
  return canonicalLab;
}

export async function closeRetainedEvidenceLaboratory(
  labPath: string,
  temporaryRoot = tmpdir(),
): Promise<void> {
  const canonicalLab = await assertSafeLaboratory(labPath, temporaryRoot);
  const detachedPath = join(
    dirname(canonicalLab),
    `.${basename(canonicalLab)}.cleanup-${randomUUID()}`,
  );
  await rename(canonicalLab, detachedPath);
  try {
    const detached = await lstat(detachedPath);
    const marker = await readFile(join(detachedPath, PAGE_NUMBER_LAB_MARKER_NAME), "utf8");
    if (
      !detached.isDirectory() ||
      detached.isSymbolicLink() ||
      marker !== PAGE_NUMBER_LAB_MARKER_CONTENT
    ) {
      throw new Error("Refusing to remove a detached laboratory whose ownership changed.");
    }
  } catch (error) {
    try {
      await rename(detachedPath, canonicalLab);
    } catch {
      throw new Error("Detached laboratory ownership changed and restoration failed.", {
        cause: error,
      });
    }
    throw error;
  }
  await rm(detachedPath, { recursive: true });
}

function contractFailure(
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
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(contents: Buffer): void {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (
    contents.length < signature.length ||
    !contents.subarray(0, signature.length).equals(signature)
  ) {
    throw new Error("invalid PNG signature");
  }

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
    if (crc32(contents.subarray(typeStart, dataEnd)) !== contents.readUInt32BE(dataEnd)) {
      throw new Error(`invalid PNG ${type} checksum`);
    }
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
      ) {
        throw new Error("invalid or unsupported PNG IHDR values");
      }
    } else if (type === "IDAT") {
      if (!sawHeader || sawEnd || length === 0) throw new Error("invalid PNG IDAT");
      imageData.push(data);
    } else if (type === "IEND") {
      if (!sawHeader || sawEnd || length !== 0 || chunkEnd !== contents.length) {
        throw new Error("invalid PNG IEND");
      }
      sawEnd = true;
    }
    offset = chunkEnd;
  }
  if (!sawHeader || imageData.length === 0 || !sawEnd) {
    throw new Error("PNG is missing required chunks");
  }

  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (!channels) throw new Error("unsupported PNG color type");
  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  const decoded = inflateSync(Buffer.concat(imageData));
  if (decoded.length !== height * (rowBytes + 1)) {
    throw new Error("PNG scanline data has unexpected length");
  }
  for (let row = 0; row < height; row += 1) {
    if ((decoded[row * (rowBytes + 1)] ?? 5) > 4) {
      throw new Error("PNG scanline uses an invalid filter");
    }
  }
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

interface RenderedScenarioEvidenceInput {
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
  env?: NodeJS.ProcessEnv;
}

async function runRenderedScenarioEvidence(input: RenderedScenarioEvidenceInput): Promise<boolean> {
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
    mismatches = input.validate(await input.pdfInspector(pdfPath));
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
    pngPaths.push(`${pngBase}.png`);
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
  if (mismatches.length > 0) {
    input.failures.push(
      contractFailure(
        input.extractionStage,
        mismatches.join("; "),
        input.candidateId,
        input.scenarioId,
      ),
    );
  }
  return mismatches.length === 0 && !pngCommandFailed;
}

export async function runRendererEvidence(
  options: RunRendererEvidenceOptions = {},
): Promise<RendererEvidenceReport> {
  const labRoot = await initializeEvidenceLaboratory(options);
  try {
    return await runRendererEvidenceInLaboratory(options, labRoot);
  } catch (error) {
    if (options.keep !== true) {
      await closeRetainedEvidenceLaboratory(labRoot, options.temporaryRoot);
    }
    throw error;
  }
}

async function runRendererEvidenceInLaboratory(
  options: RunRendererEvidenceOptions,
  labRoot: string,
): Promise<RendererEvidenceReport> {
  const runner = options.runner ?? defaultCommandRunner;
  const pdfInspector = options.inspectPdf ?? inspectPdf;
  const failures: EvidenceFailure[] = [];
  const candidates: CandidateEvidence[] = [];
  const contract = await (options.materializeContract ?? materializePageNumberRendererContract)(
    labRoot,
  );
  const bodyHooks = await inspectBodyHookCases(contract.bodyHookPaths);
  for (const bodyHook of bodyHooks) {
    if (!bodyHook.passed) {
      failures.push(
        contractFailure(
          "contract-extraction",
          `Body-hook case ${bodyHook.id} resolved to ${bodyHook.actual}, expected ${bodyHook.expected}.`,
          undefined,
        ),
      );
    }
  }
  await mkdir(join(labRoot, "results"));

  for (const candidate of WEASYPRINT_CANDIDATES) {
    const environmentDirectory = join(labRoot, candidate.id);
    const python = environmentExecutable(environmentDirectory, "python");
    const weasyprint = environmentExecutable(environmentDirectory, "weasyprint");
    const candidateResult: CandidateEvidence = {
      candidateId: candidate.id,
      weasyPrintVersion: candidate.weasyPrintVersion,
      scenarios: [],
      doctorPassed: false,
      actualLaunchPassed: false,
      productScenarios: [],
    };
    candidates.push(candidateResult);

    const commands = [
      commandRequest(
        "setup",
        [options.pythonExecutable ?? "python3", "-m", "venv", environmentDirectory],
        {
          candidateId: candidate.id,
        },
      ),
      commandRequest(
        "dependency-install",
        [
          python,
          "-m",
          "pip",
          "install",
          `weasyprint==${candidate.weasyPrintVersion}`,
          `pydyf==${candidate.dependencies.pydyf}`,
          `fonttools[woff]==${candidate.dependencies.fontTools}`,
        ],
        { candidateId: candidate.id },
      ),
      commandRequest("environment-inspection", [python, "-c", candidateEnvironmentScript()], {
        candidateId: candidate.id,
      }),
    ];
    let candidateBlocked = false;
    for (const request of commands) {
      const execution = await runChecked(runner, request);
      if (execution.failure) {
        failures.push(execution.failure);
        candidateBlocked = true;
        break;
      }
      if (request.stage === "environment-inspection") {
        try {
          const environment = JSON.parse(execution.result.stdout) as Record<string, string>;
          candidateResult.environment = environment;
          if (
            environment.weasyprint !== candidate.weasyPrintVersion ||
            environment.pydyf !== candidate.dependencies.pydyf ||
            environment.fontTools !== candidate.dependencies.fontTools
          ) {
            failures.push({
              stage: "environment-inspection",
              classification: "dependency-failure",
              candidateId: candidate.id,
              message: "Effective dependency versions differ from the pinned candidate contract.",
            });
            candidateBlocked = true;
          }
        } catch {
          failures.push({
            stage: "environment-inspection",
            classification: "dependency-failure",
            candidateId: candidate.id,
            message: "Candidate environment returned invalid JSON.",
          });
          candidateBlocked = true;
        }
      }
    }
    if (candidateBlocked) continue;

    for (const scenario of PAGE_NUMBER_RENDERER_SCENARIOS) {
      const scenarioDirectory = contract.scenarioDirectories[scenario.id];
      if (!scenarioDirectory) throw new Error(`Missing materialized scenario ${scenario.id}.`);
      const candidateScenarioDirectory = join(labRoot, "results", candidate.id, scenario.id);
      candidateResult.scenarios.push({
        id: scenario.id,
        passed: await runRenderedScenarioEvidence({
          runner,
          pdfInspector,
          failures,
          candidateId: candidate.id,
          scenarioId: scenario.id,
          outputDirectory: candidateScenarioDirectory,
          renderStage: "contract-render",
          extractionStage: "contract-extraction",
          renderArgv: (pdfPath) => [weasyprint, join(scenarioDirectory, "input.html"), pdfPath],
          pngPages: scenario.expected.pngPages,
          validate: (evidence) => validatePdfEvidence(scenario, evidence),
        }),
      });
    }

    const binDirectory = dirname(weasyprint);
    const selectedEnvironment = safeSubprocessEnvironment(binDirectory);
    const doctor = await runChecked(
      runner,
      commandRequest("doctor", [process.execPath, "dist/esm/bin.mjs", "doctor", "--json"], {
        candidateId: candidate.id,
        env: selectedEnvironment,
      }),
    );
    if (doctor.failure) {
      failures.push(doctor.failure);
    } else {
      try {
        const doctorPayload = JSON.parse(doctor.result.stdout) as {
          tools?: { weasyprint?: { version?: string } };
        };
        candidateResult.doctorPassed =
          doctorPayload.tools?.weasyprint?.version === candidate.weasyPrintVersion;
        if (!candidateResult.doctorPassed) {
          failures.push({
            stage: "doctor",
            classification: "executable-launch-failure",
            candidateId: candidate.id,
            message: "doctor --json did not report the selected candidate version.",
          });
        }
      } catch {
        failures.push({
          stage: "doctor",
          classification: "executable-launch-failure",
          candidateId: candidate.id,
          message: "doctor --json returned invalid JSON.",
        });
      }
    }

    const launchDirectory = join(labRoot, "results", candidate.id, "actual-launch");
    await mkdir(launchDirectory, { recursive: true });
    const launchPdf = join(launchDirectory, "output.pdf");
    const launched = await runChecked(
      runner,
      commandRequest(
        "actual-launch",
        [
          process.execPath,
          "dist/esm/bin.mjs",
          "md",
          "to-pdf",
          "--input",
          contract.launch.markdownPath,
          "--profile",
          contract.launch.profilePath,
          "--output",
          launchPdf,
          "--overwrite",
        ],
        { candidateId: candidate.id, env: selectedEnvironment },
      ),
    );
    if (launched.failure) {
      failures.push(launched.failure);
    } else {
      try {
        const mismatches = validateActualLaunch(await pdfInspector(launchPdf));
        candidateResult.actualLaunchPassed = mismatches.length === 0;
        if (mismatches.length > 0) {
          failures.push(
            contractFailure("actual-launch-extraction", mismatches.join("; "), candidate.id),
          );
        }
      } catch (error) {
        failures.push({
          stage: "actual-launch-extraction",
          classification: "setup-failure",
          candidateId: candidate.id,
          message: publicSafeText(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    for (const scenario of PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS) {
      const productLaunch = contract.productLaunches[scenario.id];
      if (!productLaunch) throw new Error(`Missing materialized product launch ${scenario.id}.`);
      const productDirectory = join(
        labRoot,
        "results",
        candidate.id,
        "product-launches",
        scenario.id,
      );
      candidateResult.productScenarios.push({
        id: scenario.id,
        passed: await runRenderedScenarioEvidence({
          runner,
          pdfInspector,
          failures,
          candidateId: candidate.id,
          scenarioId: scenario.id,
          outputDirectory: productDirectory,
          renderStage: "actual-launch",
          extractionStage: "actual-launch-extraction",
          renderArgv: (productPdf) => [
            process.execPath,
            "dist/esm/bin.mjs",
            "md",
            "to-pdf",
            "--input",
            productLaunch.markdownPath,
            "--profile",
            productLaunch.profilePath,
            ...(productLaunch.templatePath ? ["--template", productLaunch.templatePath] : []),
            ...(productLaunch.cssPath ? ["--css", productLaunch.cssPath] : []),
            "--output",
            productPdf,
            "--overwrite",
          ],
          pngPages: scenario.expected.pngPages,
          validate: (evidence) => validatePdfEvidence(scenario, evidence),
          env: selectedEnvironment,
        }),
      });
    }
  }

  const requiredScenarioIds = new Set(
    [
      ...PAGE_NUMBER_RENDERER_SCENARIOS.filter((scenario) => scenario.required),
      ...PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.filter((scenario) => scenario.required),
    ].map((scenario: RendererContractScenario | ProductRendererScenario) => scenario.id),
  );
  const hasRequiredContractFailure = failures.some(
    (failure) =>
      failure.classification === "contract-failure" &&
      (failure.scenarioId === undefined || requiredScenarioIds.has(failure.scenarioId)),
  );
  const hasEnvironmentFailure = failures.some(
    (failure) => failure.classification !== "contract-failure",
  );
  const outcome = hasRequiredContractFailure
    ? "failed"
    : hasEnvironmentFailure
      ? "inconclusive"
      : "passed";
  const retained = options.keep === true || outcome !== "passed";
  const report: RendererEvidenceReport = {
    schemaVersion: 2,
    catalogDigest: contract.catalogDigest,
    harnessDigest: PAGE_NUMBER_RENDERER_HARNESS_DIGEST,
    outcome,
    evidenceStatus: PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.some(
      (scenario) => scenario.visualReviewRequired.length > 0,
    )
      ? "visual-review-required"
      : "complete",
    retained,
    labPath: labRoot,
    bodyHooks,
    candidates,
    failures,
    evidenceBoundary: {
      automated: PAGE_NUMBER_AUTOMATED_EVIDENCE,
      visualReviewRequired: PAGE_NUMBER_PRODUCT_RENDERER_SCENARIOS.map((scenario) => ({
        scenarioId: scenario.id,
        assertions: scenario.visualReviewRequired,
      })),
    },
  };
  await writeFile(
    join(labRoot, "results", reportName),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  if (!retained) await closeRetainedEvidenceLaboratory(labRoot, options.temporaryRoot);
  return report;
}

export function publicEvidenceReport(
  report: RendererEvidenceReport,
): Omit<RendererEvidenceReport, "labPath"> {
  const { labPath: _labPath, ...publicReport } = report;
  return {
    ...publicReport,
    failures: report.failures.map((failure) => ({
      ...failure,
      message: publicSafeText(failure.message),
    })),
    retained: false,
  };
}

function usage(): string {
  return [
    "Markdown PDF page-number renderer evidence harness.",
    "",
    "Usage:",
    "  bun scripts/spikes/markdown-pdf-page-number-renderer-evidence.ts run --live [--keep] [--python <executable>]",
    "  bun scripts/spikes/markdown-pdf-page-number-renderer-evidence.ts close --lab <retained-lab>",
    "",
    "The run command performs networked candidate installation and live rendering only with --live.",
  ].join("\n");
}

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }
  if (command === "run") {
    if (!args.includes("--live"))
      throw new Error("Refusing to run the live matrix without --live.");
    const pythonIndex = args.indexOf("--python");
    const pythonExecutable = pythonIndex >= 0 ? args[pythonIndex + 1] : undefined;
    if (pythonIndex >= 0 && !pythonExecutable) throw new Error("--python requires an executable.");
    const unknown = args.filter(
      (arg, index) =>
        arg !== "--live" && arg !== "--keep" && arg !== "--python" && index !== pythonIndex + 1,
    );
    if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}`);
    const report = await runRendererEvidence({
      keep: args.includes("--keep"),
      pythonExecutable,
    });
    console.log(JSON.stringify(publicEvidenceReport(report), null, 2));
    if (report.retained) console.error(`Retained laboratory: ${report.labPath}`);
    if (report.outcome !== "passed") process.exitCode = 1;
    return;
  }
  if (command === "close") {
    const labIndex = args.indexOf("--lab");
    const lab = labIndex >= 0 ? args[labIndex + 1] : undefined;
    if (!lab) throw new Error("--lab is required.");
    if (args.length !== 2) throw new Error("Unknown close argument.");
    await closeRetainedEvidenceLaboratory(resolve(lab));
    console.log("Retained renderer-evidence laboratory closed.");
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(publicSafeText(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}
