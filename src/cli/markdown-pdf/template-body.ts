import { parse, type DefaultTreeAdapterTypes } from "parse5";

const DOCUMENT_BODY_CLASS = "document-body";
const PANDOC_BODY_INSERTION = "$body$";
const INERT_TEXT_CONTAINER_TAGS = new Set([
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
  "script",
  "style",
  "textarea",
  "title",
  "xmp",
]);

type Parse5Node = DefaultTreeAdapterTypes.Node;
type Parse5Element = DefaultTreeAdapterTypes.Element;

export type MarkdownPdfTemplateBodyStatus =
  | "proven"
  | "missing-hook"
  | "duplicate-hook"
  | "missing-insertion"
  | "duplicate-insertion"
  | "unrelated-insertion";

export interface MarkdownPdfTemplateBodyInspection {
  status: MarkdownPdfTemplateBodyStatus;
  hookCount: number;
  insertionCount: number;
}

function isElement(node: Parse5Node): node is Parse5Element {
  return "tagName" in node;
}

function hasClass(node: Parse5Element, className: string): boolean {
  const value = node.attrs.find((attribute) => attribute.name === "class")?.value;
  return value?.split(/\s+/u).includes(className) === true;
}

function countOccurrences(value: string, search: string): number {
  let count = 0;
  let offset = 0;
  while ((offset = value.indexOf(search, offset)) >= 0) {
    count += 1;
    offset += search.length;
  }
  return count;
}

function inspectNode(
  node: Parse5Node,
  containingHook: Parse5Element | undefined,
  hooks: Parse5Element[],
  insertionOwners: Array<Parse5Element | undefined>,
): void {
  const hook = isElement(node) && hasClass(node, DOCUMENT_BODY_CLASS) ? node : containingHook;
  if (isElement(node) && hook === node) {
    hooks.push(node);
  }

  if (isElement(node) && INERT_TEXT_CONTAINER_TAGS.has(node.tagName)) {
    return;
  }

  if (node.nodeName === "#text" && "value" in node && typeof node.value === "string") {
    const occurrenceCount = countOccurrences(node.value, PANDOC_BODY_INSERTION);
    for (let index = 0; index < occurrenceCount; index += 1) {
      insertionOwners.push(hook);
    }
  }

  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      inspectNode(child, hook, hooks, insertionOwners);
    }
  }
}

/**
 * Proves the body boundary from parsed, executable HTML structure.
 *
 * Pandoc body tokens in comments, attributes, raw-text containers,
 * escapable-raw-text containers, and inert template content are not live body
 * insertion points and therefore do not count.
 */
export function inspectMarkdownPdfTemplateBody(
  templateHtml: string,
): MarkdownPdfTemplateBodyInspection {
  const document = parse(templateHtml);
  const hooks: Parse5Element[] = [];
  const insertionOwners: Array<Parse5Element | undefined> = [];
  inspectNode(document, undefined, hooks, insertionOwners);

  const hookCount = hooks.length;
  const insertionCount = insertionOwners.length;
  let status: MarkdownPdfTemplateBodyStatus;

  if (hookCount === 0) {
    status = "missing-hook";
  } else if (hookCount > 1) {
    status = "duplicate-hook";
  } else if (insertionCount === 0) {
    status = "missing-insertion";
  } else if (insertionCount > 1) {
    status = "duplicate-insertion";
  } else if (insertionOwners[0] !== hooks[0]) {
    status = "unrelated-insertion";
  } else {
    status = "proven";
  }

  return { status, hookCount, insertionCount };
}
