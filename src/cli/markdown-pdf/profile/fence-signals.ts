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

type BlockContext =
  | "boundary"
  | "paragraph"
  | "pipe-table"
  | "html-comment"
  | "definition-term"
  | { listIndent: number };

const DEFINITION_MARKER = /^ {0,3}[:~] +/;
const HTML_BLOCK_END =
  /^ {0,3}(?:<(?:hr|meta|col)(?=[ \t/>])[^>]*>|<(?:[a-z][^>]*>.*<)?\/(?:div|section|article|aside|figure|table|blockquote|pre|main|script|style|textarea)>)[ \t]*$/i;

function isPipeTableSeparator(line: string): boolean {
  if (!line.includes("|")) return false;
  const cells = line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|");
  return cells.length > 1 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

function blockContext(
  lines: string[],
  index: number,
  previous: BlockContext,
  lastCommentClose: number,
): BlockContext {
  const line = lines[index]!;
  const nextLine = lines[index + 1] ?? "";
  if (
    previous === "html-comment" ||
    (previous !== "paragraph" && index <= lastCommentClose && /^ {0,3}<!--/.test(line))
  ) {
    const close = line.indexOf("-->");
    if (close === -1) return "html-comment";
    return line.slice(close + 3).trim() ? "paragraph" : "boundary";
  }
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
  if (HTML_BLOCK_END.test(line)) return "boundary";
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

export function scanMarkdownPdfFences(content: string): MarkdownFenceScan {
  const lines = content.split(/\r\n?|\n/);
  const fences = lines.map(readFenceLine);
  const lastCommentClose = lines.findLastIndex((line) => line.includes("-->"));
  markCandidatesWithClosers(fences);

  const ordinaryLines: string[] = [];
  const fenceLanguages: string[] = [];
  let context: BlockContext = "boundary";
  for (let index = 0; index < lines.length; index++) {
    const fence = fences[index];
    if (
      fence?.hasClose &&
      context !== "html-comment" &&
      (typeof context !== "object" || fence.indent < context.listIndent) &&
      (fence.marker === "`" || context !== "paragraph")
    ) {
      const language = fenceLanguage(fence.info);
      if (language !== undefined) {
        if (language !== null) fenceLanguages.push(language);
        do {
          index++;
        } while (index < fences.length && !closesFence(fence, fences[index]));
        context = "boundary";
        continue;
      }
    }
    const line = lines[index]!;
    ordinaryLines.push(line);
    context = blockContext(lines, index, context, lastCommentClose);
  }
  return { ordinaryLines, fenceLanguages };
}
