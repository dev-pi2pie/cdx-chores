import { FenceRange, readDivFence, readFenceLine, type FenceLine } from "./fence-lines";

export const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const DEFINITION_MARKER = /^ {0,3}[:~] +/;
const BLOCK_SEPARATOR = /^ {0,3}(?:=+|-+|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})[ \t]*$/;
const LIST_MARKER = /^( {0,3})([-+*]|(?:#|\d+|[A-Za-z]+)[.)]|\((?:#|\d+|[A-Za-z]+)\))([ \t]+|$)/;
const ROMAN = /^M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/;

export type BlockContext =
  | "boundary"
  | "paragraph"
  | "item-prose"
  | "verse"
  | "pipe-table"
  | "definition-term"
  | { definitionIndent: number };
export function isParagraph(block: BlockContext) {
  return block === "paragraph" || block === "item-prose";
}

export class Container {
  block: BlockContext = "boundary";
  proseStart = -1;
  divDepth = 0;
  openHtmlBlocks?: Map<string, boolean[]>;
  rejectedTilde?: FenceLine;
  private fences?: FenceRange;
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
  ) {}

  fenceRange(lines: string[], index: number, opener: FenceLine) {
    if (!this.fences || index >= this.fences.end) {
      this.fences = new FenceRange(lines, index, this.margin, opener);
    }
    return this.fences;
  }
}

function containerAtIndent(owner: Container, line: string) {
  const indent = /^ */.exec(line)![0].length;
  while (owner.parent && indent < owner.margin) owner = owner.parent;
  return owner;
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

function readMarker(line: string, margin: number, enclosingSymbol?: string) {
  const match = LIST_MARKER.exec(line);
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

// A less-indented line can belong to the current paragraph. Test potential
// interruptions at the destination margin before dropping the child.
function continuesItem(owner: Container, destination: Container, relative: string) {
  if (!isParagraph(owner.block) || !owner.parent) return false;
  const fence = readFenceLine(relative);
  if (fence) return owner.block === "paragraph" && (fence.indent > 0 || fence.marker === "~");
  const div = readDivFence(relative);
  if (div) return !!destination.parent && div === "open";
  return !readMarker(relative, destination.margin);
}

export function resolveContainer(
  current: Container,
  line: string,
  index: number,
  hasPipe: boolean,
) {
  let owner = line.trim() ? containerAtIndent(current, line) : current;
  let relative = line.slice(owner.margin);
  if (owner !== current && continuesItem(current, owner, relative)) {
    return { owner: current, relative: line, lazy: true, marker: false, literal: false };
  }

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
      const next = readMarker(relative, owner.margin, enclosingSymbol);
      if (!next) break;
      owner.block = "boundary";
      owner = new Container(next.margin, owner);
      enclosingSymbol = next.symbol;
      marker = true;
      relative = next.content;
      if (next.literal) return { owner, relative, marker, lazy: false, literal: true };
    }
  }
  return { owner, relative, marker, lazy: false, literal: false };
}

export function canOpenFence(block: BlockContext, fence: FenceLine) {
  if (isParagraph(block)) return fence.marker === "`" && fence.indent === 0;
  if (block === "verse") return fence.indent === 0;
  return typeof block !== "object" || fence.indent < block.definitionIndent;
}

export function classifyBlock(
  owner: Container,
  line: string,
  index: number,
  lines: string[],
  marker: boolean,
  hasPipe: boolean,
): BlockContext {
  const previous = owner.block;
  if (!line.trim()) return previous === "definition-term" ? previous : "boundary";
  const next = lines[index + 1] ?? "";
  if (previous === "definition-term") {
    const match = DEFINITION_MARKER.exec(line);
    if (match) return { definitionIndent: match[0].length };
  }
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
    if (typeof previous === "object") return previous;
    owner.proseStart = index;
  }
  return marker || previous === "item-prose" ? "item-prose" : "paragraph";
}
