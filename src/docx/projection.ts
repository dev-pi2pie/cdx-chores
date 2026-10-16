import { checkDocxLimit, type DocxLimits } from "./limits";
import type { ProjectionPath, ProjectionTag } from "./styles";

export type Projection =
  | { tag: ProjectionTag; children: Projection[] }
  | { text: string }
  | { force: true };
const voidTags = new Set(["br", "hr", "img", "input"]);

/** Bounds expansion before duplicated note text or nested paths can accumulate. */
export class ProjectionBudget {
  private bytes = 0;
  private readonly depths = new WeakMap<Projection, number>();
  constructor(private readonly limits: DocxLimits) {}
  charge(bytes: number): void {
    this.bytes += bytes;
    checkDocxLimit(this.bytes, "resultBytes", this.limits);
  }
  text(value: string): Projection {
    this.charge(Buffer.byteLength(value) + 16);
    return { text: value };
  }
  element(tag: ProjectionTag, values: Projection[]): Projection {
    this.charge(32 + tag.names[0]!.length * 2);
    let depth = 1;
    for (const value of values) depth = Math.max(depth, 1 + (this.depths.get(value) ?? 0));
    checkDocxLimit(depth, "maxXmlDepth", this.limits);
    const node = { tag, children: values };
    this.depths.set(node, depth);
    return node;
  }
  wrap(path: ProjectionPath, values: () => Projection[]): Projection[] {
    if (path === null) return [];
    let result = values();
    for (let index = path.length - 1; index >= 0; index--)
      result = [this.element(path[index]!, result)];
    return result;
  }
}

function sameAttributes(first: ProjectionTag, second: ProjectionTag): boolean {
  const keys = Object.keys(first.attributes);
  return (
    keys.length === Object.keys(second.attributes).length &&
    keys.every((key) => first.attributes[key] === second.attributes[key])
  );
}

/** Empty removal precedes adjacent path reuse, including literal merge separators. */
export function simplifyProjection(nodes: Projection[], budget: ProjectionBudget): Projection[] {
  const result: Projection[] = [];
  function append(target: Projection[], node: Projection): void {
    const previous = target[target.length - 1];
    if (
      "tag" in node &&
      !node.tag.fresh &&
      previous &&
      "tag" in previous &&
      node.tag.names.includes(previous.tag.names[0]!) &&
      sameAttributes(node.tag, previous.tag)
    ) {
      if (node.tag.separator) append(previous.children, budget.text(node.tag.separator));
      for (const child of node.children) append(previous.children, child);
    } else target.push(node);
  }
  for (const node of nodes) {
    if ("text" in node) {
      if (node.text) append(result, node);
    } else if ("force" in node) append(result, node);
    else {
      const nested = simplifyProjection(node.children, budget);
      if (nested.length || voidTags.has(node.tag.names[0]!))
        append(result, { tag: node.tag, children: nested });
    }
  }
  return result;
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** A bounded evidence projection, never a public HTML conversion result. */
export function projectedEvidence(nodes: Projection[], limits: DocxLimits) {
  const fragments: string[] = [];
  let bytes = 0;
  function write(value: string): void {
    bytes += Buffer.byteLength(value);
    checkDocxLimit(bytes, "resultBytes", limits);
    fragments.push(value);
  }
  function visit(values: Projection[]): void {
    for (const node of values) {
      if ("text" in node) write(escapeText(node.text));
      else if ("tag" in node) {
        const name = node.tag.names[0]!;
        write(`<${name}>`);
        if (node.children.length || !voidTags.has(name)) {
          visit(node.children);
          write(`</${name}>`);
        }
      }
    }
  }
  visit(nodes);
  const html = fragments.join("");
  const headings: { level: number; text: string }[] = [];
  for (const match of html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = match[2]!
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (text) headings.push({ level: Number(match[1]), text });
  }
  return { headings, hasContent: html.trim().length > 0 };
}
