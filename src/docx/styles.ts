import type { DocxLimits } from "./limits";
import { checkDocxLimit } from "./limits";
import { StyleWork } from "./style-work";
import { children, first, type Element } from "./xml";

export interface ProjectionTag {
  names: string[];
  attributes: Record<string, string | undefined>;
  fresh: boolean;
  separator: string;
}

/** Undefined is no matching rule; null suppresses the complete selected subtree. */
export type ProjectionPath = ProjectionTag[] | null;
export type StyledKind =
  | "p"
  | "r"
  | "table"
  | "b"
  | "i"
  | "u"
  | "strike"
  | "all-caps"
  | "small-caps"
  | "highlight"
  | "br"
  | "comment-reference";

interface Rule {
  kind: StyledKind;
  list?: { isOrdered: boolean; levelIndex: number };
  id?: string;
  name?: string;
  prefix?: boolean;
  value?: string;
  path: ProjectionPath;
}

class Cursor {
  offset = 0;
  constructor(readonly source: string) {}
  take(pattern: RegExp): string | undefined {
    const match = pattern.exec(this.source.slice(this.offset));
    if (!match) return undefined;
    this.offset += match[0].length;
    return match[0];
  }
  literal(text: string): boolean {
    if (!this.source.startsWith(text, this.offset)) return false;
    this.offset += text.length;
    return true;
  }
  identifier(): string | undefined {
    const value = this.take(/^(?:[A-Za-z_-]|\\.)(?:[A-Za-z_0-9-]|\\.)*/);
    return value === undefined ? undefined : unescape(value);
  }
  string(): string | undefined {
    const value = this.take(/^'(?:\\.|[^'\\])*'/);
    return value === undefined ? undefined : unescape(value.slice(1, -1));
  }
  spaces(): boolean {
    return this.take(/^\s+/) !== undefined;
  }
  get done(): boolean {
    return this.offset === this.source.length;
  }
}

function unescape(value: string): string {
  return value.replace(
    /\\(.)/g,
    (_match, code: string) => ({ n: "\n", r: "\r", t: "\t" })[code] ?? code,
  );
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("docx_style_map_invalid");
  return value;
}

function parseRule(source: string, limits: DocxLimits): Rule {
  const cursor = new Cursor(source);
  const kind = required(cursor.identifier()) as StyledKind;
  if (
    ![
      "p",
      "r",
      "table",
      "b",
      "i",
      "u",
      "strike",
      "all-caps",
      "small-caps",
      "highlight",
      "br",
      "comment-reference",
    ].includes(kind)
  )
    throw new Error("docx_style_map_invalid");
  const rule: Rule = { kind, path: [] };
  function complete(): Rule {
    if (kind === "br" && !["line", "page", "column"].includes(rule.value!))
      throw new Error("docx_style_map_unsupported");
    return rule;
  }
  while (true) {
    if (cursor.literal(".")) {
      if (!["p", "r", "table"].includes(kind)) throw new Error("docx_style_map_invalid");
      rule.id = required(cursor.identifier());
    } else if (cursor.literal(":")) {
      if (!["p", "r"].includes(kind)) throw new Error("docx_style_map_invalid");
      const list = required(cursor.identifier());
      if (!["ordered-list", "unordered-list"].includes(list) || !cursor.literal("("))
        throw new Error("docx_style_map_invalid");
      const level = required(cursor.take(/^[0-9]+/));
      if (!cursor.literal(")")) throw new Error("docx_style_map_invalid");
      rule.list = { isOrdered: list === "ordered-list", levelIndex: Number(level) - 1 };
    } else if (cursor.literal("[")) {
      const attribute = required(cursor.identifier());
      const prefix = cursor.literal("^=");
      if (!prefix && !cursor.literal("=")) throw new Error("docx_style_map_invalid");
      const value = required(cursor.string());
      if (!cursor.literal("]")) throw new Error("docx_style_map_invalid");
      if (attribute === "style-name" && ["p", "r", "table"].includes(kind)) {
        rule.name = value.toUpperCase();
        rule.prefix = prefix;
      } else if (
        (kind === "br" && attribute === "type") ||
        (kind === "highlight" && attribute === "color")
      ) {
        if (prefix) throw new Error("docx_style_map_invalid");
        rule.value = value;
      } else throw new Error("docx_style_map_invalid");
    } else break;
  }
  if (kind === "br" && rule.value === undefined) throw new Error("docx_style_map_invalid");
  if (!cursor.spaces() || !cursor.literal("=>")) throw new Error("docx_style_map_invalid");
  if (cursor.done) return complete();
  if (!cursor.spaces()) throw new Error("docx_style_map_invalid");
  if (cursor.done) return complete();
  if (cursor.literal("!")) {
    if (!cursor.done) throw new Error("docx_style_map_invalid");
    rule.path = null;
    return complete();
  }
  const path: ProjectionTag[] = [];
  do {
    const names = [required(cursor.identifier())];
    while (cursor.literal("|")) names.push(required(cursor.identifier()));
    const attributes: Record<string, string> = Object.create(null);
    while (true) {
      if (cursor.literal(".")) {
        const value = required(cursor.identifier());
        attributes.class = attributes.class ? `${attributes.class} ${value}` : value;
      } else if (cursor.literal("[")) {
        const name = required(cursor.identifier());
        if (!cursor.literal("=")) throw new Error("docx_style_map_invalid");
        attributes[name] = required(cursor.string());
        if (!cursor.literal("]")) throw new Error("docx_style_map_invalid");
      } else break;
    }
    const fresh = cursor.literal(":fresh");
    let separator = "";
    if (cursor.literal(":separator(")) {
      separator = required(cursor.string());
      if (!cursor.literal(")")) throw new Error("docx_style_map_invalid");
    }
    path.push({ names, attributes, fresh, separator });
    checkDocxLimit(path.length, "maxXmlDepth", limits);
    if (cursor.done) break;
    if (!cursor.spaces() || !cursor.literal(">") || !cursor.spaces())
      throw new Error("docx_style_map_invalid");
    if (cursor.done) throw new Error("docx_style_map_invalid");
  } while (!cursor.done);
  rule.path = path;
  return complete();
}

export function projectionTag(name: string, fresh = false): ProjectionTag {
  return { names: [name], attributes: {}, fresh, separator: "" };
}

/** Project only document styles and paths that affect evidence; no inheritance promotion. */
export function styleProjection(
  styles: Element | undefined,
  embeddedMap: string | undefined,
  limits: DocxLimits,
  diagnostics: Set<string>,
  numberingFor?: (node: Element) => { isOrdered: boolean; levelIndex: number } | undefined,
) {
  const names = new Map<string, string | undefined>();
  for (const style of children(styles)) {
    const id = style.attributes.get("w:styleId");
    const type = style.attributes.get("w:type");
    const name = first(style, "w:name")?.attributes.get("w:val");
    const key = `${type}:${id}`;
    if (style.name === "w:style" && id && !names.has(key)) names.set(key, name || undefined);
  }
  const rules: Rule[] = [];
  for (const line of embeddedMap?.split(/\r?\n/) ?? []) {
    const source = line.trim();
    if (!source || source.startsWith("#")) continue;
    try {
      const rule = parseRule(source, limits);
      rules.push(rule);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.startsWith("docx_limit:") || error.message === "docx_style_map_unsupported")
      )
        throw error;
      diagnostics.add("docx_style_map_invalid");
    }
  }
  return (kind: StyledKind, node: Element, value?: string): ProjectionPath | undefined => {
    const work = new StyleWork(limits);
    work.step();
    const property = kind === "p" ? "p" : kind === "table" ? "tbl" : "r";
    const id = first(first(node, `w:${property}Pr`), `w:${property}Style`)?.attributes.get("w:val");
    const type = kind === "p" ? "paragraph" : kind === "table" ? "table" : "character";
    const name = names.get(`${type}:${id}`)?.toUpperCase();
    let numbering: ReturnType<NonNullable<typeof numberingFor>>;
    let numberingRead = false;
    for (const rule of rules) {
      work.step();
      if (
        rule.kind !== kind ||
        (rule.id !== undefined && rule.id !== id) ||
        (rule.value !== undefined && rule.value !== value) ||
        (rule.name !== undefined &&
          (name === undefined || (rule.prefix ? !name.startsWith(rule.name) : name !== rule.name)))
      )
        continue;
      if (rule.list) {
        if (!numberingRead) {
          numbering = numberingFor?.(node);
          numberingRead = true;
        }
        if (
          !numbering ||
          rule.list.isOrdered !== numbering.isOrdered ||
          rule.list.levelIndex !== numbering.levelIndex
        )
          continue;
      }
      return rule.path;
    }
    if (kind === "r") {
      work.step();
      return name === "STRONG" ? [projectionTag("strong")] : undefined;
    }
    if (kind !== "p") return undefined;
    work.step();
    const idLevel = /^Heading([1-6])$/.exec(id ?? "")?.[1];
    if (idLevel || id === "Heading") return [projectionTag(`h${idLevel ?? 1}`, true)];
    work.step();
    const nameLevel = /^HEADING ([1-6])$/.exec(name ?? "")?.[1];
    if (nameLevel || name === "HEADING") return [projectionTag(`h${nameLevel ?? 1}`, true)];
    return undefined;
  };
}
