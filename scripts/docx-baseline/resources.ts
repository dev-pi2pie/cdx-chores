import type { Readable } from "node:stream";
import { finished } from "node:stream/promises";

import { XMLParser, XMLValidator } from "fast-xml-parser";
import yauzl, { type Entry, type ZipFile } from "yauzl";

/** Proposals for Phase 2 evaluation, neither accepted policy nor production enforcement. */
export const PROPOSED_DOCX_BUDGETS = {
  compressedInputBytes: 8 * 1024 * 1024,
  entryCount: 256,
  maxPartDecompressedBytes: 1024 * 1024,
  totalDecompressedBytes: 4 * 1024 * 1024,
  xmlElementCount: 100_000,
  maxXmlDepth: 64,
  maxStyleTraversalSteps: 128,
  elapsedMilliseconds: 5_000,
  peakRssBytes: 256 * 1024 * 1024,
} as const;

// Inspector ceilings deliberately exceed the proposed boundaries. They bound this
// measurement tool, not Mammoth or a future content reader.
export const DOCX_INSPECTION_LIMITS = {
  compressedInputBytes: 16 * 1024 * 1024,
  entryCount: 1_024,
  maxPartDecompressedBytes: 4 * 1024 * 1024,
  totalDecompressedBytes: 16 * 1024 * 1024,
  xmlElementCount: 300_000,
  maxXmlDepth: 256,
  styleTraversalSteps: 300_000,
} as const;

export interface DocxPartResourceMetrics {
  /** ZIP order, retained even when two entries have the same raw filename. */
  index: number;
  name: string;
  declaredCompressedBytes: number;
  declaredUncompressedBytes: number;
  actualDecompressedBytes: number;
  readOutcome: "directory" | "reading" | "complete" | "error" | "limit";
  xml?: {
    validation: "valid" | "invalid" | "doctype-not-inspected";
    elementCount: number;
    maxDepth: number;
  };
}

export interface DocxResourceMetrics {
  status: "complete" | "error" | "limit";
  error?: string;
  limit?: keyof typeof DOCX_INSPECTION_LIMITS;
  compressedInputBytes: number;
  entryCount: number;
  declaredUncompressedBytes: number;
  totalDecompressedBytes: number;
  xmlElementCount: number;
  maxXmlDepth: number;
  styleDefinitionCount: number;
  duplicateStyleIdCount: number;
  maxStyleTraversalSteps: number;
  totalStyleTraversalSteps: number;
  styleTraversalsEndingInCycle: number;
  styleTraversalDefinition: string;
  parts: DocxPartResourceMetrics[];
  cleanup: {
    zipClose: "not-opened" | "closed" | "error";
    streamsOpened: number;
    streamsCompleted: number;
    streamsDestroyedEarly: number;
    streamsClosed: number;
    activeStreams: number;
  };
}

class InspectionLimit extends Error {
  readonly metric: keyof typeof DOCX_INSPECTION_LIMITS;

  constructor(metric: keyof typeof DOCX_INSPECTION_LIMITS) {
    super(`Inspection safety ceiling exceeded: ${metric}`);
    this.metric = metric;
  }
}

function checkLimit(metric: keyof typeof DOCX_INSPECTION_LIMITS, value: number): void {
  if (value > DOCX_INSPECTION_LIMITS[metric]) throw new InspectionLimit(metric);
}

function openZip(buffer: Buffer): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { autoClose: false, decodeStrings: true, lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) reject(error ?? new Error("ZIP open returned no archive"));
        else resolve(zip);
      },
    );
  });
}

function nextEntry(zip: ZipFile): Promise<Entry | undefined> {
  return new Promise((resolve, reject) => {
    const dispose = () => {
      zip.removeListener("entry", onEntry);
      zip.removeListener("end", onEnd);
      zip.removeListener("error", onError);
    };
    const onEntry = (entry: Entry) => {
      dispose();
      resolve(entry);
    };
    const onEnd = () => {
      dispose();
      resolve(undefined);
    };
    const onError = (error: Error) => {
      dispose();
      reject(error);
    };
    zip.once("entry", onEntry);
    zip.once("end", onEnd);
    zip.once("error", onError);
    zip.readEntry();
  });
}

function openStream(zip: ZipFile, entry: Entry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) reject(error ?? new Error("ZIP entry returned no stream"));
      else resolve(stream);
    });
  });
}

function decodeXmlForMetrics(buffer: Buffer): string {
  const utf16le =
    (buffer[0] === 0xff && buffer[1] === 0xfe) ||
    (buffer[0] === 0x3c && buffer[1] === 0 && buffer[3] === 0);
  const utf16be =
    (buffer[0] === 0xfe && buffer[1] === 0xff) ||
    (buffer[0] === 0 && buffer[1] === 0x3c && buffer[2] === 0);
  return new TextDecoder(utf16le ? "utf-16le" : utf16be ? "utf-16be" : "utf-8").decode(buffer);
}

export function countXmlForInspection(xml: string): { elementCount: number; maxDepth: number } {
  // A forward-only scan avoids regex backtracking on bounded but malformed XML.
  // This is instrumentation only; validation and content interpretation are separate.
  let depth = 0;
  let elementCount = 0;
  let maxDepth = 0;
  let cursor = 0;
  while (cursor < xml.length) {
    const start = xml.indexOf("<", cursor);
    if (start < 0) break;
    const ignoredEnd = xml.startsWith("<!--", start)
      ? "-->"
      : xml.startsWith("<![CDATA[", start)
        ? "]]>"
        : xml.startsWith("<?", start)
          ? "?>"
          : undefined;
    if (ignoredEnd) {
      const end = xml.indexOf(ignoredEnd, start + 2);
      if (end < 0) break;
      cursor = end + ignoredEnd.length;
      continue;
    }
    let quote: string | undefined;
    let end = start + 1;
    for (; end < xml.length; end += 1) {
      const character = xml[end];
      if (quote) {
        if (character === quote) quote = undefined;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      }
    }
    if (end === xml.length) break;
    cursor = end + 1;
    if (xml[start + 1] === "!") continue;
    if (xml[start + 1] === "/") {
      depth = Math.max(0, depth - 1);
    } else if (/[A-Za-z_:]/.test(xml[start + 1] ?? "")) {
      elementCount += 1;
      maxDepth = Math.max(maxDepth, depth + 1);
      checkLimit("maxXmlDepth", maxDepth);
      if (xml[end - 1] !== "/") depth += 1;
    }
  }
  return { elementCount, maxDepth };
}

type OrderedXmlNode = Record<string, unknown>;

function localName(name: string): string {
  return name.slice(name.lastIndexOf(":") + 1);
}

function attribute(node: OrderedXmlNode, name: string): string | undefined {
  const attributes = node[":@"];
  if (!attributes || typeof attributes !== "object") return undefined;
  for (const [key, value] of Object.entries(attributes)) {
    if (localName(key.replace(/^@_/, "")) === name && typeof value === "string") return value;
  }
  return undefined;
}

function inspectStyleGraph(xml: string, metrics: DocxResourceMetrics): void {
  if (!/<(?:[A-Za-z_][\w.-]*:)?styles(?:\s|>)/.test(xml)) return;
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    processEntities: false,
    parseAttributeValue: false,
    parseTagValue: false,
  });
  const parsed = parser.parse(xml) as OrderedXmlNode[];
  const root = parsed.find((node) => Object.keys(node).some((key) => localName(key) === "styles"));
  if (!root) return;
  const stylesKey = Object.keys(root).find((key) => localName(key) === "styles")!;
  const children = root[stylesKey];
  if (!Array.isArray(children)) return;
  const graph = new Map<string, string | undefined>();
  for (const node of children as OrderedXmlNode[]) {
    const key = Object.keys(node).find((name) => localName(name) === "style");
    if (!key) continue;
    const id = attribute(node, "styleId");
    if (!id) continue;
    metrics.styleDefinitionCount += 1;
    if (graph.has(id)) metrics.duplicateStyleIdCount += 1;
    const contents = node[key];
    const basedOn = Array.isArray(contents)
      ? (contents as OrderedXmlNode[]).find((child) =>
          Object.keys(child).some((name) => localName(name) === "basedOn"),
        )
      : undefined;
    graph.set(id, basedOn ? attribute(basedOn, "val") : undefined);
  }
  for (const start of graph.keys()) {
    const visited = new Set<string>();
    let current: string | undefined = start;
    while (current !== undefined && graph.has(current) && !visited.has(current)) {
      visited.add(current);
      metrics.totalStyleTraversalSteps += 1;
      checkLimit("styleTraversalSteps", metrics.totalStyleTraversalSteps);
      current = graph.get(current);
    }
    metrics.maxStyleTraversalSteps = Math.max(metrics.maxStyleTraversalSteps, visited.size);
    if (current !== undefined && visited.has(current)) metrics.styleTraversalsEndingInCycle += 1;
  }
}

function inspectXml(
  buffer: Buffer,
  part: DocxPartResourceMetrics,
  metrics: DocxResourceMetrics,
): void {
  const xml = decodeXmlForMetrics(buffer);
  const counts = countXmlForInspection(xml);
  metrics.xmlElementCount += counts.elementCount;
  metrics.maxXmlDepth = Math.max(metrics.maxXmlDepth, counts.maxDepth);
  checkLimit("xmlElementCount", metrics.xmlElementCount);
  const doctype = /<!DOCTYPE\b/i.test(xml);
  const valid = !doctype && XMLValidator.validate(xml) === true;
  part.xml = {
    validation: doctype ? "doctype-not-inspected" : valid ? "valid" : "invalid",
    ...counts,
  };
  if (valid) inspectStyleGraph(xml, metrics);
}

/** Read bytes and structural measurements only. No relationships, URLs, or content are executed. */
export async function inspectDocxResources(buffer: Buffer): Promise<DocxResourceMetrics> {
  const metrics: DocxResourceMetrics = {
    status: "complete",
    compressedInputBytes: buffer.length,
    entryCount: 0,
    declaredUncompressedBytes: 0,
    totalDecompressedBytes: 0,
    xmlElementCount: 0,
    maxXmlDepth: 0,
    styleDefinitionCount: 0,
    duplicateStyleIdCount: 0,
    maxStyleTraversalSteps: 0,
    totalStyleTraversalSteps: 0,
    styleTraversalsEndingInCycle: 0,
    styleTraversalDefinition:
      "Per styles-root part, follow basedOn from each unique declared style ID; count each distinct existing definition visited, including the starting definition, stop at missing parent or repeated ID. Last duplicate ID wins. Maximum and sum cover all starts and parts. This is graph instrumentation, not Mammoth's internal traversal count.",
    parts: [],
    cleanup: {
      zipClose: "not-opened",
      streamsOpened: 0,
      streamsCompleted: 0,
      streamsDestroyedEarly: 0,
      streamsClosed: 0,
      activeStreams: 0,
    },
  };
  let zip: ZipFile | undefined;
  let zipError: Error | undefined;
  let currentPart: DocxPartResourceMetrics | undefined;
  try {
    checkLimit("compressedInputBytes", buffer.length);
    zip = await openZip(buffer);
    // Keep an error listener during streaming and cleanup as well as enumeration.
    zip.on("error", (error: Error) => {
      zipError = error;
    });
    for (;;) {
      if (zipError) throw zipError;
      const entry = await nextEntry(zip);
      if (!entry) break;
      metrics.entryCount += 1;
      metrics.declaredUncompressedBytes += entry.uncompressedSize;
      currentPart = {
        index: metrics.entryCount - 1,
        name: entry.fileName,
        declaredCompressedBytes: entry.compressedSize,
        declaredUncompressedBytes: entry.uncompressedSize,
        actualDecompressedBytes: 0,
        readOutcome: entry.fileName.endsWith("/") ? "directory" : "reading",
      };
      metrics.parts.push(currentPart);
      checkLimit("entryCount", metrics.entryCount);
      if (currentPart.readOutcome === "directory") continue;
      const stream = await openStream(zip, entry);
      metrics.cleanup.streamsOpened += 1;
      metrics.cleanup.activeStreams += 1;
      const xmlLike = /\.(?:xml|rels)$/i.test(entry.fileName);
      const chunks: Buffer[] = [];
      let ended = false;
      try {
        for await (const chunk of stream) {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
          currentPart.actualDecompressedBytes += bytes.length;
          metrics.totalDecompressedBytes += bytes.length;
          checkLimit("maxPartDecompressedBytes", currentPart.actualDecompressedBytes);
          checkLimit("totalDecompressedBytes", metrics.totalDecompressedBytes);
          if (xmlLike) chunks.push(bytes);
          if (zipError) throw zipError;
        }
        ended = true;
        metrics.cleanup.streamsCompleted += 1;
        currentPart.readOutcome = "complete";
      } finally {
        if (!ended) metrics.cleanup.streamsDestroyedEarly += 1;
        stream.destroy();
        // Wait for actual stream completion/close even on a deliberate abort.
        // A read error is already represented by the enclosing failure outcome.
        await finished(stream, { cleanup: true }).catch(() => {});
        if (stream.closed) metrics.cleanup.streamsClosed += 1;
        metrics.cleanup.activeStreams -= 1;
      }
      if (xmlLike) inspectXml(Buffer.concat(chunks), currentPart, metrics);
    }
    if (zipError) throw zipError;
  } catch (error) {
    metrics.status = error instanceof InspectionLimit ? "limit" : "error";
    metrics.error = error instanceof Error ? error.message : String(error);
    if (error instanceof InspectionLimit) metrics.limit = error.metric;
    if (currentPart?.readOutcome === "reading") {
      currentPart.readOutcome = error instanceof InspectionLimit ? "limit" : "error";
    }
  } finally {
    if (zip) {
      try {
        zip.close();
        metrics.cleanup.zipClose = "closed";
      } catch {
        metrics.cleanup.zipClose = "error";
      }
    }
  }
  return metrics;
}
