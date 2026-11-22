interface TitleLink {
  label: string;
  destination: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstH1(blocks: unknown[]): unknown[] | undefined {
  for (const block of blocks) {
    if (!isRecord(block) || !Array.isArray(block.c)) continue;
    if (block.t === "Header" && block.c[0] === 1) return block.c;
    if (block.t === "Div" && Array.isArray(block.c[1])) {
      const heading = firstH1(block.c[1]);
      if (heading) return heading;
    }
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
  if (!heading) return false;

  const titleLinks: TitleLink[] = [];
  const headingLinks: TitleLink[] = [];
  const titleText = projectMetadataTitle(document.meta.title, titleLinks);
  const headingText = projectInlines(heading[2], headingLinks);
  if (titleText === undefined || headingText === undefined) return false;

  const title = normalizeText(titleText);
  return (
    title.length > 0 &&
    title === normalizeText(headingText) &&
    titleLinks.every((link) =>
      headingLinks.some(
        (headingLink) =>
          link.label === headingLink.label && link.destination === headingLink.destination,
      ),
    )
  );
}
