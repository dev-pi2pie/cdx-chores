import { FenceRecovery, type ScanOrigin, type SourceEvent } from "./fence-recovery";
import { FenceRange, closesFence, fenceLanguage, readDivFence, readFenceLine } from "./fence-lines";
import {
  ATX_HEADING,
  Container,
  canOpenFence,
  classifyBlock,
  expandIndent,
  isParagraph,
  isPipeTableSeparator,
  resolveContainer,
} from "./list-containers";
import { MarkdownSourceCursor, type MarkdownSourceToken, type SourceLimits } from "./source-cursor";

interface MarkdownFenceScan {
  ordinaryLines: string[];
  fenceLanguages: string[];
}

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

interface SourceLine extends SourceLimits {
  lastBlank: number;
  start: number;
  end: number;
}

function sourceLines(content: string, lines: string[]): SourceLine[] {
  const breaks = content.matchAll(/\r\n?|\n/g);
  let start = 0;
  let lastBlank = -1;
  const positions = lines.map((line, index) => {
    const end = start + line.length;
    const position = {
      lastBlank,
      start,
      end,
      inlineLimit: content.length,
      tagLimit: content.length,
      nextMarkdownStructure: content.length,
    };
    if (!line.trim()) lastBlank = index;
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

type LineEnd = "boundary" | "paragraph" | "paired-close";

class BoundaryScanner {
  private offset = 0;
  private lineEnd: LineEnd | undefined;

  recovery?: FenceRecovery;

  constructor(
    private readonly content: string,
    private readonly cursor: MarkdownSourceCursor,
  ) {}

  fork() {
    const scanner = new BoundaryScanner(this.content, this.cursor);
    scanner.offset = this.offset;
    scanner.lineEnd = this.lineEnd;
    return scanner;
  }

  canResume(line: SourceLine) {
    return this.offset <= line.end;
  }

  coversStart(line: SourceLine) {
    return this.offset > line.start;
  }

  hasPipeDelimiter(line: SourceLine) {
    return this.cursor.hasPipeDelimiter(
      Math.max(line.start, this.offset),
      line.end,
      line.nextMarkdownStructure,
      this.recovery,
    );
  }

  private htmlBoundary(
    { name, closing, selfClosing }: Extract<MarkdownSourceToken, { kind: "tag" }>,
    blockStart: boolean,
    owner: Container,
  ): LineEnd | undefined {
    const ordinary = BLOCK_TAGS.has(name);
    if (!ordinary && !CONTEXTUAL_BLOCK_TAGS.has(name)) return undefined;

    let matchedBlock = false;
    if (!VOID_BLOCK_TAGS.has(name)) {
      const blocks = (owner.openHtmlBlocks ??= new Map());
      const openings = blocks.get(name) ?? [];
      if (closing) {
        matchedBlock = openings.pop() === true;
        if (openings.length === 0) blocks.delete(name);
      } else if (!selfClosing) {
        openings.push(ordinary || blockStart);
        blocks.set(name, openings);
      }
    }
    if (!(ordinary || blockStart || matchedBlock)) return undefined;
    if (closing && name === "summary") return "paragraph";
    return matchedBlock ? "paired-close" : "boundary";
  }

  scan(
    line: SourceLine,
    owner: Container,
    start: number,
    blockAligned: boolean,
    codeLimit: number,
  ) {
    const previous = owner.block;
    const { end } = line;
    let offset = Math.max(start, this.offset);
    let visible = " ".repeat(Math.min(offset, end) - start);
    let lineEnd = this.coversStart(line) ? this.lineEnd : undefined;
    let hasText = false;
    const headingLine = blockAligned && ATX_HEADING.test(this.content.slice(start, end));

    while (offset < end) {
      const token = this.cursor.read(offset, line, codeLimit, this.recovery);
      const tokenEnd = token?.end ?? offset + 1;
      const text = this.content.slice(offset, Math.min(tokenEnd, end));
      if (token?.kind === "comment") {
        this.recovery?.confirmed(offset, tokenEnd, tokenEnd > line.nextMarkdownStructure);
        if (lineEnd === "paired-close" && offset > this.offset) lineEnd = "paragraph";
        if (!hasText) lineEnd ??= isParagraph(previous) ? "paragraph" : "boundary";
        visible += hasText && !lineEnd && tokenEnd <= end ? text : " ".repeat(text.length);
      } else if (token?.kind === "tag") {
        const { name, closing, selfClosing } = token;
        if (!closing && !selfClosing && VERBATIM_TAGS.has(name)) {
          const verbatimEnd = this.cursor.verbatimEnd(
            name,
            offset,
            tokenEnd,
            line.nextMarkdownStructure,
            this.recovery,
          );
          if (verbatimEnd !== undefined) {
            this.recovery?.confirmed(offset, verbatimEnd, verbatimEnd > line.nextMarkdownStructure);
            visible += " ".repeat(Math.min(verbatimEnd, end) - offset);
            offset = this.offset = verbatimEnd;
            lineEnd = "boundary";
            continue;
          }
        }
        const startsAtBoundary =
          lineEnd === "boundary" ||
          (lineEnd === "paired-close" && offset === this.offset) ||
          (!hasText && blockAligned && !isParagraph(previous) && /^ {0,3}$/.test(visible));
        const boundary = headingLine
          ? undefined
          : this.htmlBoundary(token, startsAtBoundary, owner);
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

function prepareSource(content: string) {
  const lines = content.split(/\r\n?|\n/);
  const columns = lines.map(expandIndent);
  const positions = sourceLines(content, lines);
  const documentFences = new FenceRange(columns, 0, 0);
  return { content, lines, columns, positions, documentFences };
}

function* walkSource(
  source: ReturnType<typeof prepareSource>,
  scanner: BoundaryScanner,
  owner = new Container(),
  firstLine = 0,
  ignored: ReadonlyMap<string, number> = new Map(),
  reportClose?: (start: number, end: number) => void,
): Generator<SourceEvent> {
  const { lines, columns, positions, documentFences } = source;
  function origin(index: number): ScanOrigin {
    const boundary = scanner.fork();
    const container = owner.fork();
    return (kinds, report) =>
      walkSource(source, boundary.fork(), container.fork(), index, kinds, report);
  }
  const recovery = new FenceRecovery(positions, ignored, origin(firstLine), reportClose);
  scanner.recovery = recovery;
  for (let index = firstLine; index < lines.length; index++) {
    const line = lines[index]!;
    const position = positions[index]!;
    if (recovery.needsOrigin && scanner.canResume(position)) recovery.resume(origin(index));
    const covered = scanner.coversStart(position);
    const hasPipe = line.includes("|") && scanner.hasPipeDelimiter(position);
    const placement = covered
      ? { owner, relative: line, marker: false, lazy: false, literal: false }
      : resolveContainer(owner, columns, index, hasPipe, position.lastBlank, documentFences);
    owner = placement.owner;
    const { relative, marker, lazy } = placement;
    const previous = owner.block;
    const fence = covered || lazy || placement.literal ? undefined : readFenceLine(relative);
    const wasRejected = owner.rejectedTilde && closesFence(owner.rejectedTilde, fence);
    if (wasRejected) owner.rejectedTilde = undefined;

    let codeLimit = position.inlineLimit;
    if (fence && !wasRejected) {
      const language = fenceLanguage(fence.info);
      const interrupts = canOpenFence(previous, fence);
      if (interrupts && language !== undefined) {
        const continued = !!placement.continued;
        let span = recovery.candidate(index, owner, continued);
        if (!span) {
          const range = continued
            ? owner.continuationRange(columns, index)
            : owner.parent
              ? owner.fenceRange(columns, index, fence, documentFences, position.lastBlank)
              : documentFences;
          const close = range.close(index);
          if (close !== undefined) {
            span = { owner, continued, open: index, close, language };
          } else {
            // An unmatched opener may still be inline code within its item.
            const end = positions[range.end]?.start;
            if (fence.marker === "`" && end !== undefined) codeLimit = Math.min(codeLimit, end);
          }
        }
        if (span) {
          yield span;
          owner.observeFencedBody(columns, index, span.close, documentFences);
          owner.block = "boundary";
          owner.rejectedTilde = undefined;
          index = span.close;
          continue;
        }
      } else if (fence.marker === "~" && language && !interrupts) {
        owner.rejectedTilde ??= fence;
      }
    }
    if (
      !covered &&
      (placement.literal ||
        (!lazy &&
          /^ {4}/.test(relative) &&
          (previous === "boundary" || (previous === "pipe-table" && !hasPipe))))
    ) {
      yield { line, index };
      owner.block = "boundary";
      continue;
    }
    const div = covered ? undefined : readDivFence(relative);
    if ((div === "open" && !isParagraph(previous)) || (div === "close" && owner.divDepth > 0)) {
      owner.divDepth += div === "open" ? 1 : -1;
      yield { line, index };
      owner.block = "boundary";
      continue;
    }

    // HTML token offsets and row widths use the original source offsets.
    const inItem = !!owner.parent && !covered && !lazy;
    const start = marker
      ? position.end - relative.length
      : inItem
        ? position.start + /^[ \t]*/.exec(line)![0].length
        : position.start;
    const aligned = !inItem || (!/^[ \t]/.test(relative) && !isParagraph(previous));
    if (owner.parent && line.includes("`")) {
      const next = positions[owner.inlineCodeEnd(columns, index)];
      if (next) codeLimit = Math.min(codeLimit, next.start);
    }
    const { visible, context } = scanner.scan(position, owner, start, aligned, codeLimit);
    const visibleLine = line.slice(0, start - position.start) + visible;
    yield { line: visibleLine, index };
    const blockLine =
      marker || placement.continued
        ? visible
        : inItem
          ? expandIndent(visibleLine).slice(owner.margin)
          : visibleLine;
    owner.block = context ?? classifyBlock(owner, blockLine, index, columns, hasPipe);
  }
}

export function scanMarkdownPdfFences(content: string): MarkdownFenceScan {
  const source = prepareSource(content);
  const cursor = new MarkdownSourceCursor(content);
  const result: MarkdownFenceScan = { ordinaryLines: [], fenceLanguages: [] };
  for (const event of walkSource(source, new BoundaryScanner(content, cursor))) {
    if ("line" in event) result.ordinaryLines.push(event.line);
    else if (event.language !== null) result.fenceLanguages.push(event.language);
  }
  return result;
}
