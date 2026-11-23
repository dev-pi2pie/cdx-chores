interface SourceSpan {
  start: number;
  end: number;
  recoveryBoundary?: number;
}

export type MarkdownSourceToken =
  | { kind: "comment" | "code" | "text"; end: number }
  | { kind: "tag"; end: number; name: string; closing: boolean; selfClosing: boolean };

export interface SourceLimits {
  inlineLimit: number;
  tagLimit: number;
  nextMarkdownStructure: number;
}

const TAG_START = /<(\/?)([a-z][a-z0-9-]*)(?=[\s/>])/iy;
const SPACE = /\s*/y;
const ATTRIBUTE = /[^\s"'<>/=]+/y;
const ATTRIBUTE_VALUE = /[^\s"'`=<>]+/y;

export class MarkdownSourceCursor {
  private readonly delimiters = new Map<string | number, SourceSpan[]>();
  private readonly outsideFences = new Map<string, SourceSpan[]>();

  constructor(
    private readonly source: string,
    fenceRecoveryBoundary: (delimiter: number) => number | undefined,
  ) {
    const markers = /`+|<!--|-->|["']|<\/(pre|script|style|textarea)[\t \r\n]*>/gi;
    for (const match of source.matchAll(markers)) {
      const part = match[0];
      const key = match[1]?.toLowerCase() ?? (part.startsWith("`") ? part.length : part);
      const span = { start: match.index, end: match.index + part.length };
      if (typeof key === "string" && (part.startsWith("<") || part === "-->")) {
        const recoveryBoundary = fenceRecoveryBoundary(span.start);
        this.add(this.delimiters, key, { ...span, recoveryBoundary });
        if (recoveryBoundary === undefined) this.add(this.outsideFences, key, span);
      } else {
        this.add(this.delimiters, key, span);
      }
    }
  }

  private add<Key>(index: Map<Key, SourceSpan[]>, key: Key, span: SourceSpan): void {
    const spans = index.get(key);
    if (spans) spans.push(span);
    else index.set(key, [span]);
  }

  private next(spans: SourceSpan[] | undefined, offset: number): SourceSpan | undefined {
    if (!spans) return undefined;
    let low = 0;
    let high = spans.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (spans[middle]!.start < offset) low = middle + 1;
      else high = middle;
    }
    return spans[low];
  }

  private matchingEnd(key: string, start: number, offset: number): SourceSpan | undefined {
    const close = this.next(this.delimiters.get(key), offset);
    if (close?.recoveryBoundary !== undefined && start < close.recoveryBoundary) {
      // Recovery boundaries only advance, so a later fenced delimiter also
      // cannot close this opener.
      return this.next(this.outsideFences.get(key), close.end);
    }
    return close;
  }

  verbatimEnd(name: string, start: number, offset: number): number | undefined {
    return this.matchingEnd(name, start, offset)?.end;
  }

  private readTag(
    start: number,
    inlineLimit: number,
    tagLimit: number,
  ): MarkdownSourceToken | undefined {
    TAG_START.lastIndex = start;
    const match = TAG_START.exec(this.source);
    if (!match) return undefined;
    const closing = match[1] === "/";
    const name = match[2]!.toLowerCase();
    let limit = tagLimit;
    let cursor = TAG_START.lastIndex;
    while (cursor < limit) {
      SPACE.lastIndex = cursor;
      SPACE.exec(this.source);
      const next = SPACE.lastIndex;
      const selfClosing = !closing && this.source.startsWith("/>", next);
      const end = next + (selfClosing ? 2 : 1);
      if (end <= limit && (selfClosing || this.source[next] === ">")) {
        return { kind: "tag", end, name, closing, selfClosing };
      }
      if (closing || next === cursor || next >= limit) return undefined;
      ATTRIBUTE.lastIndex = next;
      if (!ATTRIBUTE.exec(this.source)) return undefined;
      cursor = ATTRIBUTE.lastIndex;
      SPACE.lastIndex = cursor;
      SPACE.exec(this.source);
      if (this.source[SPACE.lastIndex] !== "=" || SPACE.lastIndex >= limit) continue;
      SPACE.lastIndex++;
      SPACE.exec(this.source);
      const valueStart = SPACE.lastIndex;
      if (valueStart >= limit) return undefined;
      const quote = this.source[valueStart];
      if (quote === '"' || quote === "'") {
        const close = this.next(this.delimiters.get(quote), valueStart + 1);
        if (!close || close.end > inlineLimit) return undefined;
        // Markdown-looking text can appear inside a quoted attribute. Once the
        // quote closes, the rest of the tag must follow valid attribute syntax.
        if (close.end > limit) limit = inlineLimit;
        cursor = close.end;
      } else {
        ATTRIBUTE_VALUE.lastIndex = valueStart;
        if (!ATTRIBUTE_VALUE.exec(this.source)) return undefined;
        cursor = ATTRIBUTE_VALUE.lastIndex;
      }
    }
  }

  read(
    start: number,
    { inlineLimit, tagLimit, nextMarkdownStructure }: SourceLimits,
  ): MarkdownSourceToken | undefined {
    const ch = this.source[start];
    if (ch === "\\" && /[<`\\]/.test(this.source[start + 1] ?? "")) {
      return { kind: "text", end: start + 2 };
    }
    if (ch === "`") {
      let end = start + 1;
      while (this.source[end] === "`") end++;
      const close = this.next(this.delimiters.get(end - start), end);
      return close && close.end <= inlineLimit
        ? { kind: "code", end: close.end }
        : { kind: "text", end };
    }
    if (ch !== "<") return undefined;
    if (!this.source.startsWith("<!--", start)) return this.readTag(start, inlineLimit, tagLimit);

    const close = this.matchingEnd("-->", start, start + 4);
    if (!close) return undefined;
    const nextOpen = this.matchingEnd("<!--", start, start + 4);
    // Pandoc treats an inner opener as literal comment text. Recover at a
    // separate opener only when visible Markdown intervenes before it.
    if (nextOpen && nextMarkdownStructure <= nextOpen.start && nextOpen.start < close.start) {
      return undefined;
    }
    return { kind: "comment", end: close.end };
  }
}
