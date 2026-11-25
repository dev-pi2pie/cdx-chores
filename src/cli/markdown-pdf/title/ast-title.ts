import {
  documentTitleStyle,
  titleBlockVisibility,
  type TitleBlockStyle,
} from "./ast-title-visibility";

interface TitleLink {
  label: string;
  destination: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The AST shortcut needs uniform visibility. A mixed or unsupported inline
// subtree cannot establish a full duplicate or justify skipping an earlier H1.
function hasInlineVisibility(
  inlines: unknown,
  inherited: TitleBlockStyle,
  expected: "visible" | "hidden",
): boolean {
  if (!Array.isArray(inlines)) return false;
  return inlines.every((inline: unknown) => {
    if (!isRecord(inline)) return false;
    const { t, c } = inline;
    switch (t) {
      case "Str":
      case "Space":
      case "SoftBreak":
      case "LineBreak":
        return inherited.visibility === expected;
      case "Emph":
      case "Strong":
        return hasInlineVisibility(c, inherited, expected);
      case "Quoted":
        return (
          inherited.visibility === expected &&
          Array.isArray(c) &&
          hasInlineVisibility(c[1], inherited, expected)
        );
      case "Code":
      case "Link":
      case "Span": {
        if (!Array.isArray(c) || !Array.isArray(c[0])) return false;
        const style = titleBlockVisibility(c[0], inherited);
        if (style.display === "omitted") return expected === "hidden";
        if (style.display === "unknown" || style.visibility === "unknown") return false;
        return t === "Code"
          ? style.visibility === expected
          : hasInlineVisibility(c[1], style, expected);
      }
      default:
        return false;
    }
  });
}

function firstH1(
  blocks: unknown[],
  inherited = documentTitleStyle,
): unknown[] | "unknown" | undefined {
  for (const block of blocks) {
    if (!isRecord(block) || !Array.isArray(block.c)) continue;
    if (block.t === "Header" && block.c[0] === 1) {
      const style = titleBlockVisibility(block.c[1], inherited);
      if (style.display === "omitted") continue;
      if (
        style.display === "unknown" ||
        style.visibility === "unknown" ||
        !hasInlineVisibility(block.c[2], style, style.visibility)
      )
        return "unknown";
      if (style.visibility === "visible") return block.c;
    }
    if (block.t === "Div" && Array.isArray(block.c[1])) {
      const visibility = titleBlockVisibility(block.c[0], inherited);
      if (visibility.display === "omitted") continue;
      const heading = firstH1(block.c[1], visibility);
      if (heading) return heading;
    }
  }
}

function* bodyHeadings(blocks: unknown[]): Generator<unknown[]> {
  for (const block of blocks) {
    if (!isRecord(block) || !Array.isArray(block.c)) continue;
    if (block.t === "Header" && block.c[0] === 1) yield block.c;
    if (block.t === "Div" && Array.isArray(block.c[1])) yield* bodyHeadings(block.c[1]);
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, " ").trim().toLowerCase();
}

function projectInlines(inlines: unknown, links: TitleLink[]): string | undefined {
  if (!Array.isArray(inlines)) return undefined;
  let text = "";
  for (const inline of inlines) {
    if (!isRecord(inline)) return undefined;
    const piece = projectInline(inline, links);
    if (piece === undefined) return undefined;
    text += piece;
  }
  return text;
}

function projectInline(inline: Record<string, unknown>, links: TitleLink[]): string | undefined {
  const content = inline.c;
  switch (inline.t) {
    case "Str":
      return typeof content === "string" ? content : undefined;
    case "Space":
    case "SoftBreak":
    case "LineBreak":
      return " ";
    case "Emph":
    case "Strong":
      return projectInlines(content, links);
    case "Code":
      return Array.isArray(content) && typeof content[1] === "string" ? content[1] : undefined;
    case "Quoted": {
      if (!Array.isArray(content) || !isRecord(content[0])) return undefined;
      const text = projectInlines(content[1], links);
      if (text === undefined) return undefined;
      if (content[0].t === "SingleQuote") return `‘${text}’`;
      if (content[0].t === "DoubleQuote") return `“${text}”`;
      return undefined;
    }
    case "Link": {
      if (!Array.isArray(content) || !Array.isArray(content[2])) return undefined;
      const [destination] = content[2];
      if (typeof destination !== "string") return undefined;
      const label = projectInlines(content[1], links);
      if (label === undefined) return undefined;
      links.push({ label: normalizeText(label), destination });
      return label;
    }
    default:
      return undefined;
  }
}

function projectMetadataTitle(title: unknown, links: TitleLink[]): string | undefined {
  if (!isRecord(title)) return undefined;
  if (title.t === "MetaInlines") return projectInlines(title.c, links);
  return title.t === "MetaString" && typeof title.c === "string" ? title.c : undefined;
}

/** The first eligible Markdown H1 must preserve the displayed title and its link destinations. */
export function shouldSuppressMarkdownPdfMetadataTitle(
  document: unknown,
  frontmatterTitle: unknown,
): boolean {
  if (typeof frontmatterTitle !== "string" || !frontmatterTitle.trim()) return false;
  if (!isRecord(document) || !isRecord(document.meta) || !Array.isArray(document.blocks)) {
    return false;
  }
  const heading = firstH1(document.blocks);
  if (!heading || heading === "unknown") return false;

  return titleMatcher(document.meta.title)(heading).matches;
}

function titleMatcher(metadata: unknown) {
  const titleLinks: TitleLink[] = [];
  const title = normalizeText(projectMetadataTitle(metadata, titleLinks) ?? "");
  return (heading: unknown[]) => {
    const headingLinks: TitleLink[] = [];
    const text = projectInlines(heading[2], headingLinks);
    const matches =
      title.length > 0 &&
      text !== undefined &&
      title === normalizeText(text) &&
      titleLinks.every((link) =>
        headingLinks.some(
          (candidate) =>
            candidate.label === link.label && candidate.destination === link.destination,
        ),
      );
    return { text, matches };
  };
}

export interface StyledTitleHeading {
  id: string;
  matches: boolean;
  text?: string;
}

/** Author styles can also reveal an earlier inline-hidden heading. Preserve document order. */
export function styledTitleHeadings(document: unknown): StyledTitleHeading[] {
  if (!isRecord(document) || !isRecord(document.meta) || !Array.isArray(document.blocks)) return [];
  const matches = titleMatcher(document.meta.title);
  const headings = Array.from(bodyHeadings(document.blocks), (heading) => ({
    id: Array.isArray(heading[1]) && typeof heading[1][0] === "string" ? heading[1][0] : "",
    ...matches(heading),
  }));
  return headings.some((heading) => heading.matches) ? headings : [];
}
