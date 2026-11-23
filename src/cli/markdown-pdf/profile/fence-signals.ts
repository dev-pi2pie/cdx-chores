import { MarkdownSourceCursor, type MarkdownSourceToken, type SourceLimits } from "./source-cursor";

type FenceMarker = "`" | "~";

interface FenceLine {
  marker: FenceMarker;
  indent: number;
  length: number;
  info: string;
  hasClose: boolean;
}

interface MarkdownFenceScan {
  ordinaryLines: string[];
  fenceLanguages: string[];
}

function readFenceLine(line: string): FenceLine | undefined {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
  const run = match?.[2];
  if (!run) return undefined;
  return {
    marker: run.startsWith("`") ? "`" : "~",
    indent: match[1]!.length,
    length: run.length,
    info: (match[3] ?? "").replace(/^[ \t]+|[ \t]+$/g, ""),
    hasClose: false,
  };
}

function fenceLanguage(info: string): string | null | undefined {
  // Pandoc raw blocks hide Markdown structure but do not carry a code language.
  if (/^\{[ \t]*=[a-z0-9_-]+[ \t]*\}$/i.test(info)) return null;
  const match = /^([^\s`{}]*)(?:[ \t]*\{(.*)\})?$/.exec(info);
  if (!match) return undefined;

  const attributes = match[2]?.trim() ?? "";
  const token =
    /([.#][^\s{}]+|[^\s{}=]+=(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s{}"']+))(?:[ \t]+|$)/gy;
  let firstClass: string | undefined;
  while (token.lastIndex < attributes.length) {
    const attribute = token.exec(attributes)?.[1];
    if (!attribute) return undefined;
    if (attribute.startsWith(".")) firstClass ??= attribute.slice(1);
  }
  return (match[1] || firstClass || "").toLowerCase();
}

function readDivFence(line: string): "open" | "close" | undefined {
  const info = /^:{3,}(.*)$/.exec(line)?.[1]?.trim();
  if (info === undefined) return undefined;
  if (!info) return "close";
  if (info.startsWith("{")) {
    const attributes = info.replace(/[ \t]*:+$/, "");
    return fenceLanguage(attributes) == null ? undefined : "open";
  }
  const className = info.replace(/[ \t]+:+$/, "");
  return /^[^\s{}]+$/.test(className) ? "open" : undefined;
}

type BlockContext =
  | "boundary"
  | "paragraph"
  | "pipe-table"
  | "definition-term"
  | { listIndent: number };

const DEFINITION_MARKER = /^ {0,3}[:~] +/;
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const VERBATIM_TAGS = new Set(["pre", "script", "style", "textarea"]);
const VOID_BLOCK_TAGS = new Set(["area", "col", "embed", "hr", "isindex", "meta", "source"]);
// Ordinary HTML blocks shared by the Pandoc 2.0 and 3.9 Markdown readers.
// The summary close has its own offline blank-line rule.
const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "body",
  "canvas",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "isindex",
  "li",
  "main",
  "menu",
  "meta",
  "noframes",
  "ol",
  "output",
  "p",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "ul",
  ...VERBATIM_TAGS,
]);
// These tags also occur inside paragraphs. They start a boundary only in a
// block position, and a close can finish a block that started there.
const CONTEXTUAL_BLOCK_TAGS = new Set([
  "applet",
  "area",
  "audio",
  "button",
  "del",
  "embed",
  "iframe",
  "ins",
  "map",
  "noscript",
  "object",
  "progress",
  "source",
  "svg",
  "video",
]);

function isPipeTableSeparator(line: string): boolean {
  if (!line.includes("|")) return false;
  const cells = line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|");
  return cells.length > 1 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

function blockContext(
  line: string,
  lines: string[],
  index: number,
  previous: BlockContext,
): BlockContext {
  const nextLine = lines[index + 1] ?? "";
  if (!line.trim()) return previous === "definition-term" ? previous : "boundary";
  if (previous === "definition-term") {
    const marker = DEFINITION_MARKER.exec(line);
    if (marker) return { listIndent: marker[0].length };
  }
  if (
    previous !== "paragraph" &&
    line.includes("|") &&
    (previous === "pipe-table" || isPipeTableSeparator(nextLine))
  ) {
    return "pipe-table";
  }
  if (/^ {0,3}(?:=+|-+|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})[ \t]*$/.test(line)) {
    return "boundary";
  }
  if (previous !== "paragraph") {
    const list = /^ {0,3}(?:[-+*]|\d+[.)]) +/.exec(line);
    if (list) return { listIndent: list[0].length };
    if (/^(?: {0,3}#{1,6}(?:[ \t]|$)| {4}|\t)/.test(line)) return "boundary";
    const definition = nextLine.trim() ? nextLine : (lines[index + 2] ?? "");
    if (DEFINITION_MARKER.test(definition)) return "definition-term";
  }
  if (typeof previous === "object") return previous;
  return "paragraph";
}

function markCandidatesWithClosers(fences: (FenceLine | undefined)[]): void {
  // Reject unmatched candidates without searching the rest of the document for each one.
  const longestCloser: Record<FenceMarker, number> = { "`": 0, "~": 0 };
  for (let index = fences.length - 1; index >= 0; index--) {
    const fence = fences[index];
    if (!fence) continue;
    fence.hasClose = longestCloser[fence.marker] >= fence.length;
    if (!fence.info) {
      longestCloser[fence.marker] = Math.max(longestCloser[fence.marker], fence.length);
    }
  }
}

function closesFence(opener: FenceLine, candidate: FenceLine | undefined): boolean {
  return (
    !!candidate &&
    !candidate.info &&
    candidate.marker === opener.marker &&
    candidate.length >= opener.length
  );
}

function fenceClose(fences: (FenceLine | undefined)[], index: number, fence: FenceLine) {
  do index++;
  while (index < fences.length && !closesFence(fence, fences[index]));
  return index;
}

interface SourceLine extends SourceLimits {
  start: number;
  end: number;
}

function sourceLines(content: string, lines: string[]): SourceLine[] {
  const breaks = content.matchAll(/\r\n?|\n/g);
  let start = 0;
  const positions = lines.map((line) => {
    const end = start + line.length;
    const position = {
      start,
      end,
      inlineLimit: content.length,
      tagLimit: content.length,
      nextMarkdownStructure: content.length,
    };
    const newline = breaks.next().value;
    start = end + (newline?.[0].length ?? 0);
    return position;
  });
  let inlineLimit = content.length;
  let tagLimit = content.length;
  let nextMarkdownStructure = content.length;
  for (let index = positions.length - 1; index >= 0; index--) {
    const line = lines[index]!;
    const position = positions[index]!;
    position.inlineLimit = inlineLimit;
    position.tagLimit = tagLimit;
    position.nextMarkdownStructure = nextMarkdownStructure;
    const blank = !line.trim();
    const markdownStructure =
      ATX_HEADING.test(line) ||
      isPipeTableSeparator(line) ||
      isPipeTableSeparator(lines[index + 1] ?? "");
    if (blank) inlineLimit = position.start;
    if (markdownStructure) nextMarkdownStructure = position.start;
    // A malformed wrapped tag must recover before a subsequent Markdown block.
    if (blank || markdownStructure || /^ {0,3}(?:\||`{3,}|~{3,})/.test(line)) {
      tagLimit = position.start;
    }
  }
  return positions;
}

function fenceRecoveryBoundaries(
  lines: string[],
  positions: SourceLine[],
  fences: (FenceLine | undefined)[],
) {
  // A later, complete Markdown fence cannot supply a missing HTML delimiter
  // across an intervening heading or table. Immediately following apparent
  // fences stay literal when the HTML opener has a complete end.
  const bodies: { start: number; end: number; precedingStructure: number }[] = [];
  let precedingStructure: number | undefined;
  for (let index = 0; index < fences.length; index++) {
    const line = lines[index]!;
    if (ATX_HEADING.test(line) || isPipeTableSeparator(line)) {
      precedingStructure = positions[index]!.start;
    }
    const fence = fences[index];
    if (!fence?.hasClose || (fence.marker === "~" && lines[index - 1]?.trim())) continue;
    if (fenceLanguage(fence.info) === undefined) continue;
    const close = fenceClose(fences, index, fence);
    if (precedingStructure !== undefined) {
      bodies.push({
        start: positions[index + 1]!.start,
        end: positions[close]!.start,
        precedingStructure,
      });
    }
    index = close;
  }
  return (delimiter: number) => {
    let low = 0;
    let high = bodies.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (bodies[middle]!.end <= delimiter) low = middle + 1;
      else high = middle;
    }
    const body = bodies[low];
    return body && delimiter >= body.start ? body.precedingStructure : undefined;
  };
}

type LineEnd = "boundary" | "paragraph" | "paired-close";

class BoundaryScanner {
  private readonly cursor: MarkdownSourceCursor;
  private offset = 0;
  private lineEnd: LineEnd | undefined;
  private readonly openHtmlBlocks = new Map<string, boolean[]>();

  constructor(
    private readonly content: string,
    fenceRecoveryBoundary: (delimiter: number) => number | undefined,
  ) {
    this.cursor = new MarkdownSourceCursor(content, fenceRecoveryBoundary);
  }

  coversStart(line: SourceLine) {
    return this.offset > line.start;
  }

  private htmlBoundary(
    { name, closing, selfClosing }: Extract<MarkdownSourceToken, { kind: "tag" }>,
    blockStart: boolean,
  ): LineEnd | undefined {
    const ordinary = BLOCK_TAGS.has(name);
    if (!ordinary && !CONTEXTUAL_BLOCK_TAGS.has(name)) return undefined;

    let matchedBlock = false;
    if (!VOID_BLOCK_TAGS.has(name)) {
      const openings = this.openHtmlBlocks.get(name) ?? [];
      if (closing) {
        matchedBlock = openings.pop() === true;
        if (openings.length === 0) this.openHtmlBlocks.delete(name);
      } else if (!selfClosing) {
        openings.push(ordinary || blockStart);
        this.openHtmlBlocks.set(name, openings);
      }
    }
    if (!(ordinary || blockStart || matchedBlock)) return undefined;
    if (closing && name === "summary") return "paragraph";
    return matchedBlock ? "paired-close" : "boundary";
  }

  scan(line: SourceLine, previous: BlockContext) {
    const { start, end } = line;
    let offset = Math.max(start, this.offset);
    let visible = " ".repeat(Math.min(offset, end) - start);
    let lineEnd = this.coversStart(line) ? this.lineEnd : undefined;
    let hasText = false;
    const headingLine = ATX_HEADING.test(this.content.slice(start, end));

    while (offset < end) {
      const token = this.cursor.read(offset, line);
      const tokenEnd = token?.end ?? offset + 1;
      const text = this.content.slice(offset, Math.min(tokenEnd, end));
      if (token?.kind === "comment") {
        if (lineEnd === "paired-close" && offset > this.offset) lineEnd = "paragraph";
        if (!hasText) lineEnd ??= previous === "paragraph" ? "paragraph" : "boundary";
        visible += hasText && !lineEnd && tokenEnd <= end ? text : " ".repeat(text.length);
      } else if (token?.kind === "tag") {
        const { name, closing, selfClosing } = token;
        if (!closing && !selfClosing && VERBATIM_TAGS.has(name)) {
          const verbatimEnd = this.cursor.verbatimEnd(name, offset, tokenEnd);
          if (verbatimEnd !== undefined) {
            visible += " ".repeat(Math.min(verbatimEnd, end) - offset);
            offset = this.offset = verbatimEnd;
            lineEnd = "boundary";
            continue;
          }
        }
        const startsAtBoundary =
          lineEnd === "boundary" ||
          (lineEnd === "paired-close" && offset === this.offset) ||
          (!hasText && previous !== "paragraph" && /^ {0,3}$/.test(visible));
        const boundary = headingLine ? undefined : this.htmlBoundary(token, startsAtBoundary);
        visible += tokenEnd <= end && (!boundary || hasText) ? text : " ".repeat(text.length);
        if (boundary) lineEnd = boundary;
        else {
          if (tokenEnd <= end) hasText = true;
          lineEnd = lineEnd || tokenEnd > end ? "paragraph" : undefined;
        }
      } else {
        visible += text;
        if (text.trim()) {
          hasText = true;
          lineEnd = lineEnd || tokenEnd > end ? "paragraph" : undefined;
        }
      }
      offset = tokenEnd;
      if (token) this.offset = offset;
    }
    this.lineEnd = lineEnd;
    return { visible, context: lineEnd === "paired-close" ? ("boundary" as const) : lineEnd };
  }
}

export function scanMarkdownPdfFences(content: string): MarkdownFenceScan {
  const lines = content.split(/\r\n?|\n/);
  const positions = sourceLines(content, lines);
  const fences = lines.map(readFenceLine);
  markCandidatesWithClosers(fences);
  const scanner = new BoundaryScanner(content, fenceRecoveryBoundaries(lines, positions, fences));

  const ordinaryLines: string[] = [];
  const fenceLanguages: string[] = [];
  let context: BlockContext = "boundary";
  let divDepth = 0;
  let rejectedTilde: FenceLine | undefined;
  for (let index = 0; index < lines.length; index++) {
    const fence = fences[index];
    const position = positions[index]!;
    const line = lines[index]!;
    const covered = scanner.coversStart(position);
    const followsRejectedTilde = rejectedTilde && closesFence(rejectedTilde, fence);
    if (followsRejectedTilde) rejectedTilde = undefined;
    if (
      fence?.hasClose &&
      !followsRejectedTilde &&
      !covered &&
      (typeof context !== "object" || fence.indent < context.listIndent)
    ) {
      const language = fenceLanguage(fence.info);
      if (fence.marker === "~" && context === "paragraph") {
        if (fence.info && language !== undefined) rejectedTilde ??= fence;
      } else if (language !== undefined) {
        if (language !== null) fenceLanguages.push(language);
        index = fenceClose(fences, index, fence);
        if (fence.marker === "~") rejectedTilde = undefined;
        context = "boundary";
        continue;
      }
    }
    if (!covered && context === "boundary" && /^(?: {4}|\t)/.test(line)) {
      ordinaryLines.push(line);
      continue;
    }
    const divFence = covered ? undefined : readDivFence(line);
    if ((divFence === "open" && context === "boundary") || (divFence === "close" && divDepth > 0)) {
      divDepth += divFence === "open" ? 1 : -1;
      ordinaryLines.push(line);
      context = "boundary";
      continue;
    }
    const { visible, context: tokenContext } = scanner.scan(position, context);
    ordinaryLines.push(visible);
    context = tokenContext ?? blockContext(visible, lines, index, context);
  }
  return { ordinaryLines, fenceLanguages };
}
