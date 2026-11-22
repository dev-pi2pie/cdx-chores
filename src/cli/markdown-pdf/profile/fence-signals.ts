type FenceMarker = "`" | "~";

interface FenceLine {
  marker: FenceMarker;
  length: number;
  info: string;
  hasClose: boolean;
}

interface MarkdownFenceScan {
  ordinaryLines: string[];
  fenceLanguages: string[];
}

function readFenceLine(line: string): FenceLine | undefined {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  const run = match?.[1];
  if (!run) return undefined;
  return {
    marker: run.startsWith("`") ? "`" : "~",
    length: run.length,
    info: (match[2] ?? "").replace(/^[ \t]+|[ \t]+$/g, ""),
    hasClose: false,
  };
}

function fenceLanguage(info: string): string | undefined {
  const match = /^([^\s`{}]*)(?:[ \t]*\{(.*)\})?$/.exec(info);
  if (!match) return undefined;

  const attributes = match[2]?.trim() ?? "";
  const token = /([.#][^\s{}]+|[^\s{}=]+=(?:"[^"\n]*"|'[^'\n]*'|[^\s{}]+))(?:[ \t]+|$)/gy;
  let firstClass: string | undefined;
  while (token.lastIndex < attributes.length) {
    const attribute = token.exec(attributes)?.[1];
    if (!attribute) return undefined;
    if (attribute.startsWith(".")) firstClass ??= attribute.slice(1);
  }
  return (match[1] || firstClass || "").toLowerCase();
}

type BlockContext = "boundary" | "paragraph" | "pipe-table";

function isPipeTableSeparator(line: string): boolean {
  if (!line.includes("|")) return false;
  const cells = line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|");
  return cells.length > 1 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

function blockContext(line: string, nextLine: string, previous: BlockContext): BlockContext {
  if (!line.trim()) return "boundary";
  if (line.includes("|") && (previous === "pipe-table" || isPipeTableSeparator(nextLine))) {
    return "pipe-table";
  }
  if (/^ {0,3}(?:=+|-+|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,}|(?:-[ \t]*){3,})[ \t]*$/.test(line)) {
    return "boundary";
  }
  if (
    previous !== "paragraph" &&
    /^(?: {0,3}(?:#{1,6}(?:[ \t]|$)|(?:[-+*]|\d+[.)])[ \t])| {4}|\t)/.test(line)
  ) {
    return "boundary";
  }
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

export function scanMarkdownPdfFences(content: string): MarkdownFenceScan {
  const lines = content.split(/\r\n?|\n/);
  const fences = lines.map(readFenceLine);
  markCandidatesWithClosers(fences);

  const ordinaryLines: string[] = [];
  const fenceLanguages: string[] = [];
  let context: BlockContext = "boundary";
  for (let index = 0; index < lines.length; index++) {
    const fence = fences[index];
    if (fence?.hasClose && (fence.marker === "`" || context !== "paragraph")) {
      const language = fenceLanguage(fence.info);
      if (language !== undefined) {
        fenceLanguages.push(language);
        do {
          index++;
        } while (index < fences.length && !closesFence(fence, fences[index]));
        context = "boundary";
        continue;
      }
    }
    const line = lines[index]!;
    ordinaryLines.push(line);
    context = blockContext(line, lines[index + 1] ?? "", context);
  }
  return { ordinaryLines, fenceLanguages };
}
