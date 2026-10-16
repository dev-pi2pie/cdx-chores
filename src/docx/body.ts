import type { DocxBodyFacts, DocxBodyInput } from "./body-types";
import { readComments, readContent, readNotes, type Content } from "./content";
import { checkDocxLimit } from "./limits";
import { createNumberingResolver, type ParagraphNumbering } from "./numbering";
import {
  projectedEvidence,
  ProjectionBudget,
  simplifyProjection,
  type Projection,
} from "./projection";
import { projectionTag, styleProjection, type ProjectionPath, type StyledKind } from "./styles";
import { first, type Element } from "./xml";

function enabled(node: Element | undefined): boolean {
  return !!node && !["false", "0"].includes(node.attributes.get("w:val") ?? "");
}

function otherwise(path: ProjectionPath | undefined, fallback: ProjectionPath): ProjectionPath {
  return path === undefined ? fallback : path;
}
type Source = "document" | "footnotes" | "endnotes" | "comments";

export function documentBodyFacts(input: DocxBodyInput): DocxBodyFacts {
  const diagnostics = new Set<string>();
  const resolveNumbering = createNumberingResolver(input.numbering, input.styles, input.limits);
  const numbering = new WeakMap<Element, ParagraphNumbering | undefined>();
  function numberingFor(node: Element): ParagraphNumbering | undefined {
    if (!numbering.has(node)) numbering.set(node, resolveNumbering(node));
    return numbering.get(node);
  }
  function hyperlinks(source: Source) {
    return (node: Element): string | undefined => {
      const id = node.attributes.get("r:id");
      if (!id) return undefined;
      const target = input.hyperlinkTargets?.get(`${source}:${id}`);
      const anchor = node.attributes.get("w:anchor");
      if (!anchor) return target;
      // Fragment replacement is eager, even for unused notes or hidden content.
      if (target === undefined) throw new Error("docx_initial_reader_error");
      return `${target.replace(/#.*$/, "")}#${anchor}`;
    };
  }
  const body = readContent(input.body, diagnostics, numberingFor, hyperlinks("document"));
  const footnotes = readNotes(
    input.footnotes,
    "footnote",
    diagnostics,
    numberingFor,
    hyperlinks("footnotes"),
  );
  const endnotes = readNotes(
    input.endnotes,
    "endnote",
    diagnostics,
    numberingFor,
    hyperlinks("endnotes"),
  );
  const comments = readComments(input.comments, diagnostics, numberingFor, hyperlinks("comments"));
  const pathFor = styleProjection(
    input.styles,
    input.styleMap,
    input.limits,
    diagnostics,
    numberingFor,
  );
  const budget = new ProjectionBudget(input.limits);
  const raw: string[] = [];
  let rawBytes = 0;
  function appendRaw(value: string): void {
    rawBytes += Buffer.byteLength(value);
    checkDocxLimit(rawBytes, "resultBytes", input.limits);
    raw.push(value);
  }
  function rawText(values: Content[]): void {
    for (const value of values) {
      if (value.kind === "text") appendRaw(value.value);
      else if ("children" in value) {
        rawText(value.children);
        if (value.kind === "p") appendRaw("\n\n");
      }
    }
  }
  rawText(body);
  const references: { noteType: "footnote" | "endnote"; id: string }[] = [];
  const referencedComments: { body: Content[]; label: string }[] = [];
  let ordinal = 0;

  function render(values: Content[], source: Source): Projection[] {
    const result: Projection[] = [];
    for (const value of values)
      for (const projected of project(value, source)) result.push(projected);
    return result;
  }

  function element(name: string, values: Projection[], fresh = true): Projection[] {
    return [budget.element(projectionTag(name, fresh), values)];
  }

  function run(value: Extract<Content, { children: Content[] }>, source: Source): Projection[] {
    const properties = first(value.node, "w:rPr");
    const paths: ProjectionPath[] = [];
    const highlight = first(properties, "w:highlight")?.attributes.get("w:val");
    if (highlight && highlight !== "none") {
      const path = pathFor("highlight", value.node, highlight);
      if (path !== undefined) paths.push(path);
    }
    const formatting: [string, StyledKind, string | undefined][] = [
      ["smallCaps", "small-caps", undefined],
      ["caps", "all-caps", undefined],
      ["strike", "strike", "s"],
      ["u", "u", undefined],
    ];
    for (const [property, kind, fallback] of formatting) {
      const propertyNode = first(properties, `w:${property}`);
      if (
        enabled(propertyNode) &&
        !(property === "u" && [undefined, "none"].includes(propertyNode?.attributes.get("w:val")))
      )
        paths.push(otherwise(pathFor(kind, value.node), fallback ? [projectionTag(fallback)] : []));
    }
    const alignment = first(properties, "w:vertAlign")?.attributes.get("w:val");
    if (alignment === "subscript" || alignment === "superscript")
      paths.push([projectionTag(alignment === "subscript" ? "sub" : "sup")]);
    if (enabled(first(properties, "w:i")))
      paths.push(otherwise(pathFor("i", value.node), [projectionTag("em")]));
    if (enabled(first(properties, "w:b")))
      paths.push(otherwise(pathFor("b", value.node), [projectionTag("strong")]));
    paths.push(otherwise(pathFor("r", value.node), []));
    let produce = () => render(value.children, source);
    for (const path of paths) {
      const previous = produce;
      produce = () => budget.wrap(path, previous);
    }
    return produce();
  }

  function project(value: Content, source: Source): Projection[] {
    if (value.kind === "text") return [budget.text(value.value)];
    if (value.kind === "p")
      return budget.wrap(otherwise(pathFor("p", value.node), [projectionTag("p", true)]), () =>
        render(value.children, source),
      );
    if (value.kind === "r") return run(value, source);
    if (value.kind === "table")
      return budget.wrap(
        otherwise(pathFor("table", value.node), [projectionTag("table", true)]),
        () => [{ force: true }, ...render(value.children, source)],
      );
    if (value.kind === "tr" || value.kind === "td")
      return element(value.kind, [{ force: true }, ...render(value.children, source)]);
    if (value.kind === "link") {
      const tag = projectionTag("a");
      const id = value.node.attributes.get("r:id");
      const anchor = value.node.attributes.get("w:anchor");
      if (!id && !anchor && value.href === undefined) return render(value.children, source);
      tag.attributes.href = value.href ?? (!id && anchor ? `#${anchor}` : undefined);
      tag.attributes.target = value.node.attributes.get("w:tgtFrame") ?? "";
      return [budget.element(tag, render(value.children, source))];
    }
    if (value.kind === "break") {
      const path = otherwise(
        pathFor("br", value.node, value.value),
        value.value === "line" ? [projectionTag("br", true)] : [],
      );
      return budget.wrap(path, () => []);
    }
    if (value.kind === "bookmark") return element("a", [{ force: true }]);
    if (value.kind === "checkbox") return element("input", []);
    if (value.kind === "image") {
      const key = `${source}:${value.id}`;
      if (!input.embeddedImages.has(key)) return [];
      input.imageCollector?.add(key);
      return element("img", []);
    }
    if (value.kind === "note") {
      references.push({ noteType: value.noteType, id: value.id });
      return element("sup", element("a", [budget.text(`[${++ordinal}]`)]));
    }
    if (value.kind === "comment") {
      return budget.wrap(otherwise(pathFor("comment-reference", value.node), null), () => {
        const comment = comments.get(value.id);
        if (!comment) throw new Error("docx_comment_missing");
        const label = `[${comment.initials}${referencedComments.length + 1}]`;
        referencedComments.push({ body: comment.body, label });
        return element("a", [budget.text(label)]);
      });
    }
    return [];
  }

  const projected = render(body, "document");
  // Resolve precisely the main traversal snapshot. Nested references only create labels.
  const selected = references.map((reference) => {
    const values = (reference.noteType === "footnote" ? footnotes : endnotes).get(reference.id);
    if (!values) throw new Error("docx_note_missing");
    return { ...reference, values };
  });
  const notes: Projection[] = [];
  for (const reference of selected) {
    notes.push(
      ...element("li", [
        ...render(reference.values, reference.noteType === "footnote" ? "footnotes" : "endnotes"),
        ...element("p", [budget.text(" "), ...element("a", [budget.text("↑")])], false),
      ]),
    );
  }
  if (notes.length) projected.push(...element("ol", notes));
  const commentNodes: Projection[] = [];
  for (const reference of referencedComments.slice()) {
    commentNodes.push(...element("dt", [budget.text(`Comment ${reference.label}`)]));
    commentNodes.push(
      ...element("dd", [
        ...render(reference.body, "comments"),
        ...element("p", [budget.text(" "), ...element("a", [budget.text("↑")])], false),
      ]),
    );
  }
  if (commentNodes.length) projected.push(...element("dl", commentNodes));
  const facts = projectedEvidence(simplifyProjection(projected, budget), input.limits);
  const text = raw.join("");
  return {
    ...facts,
    rawText: text,
    hasContent: facts.hasContent || text.trim().length > 0,
    diagnostics: [...diagnostics],
  };
}
