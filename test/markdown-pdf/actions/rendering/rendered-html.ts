import assert from "node:assert/strict";
import type { DefaultTreeAdapterTypes as Html } from "parse5";

export function elements(root: Html.Node, tag: string): Html.Element[] {
  const own = "tagName" in root && root.tagName === tag ? [root] : [];
  return "childNodes" in root
    ? own.concat(root.childNodes.flatMap((node) => elements(node, tag)))
    : own;
}

export function attribute(node: Html.Element, name: string) {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

export function text(node: Html.Node): string {
  if ("value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(text).join("") : "";
}

function listAncestry(node: Html.Element) {
  const ancestry: string[] = [];
  for (let parent = node.parentNode; parent && "tagName" in parent; parent = parent.parentNode) {
    if (["li", "ol", "ul", "dl", "dd", "blockquote"].includes(parent.tagName))
      ancestry.unshift(parent.tagName);
  }
  return ancestry;
}

export function boundaryStructure(root: Html.Node) {
  return {
    headings: elements(root, "h1").map(text),
    items: elements(root, "li").map((li) => ({ text: text(li), lists: listAncestry(li) })),
    textareas: elements(root, "textarea").map(text),
    blocks: elements(root, "pre").map((pre) => {
      const [code] = elements(pre, "code");
      assert(code, "missing code inside pre");
      const classes = (attribute(pre, "class") ?? "").split(/\s+/).filter(Boolean);
      return {
        text: text(code),
        languages: classes.filter((c) => c !== "sourceCode"),
        lists: listAncestry(pre),
      };
    }),
  };
}
