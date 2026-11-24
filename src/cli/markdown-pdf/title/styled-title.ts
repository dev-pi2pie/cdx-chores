import { parse, type DefaultTreeAdapterTypes as Html } from "parse5";
import type { StyledTitleHeading } from "./ast-title";
import type { SourceTitleProbe } from "./printed-proof";

function* elements(node: Html.Node, bodyOnly = false): Generator<Html.Element> {
  if ("tagName" in node) {
    if (bodyOnly && ["blockquote", "dl", "ol", "ul", "table"].includes(node.tagName)) return;
    yield node;
  }
  if ("childNodes" in node) {
    for (const child of node.childNodes) yield* elements(child, bodyOnly);
  }
}

function attribute(node: Html.Element, name: string) {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

function substituteWord(word: string) {
  const reverse = Array.from(word).reverse().join("");
  if (reverse !== word) return reverse;
  // A palindrome or a single character still needs an observable change.
  return word.replace(/./gu, (char) => (char === "x" ? "y" : "x"));
}

interface TextEdit {
  start: number;
  end: number;
  text: string;
  substitute: string;
}

function collectText(node: Html.ChildNode, parts: TextEdit[]): boolean {
  if (node.nodeName === "#text" && "value" in node && node.sourceCodeLocation) {
    parts.push({
      start: node.sourceCodeLocation.startOffset,
      end: node.sourceCodeLocation.endOffset,
      text: node.value,
      substitute: node.value.replace(/\S+/gu, substituteWord),
    });
    return true;
  }
  if (!("tagName" in node) || !["em", "strong", "a", "code"].includes(node.tagName)) return false;
  return node.childNodes.every((child) => collectText(child, parts));
}

function replaceText(html: string, edits: TextEdit[]) {
  const pieces: string[] = [];
  let start = 0;
  for (const edit of edits) {
    pieces.push(
      html.slice(start, edit.start),
      edit.substitute.replaceAll("&", "&amp;").replaceAll("<", "&lt;"),
    );
    start = edit.end;
  }
  pieces.push(html.slice(start));
  return pieces.join("");
}

function headingProbes(html: string, headings: StyledTitleHeading[]): SourceTitleProbe[] {
  const nodes = [...elements(parse(html, { sourceCodeLocationInfo: true }))];
  const ids = new Set<string>();
  const duplicates = new Set<string>();
  for (const node of nodes) {
    const id = attribute(node, "id");
    if (!id) continue;
    if (ids.has(id)) duplicates.add(id);
    ids.add(id);
  }
  const main = nodes.find((n) => n.tagName === "main" && attribute(n, "class") === "document-body");
  if (!main) return [];
  const byId = new Map(headings.map((h, index) => [h.id, index]));
  if (byId.size !== headings.length) return [];
  const candidates: SourceTitleProbe[] = [];
  const order: string[] = [];
  for (const node of elements(main, true)) {
    if (node.tagName !== "h1") continue;
    const id = attribute(node, "id");
    if (!id || !byId.has(id)) continue;
    const index = byId.get(id)!;
    if (index !== order.length || duplicates.has(id)) return [];
    order.push(id);
    const heading = headings[index]!;
    if (!heading.matches) continue;
    const edits: TextEdit[] = [];
    if (!node.childNodes.every((child) => collectText(child, edits))) continue;
    const text = edits
      .map((edit) => edit.text)
      .join("")
      .replace(/\s+/gu, " ")
      .trim();
    const substitute = edits
      .map((edit) => edit.substitute)
      .join("")
      .replace(/\s+/gu, " ")
      .trim();
    if (text !== heading.text?.replace(/\s+/gu, " ").trim() || text === substitute) continue;
    candidates.push({
      id,
      text,
      substitute,
      get earlierIds() {
        return order.slice(0, index);
      },
      get html() {
        return replaceText(html, edits);
      },
    });
  }
  return order.length === headings.length ? candidates : [];
}

/** Decide against the body layout that would print with the metadata header omitted. */
export async function resolveStyledTitle(input: {
  html: string;
  customStyle: boolean;
  headings: StyledTitleHeading[];
  inlineMatch: boolean;
  inspect: (
    html: string,
    candidates: SourceTitleProbe[],
  ) => Promise<{ sourceId?: string; complete?: boolean }>;
}): Promise<string> {
  const nodes = [...elements(parse(input.html, { sourceCodeLocationInfo: true }))];
  const main = nodes.find(
    (node) => node.tagName === "main" && attribute(node, "class") === "document-body",
  );
  const header = main?.childNodes.find(
    (node) =>
      "tagName" in node &&
      node.tagName === "header" &&
      attribute(node, "class") === "document-title",
  );
  const loc = header?.sourceCodeLocation;
  if (!loc) return input.html;
  const withoutTitle = input.html.slice(0, loc.startOffset) + input.html.slice(loc.endOffset);
  const styled =
    input.customStyle ||
    nodes.some(
      (node) =>
        node.tagName === "style" ||
        (node.tagName === "link" &&
          attribute(node, "rel")?.toLowerCase().split(/\s+/u).includes("stylesheet")),
    );
  if (!styled) return input.inlineMatch ? withoutTitle : input.html;
  const candidates = headingProbes(withoutTitle, input.headings);
  if (!candidates.length) return input.html;
  const proof = await input.inspect(withoutTitle, candidates);
  return proof.complete === true && candidates.some((candidate) => candidate.id === proof.sourceId)
    ? withoutTitle
    : input.html;
}
