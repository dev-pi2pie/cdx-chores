import { children, first, parseXml, type Element } from "./xml";

interface HeadingRule {
  id?: string;
  name?: string;
  level: number;
}

export function headingResolver(stylesXml: string | undefined, embeddedMap: string | undefined) {
  const names = new Map<string, string>();
  for (const style of children(stylesXml === undefined ? undefined : parseXml(stylesXml))) {
    const id = style.attributes.get("w:styleId");
    const name = first(style, "w:name")?.attributes.get("w:val");
    if (
      style.name === "w:style" &&
      style.attributes.get("w:type") === "paragraph" &&
      id &&
      name &&
      !names.has(id)
    )
      names.set(id, name);
  }
  const rules: HeadingRule[] = [];
  for (const line of embeddedMap?.split(/\r?\n/) ?? []) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const match =
      /^\s*p(?:\.([A-Za-z0-9_-]+)|\[style-name=(['"])(.*?)\2\])\s*=>\s*h([1-6]):fresh\s*$/.exec(
        line,
      );
    if (!match) throw new Error("docx_style_map_unsupported");
    rules.push({ id: match[1], name: match[3]?.toLowerCase(), level: Number(match[4]) });
  }
  return (paragraph: Element): number | undefined => {
    const id = first(first(paragraph, "w:pPr"), "w:pStyle")?.attributes.get("w:val");
    if (!id) return undefined;
    const name = names.get(id);
    for (const rule of rules) {
      if (rule.id !== undefined ? rule.id === id : rule.name === name?.toLowerCase())
        return rule.level;
    }
    const idLevel = /^Heading([1-6])$/.exec(id)?.[1];
    if (idLevel) return Number(idLevel);
    if (id === "Heading") return 1;
    const nameLevel = /^heading ([1-6])$/i.exec(name ?? "")?.[1];
    return nameLevel ? Number(nameLevel) : name?.toLowerCase() === "heading" ? 1 : undefined;
  };
}
