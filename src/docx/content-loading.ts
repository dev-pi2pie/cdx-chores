import { posix } from "node:path";

import type { GuardedDocxPackage } from "./package";
import { children, parseXml, type Element } from "./xml";
import type { XmlBudget } from "./xml-budget";

const RELATIONSHIP_PREFIX = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";

export function relationshipPath(part: string): string {
  return `${posix.dirname(part)}/_rels/${posix.basename(part)}.rels`;
}

/** Office content stays UTF-8; metadata retains its separate encoding contract. */
export class ContentLoader {
  private readonly parsed = new Map<string, Element | undefined>();
  constructor(
    private readonly archive: GuardedDocxPackage,
    private readonly budget: XmlBudget,
  ) {}

  private exists(part: string): boolean {
    const entry = this.archive.contentEntries.get(part);
    return entry !== undefined && !entry.fileName.endsWith("/");
  }

  async xml(part: string): Promise<Element | undefined> {
    if (this.parsed.has(part)) return this.parsed.get(part);
    const entry = this.archive.contentEntries.get(part);
    const bytes = this.exists(part) ? await this.archive.readContentBytes(part) : undefined;
    const value =
      bytes === undefined
        ? undefined
        : parseXml(
            new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF+/, ""),
            this.budget,
            entry,
          );
    this.parsed.set(part, value);
    return value;
  }

  async relationships(part: string): Promise<Element[]> {
    return children(await this.xml(part)).filter((value) => value.name === "rels:Relationship");
  }

  async relatedPart(relationships: string, kind: string, base = "/"): Promise<string> {
    for (const relationship of await this.relationships(relationships)) {
      if (relationship.attributes.get("Type") !== `${RELATIONSHIP_PREFIX}${kind}`) continue;
      const target = relationship.attributes.get("Target");
      if (!target) continue;
      // The converter joins content targets literally, without decoding URI
      // escapes or collapsing dot segments. Only ZIP-internal matches count.
      const path = target.startsWith("/")
        ? target
        : `${base.endsWith("/") ? base : `${base}/`}${target}`;
      if (this.exists(path)) return path;
    }
    return kind === "officeDocument" ? "/word/document.xml" : `/word/${kind}.xml`;
  }

  async parts() {
    // Content types are optional, but malformed XML fails baseline conversion.
    await this.xml("/[Content_Types].xml");
    const main = await this.relatedPart("/_rels/.rels", "officeDocument");
    if (!this.exists(main)) throw new Error("docx_main_document_unavailable");
    const relationships = relationshipPath(main);
    const paths = { main, styles: "", numbering: "", comments: "", footnotes: "", endnotes: "" };
    for (const kind of ["styles", "numbering", "comments", "footnotes", "endnotes"] as const) {
      paths[kind] = await this.relatedPart(relationships, kind, posix.dirname(main));
    }
    const styles = await this.xml(paths.styles);
    const numbering = await this.xml(paths.numbering);
    for (const kind of ["comments", "footnotes", "endnotes"] as const)
      await this.xml(relationshipPath(paths[kind]));
    const comments = await this.xml(paths.comments);
    const footnotes = await this.xml(paths.footnotes);
    const endnotes = await this.xml(paths.endnotes);
    return {
      paths,
      styles,
      numbering,
      comments,
      footnotes,
      endnotes,
      document: await this.xml(main),
    };
  }

  async imageTargets(
    main: string,
    source: "document" | "footnotes" | "endnotes" | "comments",
  ): Promise<Map<string, string>> {
    const targets = new Map<string, string>();
    for (const relationship of await this.relationships(relationshipPath(main))) {
      const id = relationship.attributes.get("Id");
      const target = relationship.attributes.get("Target");
      if (
        !id ||
        !target ||
        relationship.attributes.get("TargetMode")?.toLowerCase() === "external" ||
        relationship.attributes.get("Type") !== `${RELATIONSHIP_PREFIX}image`
      )
        continue;
      // Preserve the baseline's Word-directory media resolution.
      const path = target.startsWith("/") ? target : `/word/${target}`;
      if (this.exists(path)) targets.set(`${source}:${id}`, path);
    }
    return targets;
  }

  async hyperlinkTargets(
    part: string,
    source: "document" | "footnotes" | "endnotes" | "comments",
  ): Promise<Map<string, string>> {
    const targets = new Map<string, string>();
    for (const relationship of await this.relationships(relationshipPath(part))) {
      const id = relationship.attributes.get("Id");
      const target = relationship.attributes.get("Target");
      if (id && target) targets.set(`${source}:${id}`, target);
    }
    return targets;
  }
}
