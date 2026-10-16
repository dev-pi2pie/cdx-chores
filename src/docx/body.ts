import type { DocxDocumentFacts } from "./types";
import { children, elementText, first, type Element } from "./xml";

interface Inline {
  raw: string;
  heading: string;
  content: boolean;
  deferred: Element[];
}

const inlineContainers = new Set(["w:r", "w:hyperlink", "w:ins", "w:customXml", "w:smartTag"]);
const blockContainers = new Set([
  "w:tr",
  "w:tc",
  "w:sdtContent",
  "v:shape",
  "v:textbox",
  "w:txbxContent",
]);

export function documentBodyFacts(
  body: Element,
  headingLevel: (paragraph: Element) => number | undefined,
  embeddedImages: ReadonlySet<string>,
): Pick<DocxDocumentFacts, "headings" | "rawText" | "hasContent" | "diagnostics"> {
  const headings: DocxDocumentFacts["headings"] = [];
  const raw: string[] = [];
  let hasContent = false;
  const diagnostics = new Set<string>();

  function imageContent(parent: Element): boolean {
    for (const node of children(parent)) {
      if (node.name === "a:blip" && embeddedImages.has(node.attributes.get("r:embed") ?? ""))
        return true;
      if (node.name === "v:imagedata" && embeddedImages.has(node.attributes.get("r:id") ?? ""))
        return true;
      if (imageContent(node)) return true;
    }
    return false;
  }

  function inline(parent: Element): Inline {
    const result: Inline = { raw: "", heading: "", content: false, deferred: [] };
    for (const node of children(parent)) {
      if (node.name === "w:t") {
        const value = elementText(node);
        result.raw += value;
        result.heading += value;
        result.content ||= value.length > 0;
      } else if (node.name === "w:tab") {
        result.raw += "\t";
        result.heading += "\t";
        result.content = true;
      } else if (node.name === "w:br") {
        if ([undefined, "textWrapping"].includes(node.attributes.get("w:type"))) {
          result.heading += " ";
          result.content = true;
        }
      } else if (node.name === "w:pict" || node.name === "w:drawing") {
        result.content ||= imageContent(node);
        if (node.name === "w:pict") result.deferred.push(node);
      } else if (inlineContainers.has(node.name) || node.name === "w:sdt") {
        const nested = inline(node.name === "w:sdt" ? (first(node, "w:sdtContent") ?? node) : node);
        result.raw += nested.raw;
        result.heading += nested.heading;
        result.content ||= nested.content;
        for (const deferred of nested.deferred) result.deferred.push(deferred);
      } else if (
        ["w:sym", "w:footnoteReference", "w:endnoteReference", "w:fldSimple"].includes(node.name)
      ) {
        diagnostics.add(`docx_initial_unsupported:${node.name}`);
      }
    }
    return result;
  }

  function blocks(parent: Element): void {
    for (const node of children(parent)) {
      if (node.name === "w:p") {
        const value = inline(node);
        raw.push(value.raw, "\n\n");
        hasContent ||= value.content;
        const level = headingLevel(node);
        const text = value.heading.replace(/\s+/g, " ").trim();
        if (level !== undefined && text) headings.push({ level, text });
        for (const deferred of value.deferred) blocks(deferred);
      } else if (node.name === "w:tbl") {
        hasContent = true;
        blocks(node);
      } else if (blockContainers.has(node.name)) blocks(node);
      else if (node.name === "w:sdt") {
        const content = first(node, "w:sdtContent");
        if (content) blocks(content);
      }
    }
  }

  blocks(body);
  const rawText = raw.join("");
  return {
    headings,
    rawText,
    hasContent: hasContent || rawText.trim().length > 0,
    diagnostics: [...diagnostics],
  };
}
