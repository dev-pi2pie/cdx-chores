import { readSymbol } from "./symbols";
import { children, elementText, first, type Element } from "./xml";

export type Content =
  | { kind: "text"; value: string }
  | {
      kind: "p" | "r" | "table" | "tr" | "td" | "link";
      node: Element;
      children: Content[];
      href?: string;
    }
  | { kind: "break"; value: string; node: Element }
  | { kind: "image"; id: string }
  | { kind: "bookmark" }
  | { kind: "checkbox" }
  | { kind: "comment"; id: string; node: Element }
  | { kind: "note"; noteType: "footnote" | "endnote"; id: string };

interface ReadResult {
  values: Content[];
  extra: Content[];
}
interface Field {
  node: Element;
  href?: string;
  anchor?: string;
  checkbox?: boolean;
}
const passthrough = new Set([
  "w:hyperlink",
  "w:customXml",
  "w:ins",
  "w:moveTo",
  "w:object",
  "w:smartTag",
  "w:drawing",
  "v:roundrect",
  "v:shape",
  "v:textbox",
  "w:txbxContent",
  "v:group",
  "v:rect",
]);

/** Construct semantic children eagerly, before style suppression or note selection. */
export function readContent(
  parent: Element,
  diagnostics: Set<string>,
  numberingFor?: (node: Element) => unknown,
): Content[] {
  let deletedParagraph: Element[] = [];
  const fields: Field[] = [];
  let instruction: string[] = [];
  function parseField(field: Field): Field {
    const text = instruction.join("");
    const link = /^\s*HYPERLINK\s+(\\l\s+)?(?:"(.*)"|([^\\]\S*))/.exec(text);
    if (link) {
      const target = link[2] ?? link[3]!;
      return link[1] ? { ...field, anchor: target } : { ...field, href: target };
    }
    return { ...field, checkbox: /\s*FORMCHECKBOX\s*/.test(text) };
  }
  function sequence(values: Element[]): ReadResult {
    const result: ReadResult = { values: [], extra: [] };
    for (const value of values) {
      const read = element(value);
      result.values.push(...read.values);
      result.extra.push(...read.extra);
    }
    return result;
  }
  function nested(node: Element): ReadResult {
    return sequence(children(node));
  }
  function element(node: Element): ReadResult {
    const value = (item: Content): ReadResult => ({ values: [item], extra: [] });
    const empty = (): ReadResult => ({ values: [], extra: [] });
    if (node.name === "w:t") return value({ kind: "text", value: elementText(node) });
    if (node.name === "w:tab") return value({ kind: "text", value: "\t" });
    if (node.name === "w:noBreakHyphen") return value({ kind: "text", value: "\u2011" });
    if (node.name === "w:softHyphen") return value({ kind: "text", value: "\u00ad" });
    if (node.name === "w:sym") {
      const symbol = readSymbol(node, diagnostics);
      return symbol === undefined ? empty() : value({ kind: "text", value: symbol });
    }
    if (node.name === "w:instrText") {
      instruction.push(elementText(node));
      return empty();
    }
    if (node.name === "w:fldChar") {
      const type = node.attributes.get("w:fldCharType");
      if (type === "begin") {
        fields.push({ node });
        instruction = [];
      } else if (type === "separate") {
        const field = fields.pop();
        if (field) fields.push(parseField(field));
      } else if (type === "end") {
        const field = fields.pop();
        if (field && (field.checkbox || parseField(field).checkbox))
          return value({ kind: "checkbox" });
      }
      return empty();
    }
    if (node.name === "w:footnoteReference" || node.name === "w:endnoteReference")
      return value({
        kind: "note",
        noteType: node.name === "w:footnoteReference" ? "footnote" : "endnote",
        id: node.attributes.get("w:id") ?? "undefined",
      });
    if (node.name === "w:commentReference")
      return value({ kind: "comment", id: node.attributes.get("w:id") ?? "undefined", node });
    if (node.name === "w:br") {
      const type = node.attributes.get("w:type");
      if ([undefined, "textWrapping", "page", "column"].includes(type))
        return value({
          kind: "break",
          value: type === "page" || type === "column" ? type : "line",
          node,
        });
      return empty();
    }
    if (node.name === "w:bookmarkStart")
      return node.attributes.get("w:name") === "_GoBack" ? empty() : value({ kind: "bookmark" });
    if (node.name === "v:imagedata") {
      const id = node.attributes.get("r:id");
      return id ? value({ kind: "image", id }) : empty();
    }
    if (node.name === "a:blip") {
      const id = node.attributes.get("r:embed");
      return id ? value({ kind: "image", id }) : empty();
    }
    if (node.name === "wp:inline" || node.name === "wp:anchor") {
      const images: Content[] = [];
      function scan(value: Element): void {
        if (value.name === "a:blip") {
          const id = value.attributes.get("r:embed");
          if (id) images.push({ kind: "image", id });
        } else for (const child of children(value)) scan(child);
      }
      scan(node);
      return { values: images, extra: [] };
    }
    if (node.name === "w:p") {
      const deleted = first(first(first(node, "w:pPr"), "w:rPr"), "w:del");
      if (deleted) {
        deletedParagraph.push(...children(node));
        return empty();
      }
      numberingFor?.(node);
      const pending = deletedParagraph;
      deletedParagraph = [];
      const read = sequence([...pending, ...children(node)]);
      return { values: [{ kind: "p", node, children: read.values }, ...read.extra], extra: [] };
    }
    if (
      node.name === "w:r" ||
      node.name === "w:tbl" ||
      node.name === "w:tr" ||
      node.name === "w:tc"
    ) {
      if (node.name === "w:tr" && first(first(node, "w:trPr"), "w:del")) return empty();
      const read = nested(node);
      const kind = ({ "w:r": "r", "w:tbl": "table", "w:tr": "tr", "w:tc": "td" } as const)[
        node.name
      ];
      if (kind === "r") {
        const link = fields.findLast(
          (field) => field.href !== undefined || field.anchor !== undefined,
        );
        if (link) {
          const attributes = new Map<string, string>();
          if (link.anchor !== undefined) attributes.set("w:anchor", link.anchor);
          const linkNode: Element = { name: "w:hyperlink", attributes, children: [] };
          read.values = [{ kind: "link", node: linkNode, href: link.href, children: read.values }];
        }
      }
      return { values: [{ kind, node, children: read.values }], extra: read.extra };
    }
    if (node.name === "w:pict") {
      const read = nested(node);
      return { values: [], extra: [...read.values, ...read.extra] };
    }
    if (node.name === "w:sdt") {
      const content = first(node, "w:sdtContent");
      return content ? nested(content) : empty();
    }
    if (node.name === "mc:AlternateContent") {
      const fallback = first(node, "mc:Fallback");
      return fallback ? nested(fallback) : empty();
    }
    if (passthrough.has(node.name)) {
      const read = nested(node);
      return node.name === "w:hyperlink"
        ? { values: [{ kind: "link", node, children: read.values }], extra: read.extra }
        : read;
    }
    return empty();
  }
  const read = nested(parent);
  return [...read.values, ...read.extra];
}

/** Notes are indexed after eager semantic parsing; no reference expansion occurs here. */
export function readNotes(
  root: Element | undefined,
  type: "footnote" | "endnote",
  diagnostics: Set<string>,
  numberingFor?: (node: Element) => unknown,
) {
  const notes = new Map<string, Content[]>();
  for (const note of children(root)) {
    if (note.name !== `w:${type}`) continue;
    const special = note.attributes.get("w:type");
    if (special === "separator" || special === "continuationSeparator") continue;
    notes.set(
      note.attributes.get("w:id") ?? "undefined",
      readContent(note, diagnostics, numberingFor),
    );
  }
  return notes;
}

export function readComments(
  root: Element | undefined,
  diagnostics: Set<string>,
  numberingFor?: (node: Element) => unknown,
) {
  const comments = new Map<string, { body: Content[]; initials: string }>();
  for (const comment of children(root)) {
    if (comment.name !== "w:comment") continue;
    comments.set(comment.attributes.get("w:id") ?? "undefined", {
      body: readContent(comment, diagnostics, numberingFor),
      initials: comment.attributes.get("w:initials")?.trim() ?? "",
    });
  }
  return comments;
}
