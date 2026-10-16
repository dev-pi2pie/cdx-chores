import { checkDocxLimit, type DocxLimits } from "./limits";

/** Checks structure and allocation bounds before either XML parser sees a part. */
export class XmlBudget {
  private elements = 0;
  private readonly inspected = new Set<string | object>();

  constructor(private readonly limits: DocxLimits) {}

  inspect(part: string | object, xml: string): void {
    if (this.inspected.has(part)) return;
    const stack: string[] = [];
    let cursor = 0;
    while (cursor < xml.length) {
      const start = xml.indexOf("<", cursor);
      if (start < 0) break;
      const terminator = xml.startsWith("<!--", start)
        ? "-->"
        : xml.startsWith("<![CDATA[", start)
          ? "]]>"
          : xml.startsWith("<?", start)
            ? "?>"
            : undefined;
      if (terminator) {
        const end = xml.indexOf(terminator, start + 2);
        if (end < 0) throw new Error("docx_xml_invalid");
        cursor = end + terminator.length;
        continue;
      }
      if (xml.startsWith("<!", start)) throw new Error("docx_xml_declaration_unsupported");
      let quote: string | undefined;
      let end = start + 1;
      for (; end < xml.length; end += 1) {
        const value = xml[end];
        if (quote) {
          if (value === quote) quote = undefined;
        } else if (value === "'" || value === '"') quote = value;
        else if (value === ">") break;
      }
      if (end === xml.length) throw new Error("docx_xml_invalid");
      const tag = xml.slice(start + 1, end).trim();
      const closing = tag.startsWith("/");
      const name = /^(?:\/)?([^\s/>]+)/.exec(tag)?.[1];
      if (!name) throw new Error("docx_xml_invalid");
      if (closing) {
        if (stack.pop() !== name) throw new Error("docx_xml_invalid");
      } else {
        checkDocxLimit(++this.elements, "xmlElementCount", this.limits);
        checkDocxLimit(stack.length + 1, "maxXmlDepth", this.limits);
        if (!tag.endsWith("/")) stack.push(name);
      }
      cursor = end + 1;
    }
    if (stack.length) throw new Error("docx_xml_invalid");
    this.inspected.add(part);
  }
}
