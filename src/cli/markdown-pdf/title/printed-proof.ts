import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type {
  PDFDocumentProxy,
  PDFOperatorList,
  PDFPageProxy,
  StructTreeNode,
} from "pdfjs-dist/types/src/display/api";

export interface SourceTitleProbe {
  id: string;
  earlierIds: string[];
  text: string;
  substitute: string;
  html: string;
}

interface TitleEvidence {
  sourceId?: string;
  complete?: boolean;
}

interface TextRun {
  index: number;
  mcid: number;
  text: string;
  startsLine?: boolean;
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type Operators = PdfJs["OPS"];

interface HeadingProof {
  pages: number;
  emptyHeadings: number;
  page: PDFPageProxy;
  operators: PDFOperatorList;
  destinations: Map<string, unknown>;
  tree: StructTreeNode;
  runs: TextRun[];
}

function* bodyHeadings(node: StructTreeNode, inBody = false): Generator<StructTreeNode> {
  if (["BlockQuote", "L", "Table", "Note"].includes(node.role)) return;
  // The built-in template's main element is a Part in a WeasyPrint tagged PDF.
  inBody ||= node.role === "Part";
  if (inBody && node.role === "H1") {
    yield node;
    return;
  }
  for (const child of node.children) {
    if ("role" in child) yield* bodyHeadings(child, inBody);
  }
}

function* contentIds(node: StructTreeNode): Generator<number> {
  for (const child of node.children) {
    if ("role" in child) {
      yield* contentIds(child);
    } else if (child.type === "content") {
      const match = /_mc(\d+)$/u.exec(child.id);
      if (match) yield Number(match[1]);
    }
  }
}

function isEmptyHeading(node: StructTreeNode, emptyContent: Set<number>): boolean {
  return (
    node.children.length > 0 &&
    node.children.every((child) => {
      if ("role" in child) return isEmptyHeading(child, emptyContent);
      const match = /_mc(\d+)$/u.exec(child.id);
      return child.type === "content" && !!match && emptyContent.has(Number(match[1]));
    })
  );
}

function readRuns(
  operators: PDFOperatorList,
  include: (id: number) => boolean,
  ops: Operators,
): TextRun[] {
  const runs: TextRun[] = [];
  const stack: (number | undefined)[] = [];
  for (const [index, code] of operators.fnArray.entries()) {
    const args = operators.argsArray[index];
    if (code === ops.beginMarkedContentProps) {
      stack.push(typeof args[1] === "number" ? args[1] : undefined);
    } else if (code === ops.beginMarkedContent) {
      stack.push(undefined);
    } else if (code === ops.endMarkedContent) {
      stack.pop();
    } else if (code === ops.showText) {
      const mcid = stack.at(-1);
      if (mcid === undefined || !include(mcid)) continue;
      // TJ numbers adjust position. Only the embedded glyphs supply source text.
      const glyphs: (number | { unicode: string })[] = args[0];
      const text = glyphs.map((glyph) => (typeof glyph === "number" ? "" : glyph.unicode)).join("");
      runs.push({ index, mcid, text });
    }
  }
  return runs;
}

async function markLineStarts(page: PDFPageProxy, runs: TextRun[]): Promise<void> {
  if (runs.length < 2) return;
  // PDF text can omit the space at a soft wrap. Use text-layer positions only
  // for line boundaries; the spelling still comes from the painted glyphs.
  const content = await page.getTextContent({ includeMarkedContent: true });
  const stack: (number | undefined)[] = [];
  const breaks = new Map<number, number>();
  let previous: { id: number | undefined; y: number } | undefined;
  let ended = false;
  for (const item of content.items) {
    if (!("str" in item)) {
      if (item.type === "endMarkedContent") stack.pop();
      else {
        const match = /_mc(\d+)$/u.exec(item.id ?? "");
        stack.push(match ? Number(match[1]) : undefined);
      }
      continue;
    }
    if (item.str.trim()) {
      const id = stack.at(-1);
      const y = item.transform[5];
      if (
        ended &&
        previous?.id !== undefined &&
        id !== undefined &&
        id !== previous.id &&
        y < previous.y
      ) {
        breaks.set(id, previous.id);
      }
      previous = { id, y };
      ended = false;
    }
    ended ||= item.hasEOL;
  }
  for (let i = 1; i < runs.length; i++) {
    const run = runs[i]!;
    run.startsLine = breaks.get(run.mcid) === runs[i - 1]!.mcid;
  }
}

function caseKey(text: string): string {
  return text.toLowerCase().toUpperCase();
}

function sourceRunEnds(runs: TextRun[], source: string): number[] | undefined {
  // A printed SS can belong to one source ß. Compare run boundaries in source characters.
  let expected = "";
  const boundaries = new Map([[0, 0]]);
  for (const [index, char] of Array.from(source.trim().replace(/\s+/gu, " ")).entries()) {
    expected += caseKey(char);
    boundaries.set(expected.length, index + 1);
  }
  const ends: number[] = [];
  let actual = "";
  for (const [index, run] of runs.entries()) {
    if (run.startsLine && expected[actual.length] === " ") actual += " ";
    const text = caseKey(run.text).replace(/\s+/gu, " ");
    actual += !actual || actual.endsWith(" ") ? text.trimStart() : text;
    const end = boundaries.get(index === runs.length - 1 ? actual.trimEnd().length : actual.length);
    if (end === undefined) return;
    ends.push(end);
  }
  if (actual.trimEnd() === expected) return ends;
}

function sourceMatch(original: HeadingProof, candidates: readonly SourceTitleProbe[]) {
  for (const candidate of candidates) {
    const dest = original.destinations.get(candidate.id);
    if (
      candidate.text === candidate.substitute ||
      !Array.isArray(dest) ||
      !isDeepStrictEqual(dest[0], original.page.ref)
    )
      continue;
    const ends = sourceRunEnds(original.runs, candidate.text);
    if (ends) return { candidate, ends };
  }
}

async function firstHeadingPage(document: PDFDocumentProxy) {
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const tree = await page.getStructTree();
    if (!tree) return;
    const headings = Array.from(bodyHeadings(tree));
    if (headings.length) return { page, tree, headings };
    page.cleanup();
  }
}

async function inspectPdf(
  pdf: PdfJs,
  file: string,
  inspect: (proof: HeadingProof) => Promise<TitleEvidence>,
): Promise<TitleEvidence> {
  // Bound memory for documents with large embedded assets before opening both proofs.
  if ((await stat(file)).size > 16 * 1024 * 1024) return {};
  const task = pdf.getDocument({
    data: new Uint8Array(await readFile(file)),
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    verbosity: pdf.VerbosityLevel.ERRORS,
  });
  try {
    const document = await task.promise;
    const first = await firstHeadingPage(document);
    if (!first) return {};
    const { page, tree, headings } = first;
    const operators = await page.getOperatorList();
    if (operators.fnArray.length > 50_000) return {};
    // visibility:hidden can leave an H1 tag and a destination in the PDF.
    // Advance only if all of its marked spans contain no commands at all.
    const emptyContent = new Set<number>();
    for (const [i, op] of operators.fnArray.entries()) {
      if (
        op === pdf.OPS.beginMarkedContentProps &&
        operators.fnArray[i + 1] === pdf.OPS.endMarkedContent
      ) {
        emptyContent.add(operators.argsArray[i][1]);
      }
    }
    let emptyHeadings = 0;
    for (const heading of headings) {
      if (isEmptyHeading(heading, emptyContent)) {
        emptyHeadings++;
        continue;
      }
      const ids = new Set(contentIds(heading));
      const runs = readRuns(operators, (id) => ids.has(id), pdf.OPS);
      if (!runs.length || runs.reduce((n, run) => n + run.text.length, 0) > 256) return {};
      await markLineStarts(page, runs);
      return await inspect({
        pages: document.numPages,
        emptyHeadings,
        page,
        tree,
        operators,
        runs,
        destinations: await document.getDestinations(),
      });
    }
    return {};
  } finally {
    await task.destroy();
  }
}

function admitsEarlierHeadings(
  proof: HeadingProof,
  candidate: SourceTitleProbe,
  ops: Operators,
): boolean {
  const destination = proof.destinations.get(candidate.id);
  let anchored = 0;
  for (const id of candidate.earlierIds) {
    const prior = proof.destinations.get(id);
    if (prior === undefined) continue;
    if (
      !Array.isArray(prior) ||
      !isDeepStrictEqual(prior[0], proof.page.ref) ||
      isDeepStrictEqual(prior, destination)
    )
      return false;
    anchored++;
  }
  if (anchored <= proof.emptyHeadings) return anchored === proof.emptyHeadings;

  // A running H1 can retain a page destination and print in a margin box
  // outside the structure tree. Only advance when there is one possible body
  // H1 after the empty tags; a second one could be a reordered earlier heading.
  if (Array.from(bodyHeadings(proof.tree)).length !== proof.emptyHeadings + 1) return false;
  const semantic = new Set(contentIds(proof.tree));
  const furniture = readRuns(proof.operators, (id) => !semantic.has(id), ops);
  return (
    new Set(furniture.filter((run) => run.text.trim()).map((run) => run.mcid)).size >=
    anchored - proof.emptyHeadings
  );
}

function comparableArgs(code: number, args: unknown, ops: Operators): unknown {
  if ((code === ops.setFont || code === ops.dependency) && Array.isArray(args)) {
    // PDF.js prefixes equivalent font resource IDs with each loading task's ID.
    return args.map((arg: unknown) =>
      typeof arg === "string" ? arg.replace(/^g_d\d+_/u, "") : arg,
    );
  }
  return args;
}

function isolatedChange(
  original: HeadingProof,
  marked: HeadingProof,
  originalEnds: number[],
  substitute: string,
  ops: Operators,
): boolean {
  if (
    original.pages !== marked.pages ||
    original.page.pageNumber !== marked.page.pageNumber ||
    original.runs.length !== marked.runs.length ||
    !isDeepStrictEqual(sourceRunEnds(marked.runs, substitute), originalEnds) ||
    !isDeepStrictEqual(original.tree, marked.tree) ||
    !isDeepStrictEqual(original.destinations, marked.destinations) ||
    !isDeepStrictEqual(original.operators.fnArray, marked.operators.fnArray)
  )
    return false;

  const changed = new Set<number>();
  for (const [index, before] of original.runs.entries()) {
    const after = marked.runs[index]!;
    if (before.index !== after.index || before.mcid !== after.mcid) return false;
    if (caseKey(before.text) === caseKey(after.text)) {
      if (before.text.trim()) return false;
    } else {
      changed.add(before.index);
    }
  }
  return (
    changed.size > 0 &&
    original.operators.fnArray.every(
      (code, index) =>
        changed.has(index) ||
        isDeepStrictEqual(
          comparableArgs(code, original.operators.argsArray[index], ops),
          comparableArgs(code, marked.operators.argsArray[index], ops),
        ),
    )
  );
}

export async function inspectPrintedTitle(
  html: string,
  tempDir: string,
  print: (htmlPath: string, pdfPath: string) => Promise<boolean>,
  candidates: readonly SourceTitleProbe[],
): Promise<TitleEvidence> {
  const render = async (stem: string, content: string) => {
    const path = join(tempDir, stem + ".html");
    const out = join(tempDir, stem + ".pdf");
    await writeFile(path, content);
    return (await print(path, out)) ? out : undefined;
  };
  try {
    if (!candidates.length) return {};
    const path = await render("title-proof", html);
    if (!path) return {};
    const pdf = await import("pdfjs-dist/legacy/build/pdf.mjs");
    return await inspectPdf(pdf, path, async (original) => {
      const match = sourceMatch(original, candidates);
      if (!match || !admitsEarlierHeadings(original, match.candidate, pdf.OPS)) return {};
      const { candidate, ends } = match;
      const destination = original.destinations.get(candidate.id);
      if (
        candidates.some(
          (other) =>
            other.id !== candidate.id &&
            isDeepStrictEqual(original.destinations.get(other.id), destination),
        )
      )
        return {};
      const markedPath = await render("title-substitution", candidate.html);
      if (!markedPath) return {};
      return inspectPdf(pdf, markedPath, async (marked) => {
        if (!isolatedChange(original, marked, ends, candidate.substitute, pdf.OPS)) return {};
        const identity = { sourceId: candidate.id };
        try {
          const { hasVisibleGlyphs } = await import("./visible-glyphs");
          return {
            ...identity,
            complete: await hasVisibleGlyphs(original.page, original.operators, original.runs),
          };
        } catch {
          return identity;
        }
      });
    });
  } catch {
    // Missing inspection support or an unreadable proof keeps the metadata block.
    return {};
  }
}
