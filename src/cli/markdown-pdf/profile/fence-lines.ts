type FenceMarker = "`" | "~";

export interface FenceLine {
  marker: FenceMarker;
  indent: number;
  length: number;
  info: string;
  hasClose: boolean;
}

export function readFenceLine(line: string): FenceLine | undefined {
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

export function fenceLanguage(info: string): string | null | undefined {
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

export function readDivFence(line: string): "open" | "close" | undefined {
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

export function closesFence(opener: FenceLine, candidate: FenceLine | undefined): boolean {
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

// One contiguous run of lines inside a container. The reverse pass rules out
// unmatched openers in O(1); a successful forward search consumes its body.
export class FenceRange {
  private readonly candidates: (FenceLine | undefined)[] = [];
  readonly end: number;

  constructor(
    lines: string[],
    readonly start: number,
    margin: number,
    opener?: FenceLine,
    project?: (line: string, index: number, inside: string | undefined) => string | undefined,
  ) {
    const padding = " ".repeat(margin);
    let i = start;
    for (; i < lines.length; i++) {
      const line = lines[i]!;
      if (i === start && opener) {
        this.candidates.push(opener);
        continue;
      }
      const inside = line.startsWith(padding) || !line.trim() ? line.slice(margin) : undefined;
      const relative = project ? project(line, i, inside) : inside;
      if (relative === undefined) break;
      this.candidates.push(readFenceLine(relative));
    }
    this.end = i;
    markCandidatesWithClosers(this.candidates);
  }

  at(index: number) {
    return this.candidates[index - this.start];
  }

  close(index: number): number | undefined {
    const relative = index - this.start;
    const fence = this.candidates[relative];
    if (fence?.hasClose) return this.start + fenceClose(this.candidates, relative, fence);
    return undefined;
  }
}
