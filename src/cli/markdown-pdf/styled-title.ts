import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, type DefaultTreeAdapterTypes as Html } from "parse5";
import type { StructTreeNode } from "pdfjs-dist/types/src/display/api";

import type { StyledTitleHeading } from "./ast-title";

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

function text(node: Html.Node): string {
  if ("value" in node && node.nodeName === "#text") return node.value;
  return "childNodes" in node ? node.childNodes.map(text).join("") : "";
}

function label(value: string) {
  return value.replace(/\s+/gu, " ").trim().toLowerCase();
}

function taggedText(node: StructTreeNode, content: Map<string, string>): string {
  return node.children
    .map((child) => ("role" in child ? taggedText(child, content) : (content.get(child.id) ?? "")))
    .join("");
}

function* bodyTitles(
  node: StructTreeNode,
  content: Map<string, string>,
  inMain = false,
): Generator<string> {
  // WeasyPrint tags <main> as Part. Page furniture and the built-in ToC are outside it.
  if (["BlockQuote", "L", "Table", "Note"].includes(node.role)) return;
  inMain ||= node.role === "Part";
  if (inMain && node.role === "H1") {
    yield taggedText(node, content);
    return;
  }
  for (const child of node.children) {
    if ("role" in child) yield* bodyTitles(child, content, inMain);
  }
}

async function printedHeadings(path: string): Promise<string[]> {
  const { getDocument, VerbosityLevel } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(await readFile(path)),
    useWorkerFetch: false,
    verbosity: VerbosityLevel.ERRORS,
  });
  try {
    const doc = await task.promise;
    const headings: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tree = await page.getStructTree();
      if (tree) {
        const content = new Map<string, string>();
        const stack: (string | undefined)[] = [];
        const { items } = await page.getTextContent({ includeMarkedContent: true });
        for (const item of items) {
          if ("str" in item) {
            const id = stack.at(-1);
            if (id) content.set(id, (content.get(id) ?? "") + item.str + (item.hasEOL ? " " : ""));
          } else if (item.type === "endMarkedContent") stack.pop();
          else stack.push(item.id ?? stack.at(-1));
        }
        headings.push(...bodyTitles(tree, content));
      }
      page.cleanup();
    }
    return headings;
  } finally {
    await task.destroy();
  }
}

export async function inspectPrintedTitle(
  html: string,
  tempDir: string,
  print: (html: string, pdf: string) => Promise<boolean>,
) {
  const htmlPath = join(tempDir, "title-proof.html");
  const pdfPath = join(tempDir, "title-proof.pdf");
  await writeFile(htmlPath, html);
  if (!(await print(htmlPath, pdfPath))) return [];
  return printedHeadings(pdfPath).catch(() => []);
}

/** Check the same body HTML and author CSS that would print with the metadata block omitted. */
export async function resolveStyledTitle(input: {
  html: string;
  customStyle: boolean;
  headings: StyledTitleHeading[];
  inlineMatch: boolean;
  inspect: (html: string) => Promise<string[]>;
}): Promise<string> {
  const nodes = [...elements(parse(input.html, { sourceCodeLocationInfo: true }))];
  const main = nodes.find(
    (node) => node.tagName === "main" && attribute(node, "class") === "document-body",
  );
  if (!main) return input.html;
  const header = main.childNodes.find(
    (node) =>
      "tagName" in node &&
      node.tagName === "header" &&
      attribute(node, "class") === "document-title",
  );
  const loc = header?.sourceCodeLocation;
  if (!loc) return input.html;
  const withoutTitle = input.html.slice(0, loc.startOffset) + input.html.slice(loc.endOffset);
  if (
    !input.customStyle &&
    !nodes.some(
      (node) =>
        node.tagName === "style" ||
        (node.tagName === "link" &&
          attribute(node, "rel")?.toLowerCase().split(/\s+/u).includes("stylesheet")),
    )
  ) {
    return input.inlineMatch ? withoutTitle : input.html;
  }

  // A printed label can occur in multiple source headings. Suppress only when all
  // possible origins are eligible and preserve the metadata title's text and links.
  const candidates = new Map(input.headings.map(({ id, matches }) => [id, matches]));
  const origins = new Map<string, Set<boolean | undefined>>();
  const seenIds = new Set<string>();
  for (const node of elements(main, true)) {
    if (node.tagName !== "h1" || node.sourceCodeLocation?.startOffset === undefined) continue;
    if (node.sourceCodeLocation.startOffset < loc.endOffset) continue;
    const id = attribute(node, "id");
    if (id && seenIds.has(id)) return input.html;
    if (id) seenIds.add(id);
    const key = label(text(node));
    const choices = origins.get(key) ?? new Set();
    choices.add(id ? candidates.get(id) : undefined);
    origins.set(key, choices);
  }
  for (const printed of await input.inspect(withoutTitle)) {
    const printedLabel = label(printed);
    const possibilities = origins.get(printedLabel);
    // A visibility:hidden heading can leave an empty H1 tag in the PDF.
    if (!printedLabel && !possibilities) continue;
    if (!possibilities) return input.html;
    if (possibilities.size === 1 && possibilities.has(undefined)) continue;
    return possibilities.size === 1 && possibilities.has(true) ? withoutTitle : input.html;
  }
  return input.html;
}
