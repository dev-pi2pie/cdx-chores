export const MARKDOWN_PDF_TEMPLATE_CODEX_CSS_BLOCK_SLOTS = [
  "cover",
  "tables",
  "code",
  "spacing",
  "typography",
  "colors",
] as const;

export type MarkdownPdfTemplateCodexCssBlockSlot =
  (typeof MARKDOWN_PDF_TEMPLATE_CODEX_CSS_BLOCK_SLOTS)[number];

export interface MarkdownPdfTemplateCodexCssBlock {
  slot: MarkdownPdfTemplateCodexCssBlockSlot;
  css: string;
}

const MAX_CSS_BLOCK_CHARS = 2_000;

const SLOT_SELECTORS: Record<MarkdownPdfTemplateCodexCssBlockSlot, readonly string[]> = {
  code: ["code", "pre", "pre code", ".cdx-code-line"],
  colors: [":root", "body", "a", "mark", "blockquote"],
  cover: [
    ".pdf-cover",
    ".pdf-cover-media",
    ".pdf-cover-media__byline",
    ".pdf-cover-media__caption",
    ".pdf-cover-media__caption--subtitle",
    ".pdf-cover-media__caption--title",
    ".pdf-cover-media__image",
    ".pdf-cover-media__subtitle",
    ".pdf-cover-media__title",
  ],
  spacing: ["body", "p", "section", "h1", "h2", "h3", "ul", "ol", "li", "blockquote"],
  tables: ["table", "thead", "tbody", "tr", "th", "td", "table th", "table td"],
  typography: ["body", "p", "h1", "h2", "h3", "h4", "h5", "h6"],
};

function includesRemoteOrLocalPathReference(css: string): boolean {
  return (
    /https?:\/\//iu.test(css) ||
    /\bfile:\/\//iu.test(css) ||
    /\burl\s*\(\s*['"]?(?:\/|[A-Za-z]:\\|~\/|\.\.\/)/iu.test(css) ||
    /['"](?:\/Users\/|\/home\/|\/var\/|\/tmp\/|[A-Za-z]:\\)/u.test(css)
  );
}

function includesRawPixelImageSizing(css: string): boolean {
  return /\b(?:width|height|max-width|max-height|min-width|min-height)\s*:\s*\d+(?:\.\d+)?px\b/iu.test(
    css,
  );
}

function includesRequiredHookRemoval(css: string): boolean {
  return /(?:#TOC|\.cdx-code-line|\.pdf-cover-media)[^{]*\{[^}]*\b(?:display\s*:\s*none|visibility\s*:\s*hidden|content\s*:\s*none)\b/iu.test(
    css,
  );
}

function hasBalancedBraces(css: string): boolean {
  let depth = 0;
  for (const char of css) {
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0;
}

function topLevelSelectors(css: string): string[] {
  const selectors: string[] = [];
  const matcher = /([^{}]+)\{/gu;
  for (const match of css.matchAll(matcher)) {
    const selector = match[1]?.trim();
    if (selector) {
      selectors.push(selector);
    }
  }
  return selectors;
}

function selectorOwnedBySlot(
  selector: string,
  slot: MarkdownPdfTemplateCodexCssBlockSlot,
): boolean {
  const allowedSelectors = SLOT_SELECTORS[slot];
  return selector
    .split(",")
    .map((part) => part.trim())
    .every((part) => allowedSelectors.includes(part));
}

export function validateMarkdownPdfTemplateCodexCssBlock(
  block: MarkdownPdfTemplateCodexCssBlock,
  context = "css_blocks[]",
): MarkdownPdfTemplateCodexCssBlock {
  const css = block.css.trim();
  if (css.length === 0) {
    throw new Error(`Markdown PDF template Codex response ${context}.css must not be empty.`);
  }
  if (css.length > MAX_CSS_BLOCK_CHARS) {
    throw new Error(
      `Markdown PDF template Codex response ${context}.css must be at most ${MAX_CSS_BLOCK_CHARS} characters.`,
    );
  }
  if (!hasBalancedBraces(css)) {
    throw new Error(`Markdown PDF template Codex response ${context}.css has unbalanced braces.`);
  }
  if (/@import\b/iu.test(css)) {
    throw new Error(`Markdown PDF template Codex response ${context}.css must not use @import.`);
  }
  if (/@/u.test(css)) {
    throw new Error(
      `Markdown PDF template Codex response ${context}.css must use plain selector blocks only.`,
    );
  }
  if (includesRemoteOrLocalPathReference(css)) {
    throw new Error(
      `Markdown PDF template Codex response ${context}.css must not reference remote URLs or absolute local paths.`,
    );
  }
  if (includesRawPixelImageSizing(css)) {
    throw new Error(
      `Markdown PDF template Codex response ${context}.css must use bounded image-fit slots instead of raw pixel sizing.`,
    );
  }
  if (includesRequiredHookRemoval(css)) {
    throw new Error(
      `Markdown PDF template Codex response ${context}.css must preserve required template selectors.`,
    );
  }
  const selectors = topLevelSelectors(css);
  if (selectors.length === 0) {
    throw new Error(
      `Markdown PDF template Codex response ${context}.css must contain selector blocks.`,
    );
  }
  const unownedSelector = selectors.find((selector) => !selectorOwnedBySlot(selector, block.slot));
  if (unownedSelector) {
    throw new Error(
      `Markdown PDF template Codex response ${context}.css selector is outside the ${block.slot} slot: ${unownedSelector}`,
    );
  }
  return { css, slot: block.slot };
}

export function validateMarkdownPdfTemplateCodexCssBlocks(
  blocks: readonly MarkdownPdfTemplateCodexCssBlock[],
): MarkdownPdfTemplateCodexCssBlock[] {
  return blocks.map((block, index) =>
    validateMarkdownPdfTemplateCodexCssBlock(block, `css_blocks[${index}]`),
  );
}
