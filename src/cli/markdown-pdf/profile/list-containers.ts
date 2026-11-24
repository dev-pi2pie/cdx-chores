import {
  FenceRange,
  fenceLanguage,
  readDivFence,
  readFenceLine,
  type FenceLine,
} from "./fence-lines";

export const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const DEFINITION_MARKER = /^( {0,3})([:~])([ \t]+|$)/;
const BLOCK_SEPARATOR = /^ {0,3}(?:=+|-+|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})[ \t]*$/;
const LIST_MARKER = /^( {0,3})([-+*]|(?:#|\d+|[A-Za-z]+)[.)]|\((?:#|\d+|[A-Za-z]+)\))([ \t]+|$)/;
const ROMAN = /^M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/;

export type BlockContext = "boundary" | "paragraph" | "verse" | "pipe-table" | "definition-term";
export function isParagraph(block: BlockContext) {
  return block === "paragraph";
}

export class Container {
  block: BlockContext = "boundary";
  proseStart = -1;
  divDepth = 0;
  openHtmlBlocks?: Map<string, boolean[]>;
  rejectedTilde?: FenceLine;
  private ranges: { strict?: FenceRange; continuation?: FenceRange } = {};
  inContinuation = false;
  private inlineEnd = 0;

  // Inline code may continue through lazy prose, but cannot absorb a delimiter
  // from a sibling or a new child. Reuse the limit across lines of the item.
  inlineCodeEnd(lines: string[], index: number) {
    if (index < this.inlineEnd) return this.inlineEnd;
    let i = index + 1;
    for (; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.trim()) break;
      const destination = containerAtIndent(this, line);
      if (readMarker(line.slice(destination.margin), destination.margin)) break;
    }
    this.inlineEnd = i;
    return i;
  }

  constructor(
    readonly margin = 0,
    readonly parent?: Container,
    readonly orderedStyle?: string,
    readonly startLine = -1,
    readonly kind: "list" | "definition" | "quote" = "list",
  ) {}

  // Candidate discovery can advance independently while a multiline HTML
  // close is unresolved. Keep the mutable block and tag state private to it.
  fork(): Container {
    const chain: Container[] = [this];
    for (let item = this.parent; item; item = item.parent) chain.push(item);
    let copy: Container | undefined;
    for (const item of chain.reverse()) {
      copy = new Container(item.margin, copy, item.orderedStyle, item.startLine, item.kind);
      copy.block = item.block;
      copy.proseStart = item.proseStart;
      copy.divDepth = item.divDepth;
      if (item.openHtmlBlocks) {
        copy.openHtmlBlocks = new Map(
          Array.from(item.openHtmlBlocks, ([tag, stack]) => [tag, [...stack]]),
        );
      }
      copy.rejectedTilde = item.rejectedTilde;
      copy.inContinuation = item.inContinuation;
      copy.ranges = item.ranges;
    }
    return copy!;
  }

  fenceRange(lines: string[], index: number, opener: FenceLine) {
    const range = this.ranges.strict;
    if (!range || index < range.start || index >= range.end) {
      const project = this.kind === "quote" ? (line: string) => this.quoteLine(line) : undefined;
      return (this.ranges.strict = new FenceRange(lines, index, this.margin, opener, project));
    }
    return range;
  }

  // A marked line removes the quote prefix. An unmarked continuation within
  // the paragraph loses its leading whitespace and ends at a blank or a sibling.
  quoteLine(line: string) {
    const indent = /^ */.exec(line)![0].length;
    const relative = line.slice(Math.min(this.margin, indent));
    const mark = indent >= this.margin && /^ {0,3}>[ \t]?/.exec(relative);
    if (mark) return relative.slice(mark[0].length);
    if (!line.trim() || readMarker(relative, this.margin)) return;
    return line.trimStart();
  }

  // Before parsing blocks within an item, the reader separates its first run
  // of lines from continuations. A complete fence visible from the enclosing
  // margin ends that first run, even if its opener is a closer inside the item.
  observeFencedBody(lines: string[], open: number, close: number, document: FenceRange) {
    if (!this.parent || this.inContinuation) return;
    const first = Math.max(open, this.startLine + 1);
    const source = this.parent.parent ? this.parent.continuationRange(lines, first) : document;
    for (let i = first; i <= close; i++) {
      const candidate = source.at(i);
      if (candidate?.hasClose && fenceLanguage(candidate.info) !== undefined) {
        this.inContinuation = true;
        return;
      }
    }
  }

  continuationRange(lines: string[], start: number) {
    const range = this.ranges.continuation;
    if (!range || start < range.start || start >= range.end) {
      const project = (line: string, i: number, inside: string | undefined) => {
        if (inside !== undefined) return inside;
        if (!lines[i - 1]?.trim()) return;
        const destination = containerAtIndent(this, line);
        if (readMarker(line.slice(destination.margin), destination.margin)) return;
        return continuationLine(this, destination, line);
      };
      return (this.ranges.continuation = new FenceRange(
        lines,
        start,
        this.margin,
        undefined,
        project,
      ));
    }
    return range;
  }
}

function containerAtIndent(owner: Container, line: string) {
  const indent = /^ */.exec(line)![0].length;
  while (owner.parent && indent < owner.margin) owner = owner.parent;
  return owner;
}

// Each enclosing item strips its own marker width only if enough spaces remain.
// With widths three then two, two leading spaces survive the parent and align
// the text in the child. One leading space survives both items.
function continuationLine(owner: Container, destination: Container, line: string) {
  let offset = destination.margin;
  const indent = /^ */.exec(line)![0].length;
  if (indent === offset) return line.slice(offset);
  const widths = [];
  for (let item = owner; item !== destination; item = item.parent!) {
    widths.push(item.margin - item.parent!.margin);
  }
  for (let i = widths.length - 1; i >= 0; i--) {
    if (offset + widths[i]! <= indent) offset += widths[i]!;
  }
  return line.slice(offset);
}

function endColumn(whitespace: string, start: number) {
  let col = start;
  for (const char of whitespace) col += char === "\t" ? 4 - (col % 4) : 1;
  return col;
}

export function expandIndent(line: string) {
  return line.replace(/^[ \t]+/, (prefix) =>
    prefix.includes("\t") ? " ".repeat(endColumn(prefix, 0)) : prefix,
  );
}

function readMarker(line: string, margin: number, enclosingSymbol?: string, definition = false) {
  const match = (definition && DEFINITION_MARKER.exec(line)) || LIST_MARKER.exec(line);
  if (!match) return;
  const leading = match[1]!;
  const symbol = match[2]!;
  const padding = match[3]!;
  if (symbol !== enclosingSymbol && line.length > match[0].length && BLOCK_SEPARATOR.test(line))
    return;
  const letters = /[a-z]{2,}/i.exec(symbol)?.[0];
  if (
    letters &&
    (!ROMAN.test(letters.toUpperCase()) ||
      (letters !== letters.toLowerCase() && letters !== letters.toUpperCase()))
  )
    return;
  const end = margin + leading.length + symbol.length;
  const width = endColumn(padding, end) - end;
  const content = line.slice(match[0].length);
  if (content && /^[A-Z]\.$/.test(symbol) && width < 2) return;
  return {
    symbol,
    margin: end + (width > 4 ? 1 : width),
    content,
    literal: width > 4 && !!content,
  };
}

export function isPipeTableSeparator(line: string) {
  if (!line.includes("|")) return false;
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .every((cell) => /^:?-+:?$/.test(cell.trim()));
}

// Resolve ownership first, then ask whether the fence interrupts that paragraph.
function paragraphContinuation(
  owner: Container,
  destination: Container,
  line: string,
  lastBlank: number,
) {
  if (destination === owner || !isParagraph(owner.block)) return;
  const relative = line.slice(destination.margin);
  if (/^ *(?:`{3}|~{3})/.test(relative)) {
    const projected = continuationLine(owner, destination, line);
    let outer = owner;
    while (outer.parent && outer.parent !== destination) outer = outer.parent;
    // Markers on one line start the same first run. A fence visible at the
    // destination can end it before an inner marker consumes its indentation.
    const inItem =
      (projected !== relative && outer.startLine !== owner.startLine) ||
      owner.inContinuation ||
      lastBlank > owner.startLine;
    if (inItem) {
      const fence = readFenceLine(projected);
      if (fence && canOpenFence(owner.block, fence)) {
        return {
          owner,
          relative: projected,
          continued: true,
          lazy: false,
          marker: false,
          literal: false,
        };
      }
    } else if (readFenceLine(relative)) return;
  } else {
    const div = readDivFence(relative);
    if (div ? !destination.parent || div !== "open" : readMarker(relative, destination.margin))
      return;
  }
  return { owner, relative: line, lazy: true, marker: false, literal: false };
}

function orderedStyle(marker: string, sibling?: string) {
  const value = /[a-z]+|\d+|#/i.exec(marker)![0];
  const delimiter = marker.startsWith("(") ? "paired" : marker.slice(-1);
  if (value === "#") return sibling?.endsWith(delimiter) ? sibling : "decimal" + delimiter;
  if (/\d/.test(value)) return "decimal" + delimiter;
  const upper = value.toUpperCase();
  const letterCase = value === upper ? "upper" : "lower";
  const roman = letterCase + "Roman" + delimiter;
  if (sibling === roman && ROMAN.test(upper)) return roman;
  const alpha = letterCase + "Alpha" + delimiter;
  if (sibling === alpha && value.length === 1) return alpha;
  return value.length > 1 || upper === "I" ? roman : alpha;
}

function underlinesMarker(line: string, margin: number) {
  const relative = line.slice(Math.min(/^ */.exec(line)![0].length, margin));
  return /^(?:=+| {0,3}-+)[ \t]*$/.test(relative);
}

export function resolveContainer(
  current: Container,
  lines: string[],
  index: number,
  hasPipe: boolean,
  lastBlank: number,
) {
  const line = lines[index]!;
  if (current.kind === "quote") {
    const item = current.parent!;
    const destination = containerAtIndent(item, line);
    const endsFirstRun =
      destination !== item &&
      lastBlank <= item.startLine &&
      !item.inContinuation &&
      readFenceLine(line.slice(destination.margin));
    const relative = endsFirstRun ? undefined : current.quoteLine(line);
    if (relative !== undefined)
      return { owner: current, relative, marker: true, lazy: false, literal: false };
    current = current.parent!;
  }
  let owner = line.trim() ? containerAtIndent(current, line) : current;
  const continuation = paragraphContinuation(current, owner, line, lastBlank);
  if (continuation) return continuation;
  let relative = line.slice(owner.margin);

  const setext =
    isParagraph(owner.block) && owner.proseStart === index - 1 && /^(-+|=+)[ \t]*$/.test(relative);
  const canStartItem =
    (owner.parent || !isParagraph(owner.block)) &&
    !(owner.block === "verse" && /^[ \t]/.test(relative)) &&
    !(owner.block === "pipe-table" && hasPipe) &&
    !setext;
  let marker = false;
  if (canStartItem) {
    // A spaced run of bullets is a thematic break. Once that is ruled out,
    // consume compact markers from left to right using each new item's margin.
    let enclosingSymbol: string | undefined;
    for (;;) {
      const definition =
        owner.block === "definition-term" ||
        (current.kind === "definition" && current.parent === owner);
      const next = readMarker(relative, owner.margin, enclosingSymbol, definition);
      if (!next) break;
      let listStyle: string | undefined;
      if (!/^[-+*:~]$/.test(next.symbol)) {
        let sibling: Container | undefined = !marker && current !== owner ? current : undefined;
        while (sibling && sibling.parent !== owner) sibling = sibling.parent;
        const style = orderedStyle(next.symbol, sibling?.orderedStyle);
        // At the start of an ordered list, Pandoc gives a Setext title or
        // dashed simple-table underline precedence over the apparent marker.
        // A compatible sibling is already inside the ordered list.
        if (
          style !== sibling?.orderedStyle &&
          underlinesMarker(lines[index + 1] ?? "", owner.margin)
        ) {
          // The apparent marker is title text in this container, even when
          // earlier prose immediately precedes it.
          owner.proseStart = index;
          owner.block = "paragraph";
          break;
        }
        listStyle = style;
      }
      owner.block = "boundary";
      const kind = next.symbol === ":" || next.symbol === "~" ? "definition" : "list";
      owner = new Container(next.margin, owner, listStyle, index, kind);
      enclosingSymbol = next.symbol;
      marker = true;
      relative = next.content;
      if (next.literal) return { owner, relative, marker, lazy: false, literal: true };
    }
  }
  const quote = owner.parent && !isParagraph(owner.block) && /^ {0,3}>[ \t]?/.exec(relative);
  if (quote) {
    owner = new Container(owner.margin, owner, undefined, index, "quote");
    relative = relative.slice(quote[0].length);
    marker = true;
  }
  return { owner, relative, marker, lazy: false, literal: false };
}

export function canOpenFence(block: BlockContext, fence: FenceLine) {
  if (isParagraph(block)) return fence.marker === "`" && fence.indent === 0;
  if (block === "verse") return fence.indent === 0;
  return true;
}

export function classifyBlock(
  owner: Container,
  line: string,
  index: number,
  lines: string[],
  hasPipe: boolean,
): BlockContext {
  const previous = owner.block;
  if (!line.trim()) return previous === "definition-term" ? previous : "boundary";
  const next = lines[index + 1] ?? "";

  if (previous === "verse" && /^[ \t]/.test(line)) return "verse";
  if (
    !isParagraph(previous) &&
    hasPipe &&
    (previous === "pipe-table" || isPipeTableSeparator(next))
  )
    return "pipe-table";
  if (
    BLOCK_SEPARATOR.test(line) &&
    (!owner.parent ||
      !isParagraph(previous) ||
      (owner.proseStart === index - 1 && /^(-+|=+)[ \t]*$/.test(line)))
  )
    return "boundary";
  if (!isParagraph(previous)) {
    if (/^\|(?:[ \t]|$)/.test(line)) return line.trimEnd() === "|" ? "boundary" : "verse";
    if (ATX_HEADING.test(line) && (!owner.parent || line.startsWith("#"))) return "boundary";
    if (DEFINITION_MARKER.test(next.trim() ? next : (lines[index + 2] ?? "")))
      return "definition-term";

    owner.proseStart = index;
  }
  return "paragraph";
}
