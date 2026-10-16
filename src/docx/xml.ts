import { XMLParser, XMLValidator } from "fast-xml-parser";

export interface Element {
  name: string;
  attributes: Map<string, string>;
  children: (Element | string)[];
}

const aliases = new Map([
  ["http://schemas.openxmlformats.org/wordprocessingml/2006/main", "w"],
  ["http://schemas.openxmlformats.org/officeDocument/2006/relationships", "r"],
  ["http://schemas.openxmlformats.org/package/2006/relationships", "rels"],
  ["http://schemas.openxmlformats.org/drawingml/2006/main", "a"],
  ["http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "wp"],
  ["http://schemas.openxmlformats.org/drawingml/2006/picture", "pic"],
  ["urn:schemas-microsoft-com:vml", "v"],
]);
const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

function resolveName(name: string, namespaces: Map<string, string>, attribute = false): string {
  const separator = name.indexOf(":");
  const prefix = separator < 0 ? "" : name.slice(0, separator);
  const local = separator < 0 ? name : name.slice(separator + 1);
  if (attribute && !prefix) return local;
  const uri = namespaces.get(prefix);
  return uri ? `${aliases.get(uri) ?? `{${uri}}`}:${local}` : name;
}

function element(
  value: Record<string, unknown>,
  inherited: Map<string, string>,
): Element | undefined {
  const name = Object.keys(value).find((key) => key !== ":@" && key !== "#text");
  if (!name || name.startsWith("?")) return undefined;
  const namespaces = new Map(inherited);
  const attributes = new Map<string, string>();
  const rawAttributes = Object.entries((value[":@"] ?? {}) as Record<string, string>);
  for (const [key, text] of rawAttributes) {
    if (key === "@_xmlns") namespaces.set("", text);
    else if (key.startsWith("@_xmlns:")) namespaces.set(key.slice(8), text);
  }
  for (const [key, text] of rawAttributes) {
    if (!key.startsWith("@_xmlns"))
      attributes.set(resolveName(key.slice(2), namespaces, true), text);
  }
  const children: (Element | string)[] = [];
  for (const child of (value[name] ?? []) as Record<string, unknown>[]) {
    if (typeof child["#text"] === "string") children.push(child["#text"]);
    else {
      const parsed = element(child, namespaces);
      if (parsed) children.push(parsed);
    }
  }
  return { name: resolveName(name, namespaces), attributes, children };
}

/** Initial reader only: trusted inputs; resource isolation is a later phase. */
export function parseXml(xml: string): Element | undefined {
  if (XMLValidator.validate(xml) !== true) throw new Error("docx_xml_invalid");
  for (const value of parser.parse(xml) as Record<string, unknown>[]) {
    const parsed = element(value, new Map());
    if (parsed) return parsed;
  }
  return undefined;
}

export function children(parent: Element | undefined): Element[] {
  return parent?.children.filter((value): value is Element => typeof value !== "string") ?? [];
}

export function first(parent: Element | undefined, name: string): Element | undefined {
  return children(parent).find((value) => value.name === name);
}

export function elementText(value: Element): string {
  return value.children
    .map((item) => (typeof item === "string" ? item : elementText(item)))
    .join("");
}
