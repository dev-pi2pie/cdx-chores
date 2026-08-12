import type {
  MarkdownPdfPageChromePosition,
  NormalizedMarkdownPdfPageChromeStyle,
  NormalizedMarkdownPdfProfile,
} from "./types";

export type MarkdownPdfPageChromeBodyBoundary =
  | "not-required"
  | "proven"
  | "legacy-document-origin-fallback";

export interface CreateMarkdownPdfPageChromeCssInput {
  bodyBoundary?: MarkdownPdfPageChromeBodyBoundary;
}

function cssString(value: string): string {
  return JSON.stringify(value);
}

function cssContentFromTemplate(value: string, metadata: Record<string, string>): string {
  const tokens: string[] = [];
  let cursor = 0;

  for (const match of value.matchAll(/\{(pages?|[A-Za-z][A-Za-z0-9_.-]*)\}/g)) {
    const index = match.index ?? 0;
    const before = value.slice(cursor, index);
    if (before) {
      tokens.push(cssString(before));
    }

    const key = match[1] ?? "";
    if (key === "page") {
      tokens.push("counter(page)");
    } else if (key === "pages") {
      tokens.push("counter(pages)");
    } else {
      const replacement = metadata[key] ?? "";
      if (replacement) {
        tokens.push(cssString(replacement));
      }
    }

    cursor = index + match[0].length;
  }

  const after = value.slice(cursor);
  if (after) {
    tokens.push(cssString(after));
  }

  return tokens.length > 0 ? tokens.join(" ") : cssString("");
}

function pageNumberSlot(position: MarkdownPdfPageChromePosition): {
  area: "header" | "footer";
  slot: "left" | "center" | "right";
} {
  const [area, slot] = position.split("-") as ["top" | "bottom", "left" | "center" | "right"];
  return {
    area: area === "top" ? "header" : "footer",
    slot,
  };
}

function emptyMarginBoxes(): string {
  return `  @top-left {
    content: none;
  }

  @top-center {
    content: none;
  }

  @top-right {
    content: none;
  }

  @bottom-left {
    content: none;
  }

  @bottom-center {
    content: none;
  }

  @bottom-right {
    content: none;
  }`;
}

function marginBoxRule(
  cssArea: "top" | "bottom",
  slot: "left" | "center" | "right",
  value: string,
  metadata: Record<string, string>,
  style?: NormalizedMarkdownPdfPageChromeStyle,
): string {
  const declarations: string[] = [];
  if (style?.fontSize !== undefined) {
    declarations.push(`font-size: ${style.fontSize};`);
  }
  if (style?.fontWeight !== undefined) {
    declarations.push(`font-weight: ${style.fontWeight};`);
  }
  if (style?.lineHeight !== undefined) {
    declarations.push(`line-height: ${style.lineHeight};`);
  }
  if (style?.color !== undefined) {
    declarations.push(`color: ${style.color};`);
  }

  const separator = style?.separator;
  const separatorSide = cssArea === "top" ? "bottom" : "top";
  if (separator?.width !== undefined) {
    declarations.push(`border-${separatorSide}-width: ${separator.width};`);
  }
  if (separator?.style !== undefined) {
    declarations.push(`border-${separatorSide}-style: ${separator.style};`);
  }
  if (separator?.color !== undefined) {
    declarations.push(`border-${separatorSide}-color: ${separator.color};`);
  }
  if (separator?.gap !== undefined) {
    declarations.push(`padding-${separatorSide}: ${separator.gap};`);
  }

  const styleCss = declarations.map((declaration) => `    ${declaration}`).join("\n");
  return `  @${cssArea}-${slot} {
    content: ${cssContentFromTemplate(value, metadata)};${styleCss ? `\n${styleCss}` : ""}
  }`;
}

function pageRule(selector: string, declarations: string[], marginBoxes: string[]): string {
  const content = [...declarations.map((declaration) => `  ${declaration}`), ...marginBoxes].join(
    "\n\n",
  );
  const suffix = !selector ? "" : selector.startsWith(":") ? selector : ` ${selector}`;
  return `@page${suffix} {
${content}
}`;
}

export function createMarkdownPdfPageChromeCss(
  profile: NormalizedMarkdownPdfProfile | undefined,
  input: CreateMarkdownPdfPageChromeCssInput = {},
): string {
  if (!profile) {
    return "";
  }

  const pageNumbers = profile.pageNumbers;
  const bodyBoundary = input.bodyBoundary ?? "proven";
  if (
    pageNumbers.enabled &&
    pageNumbers.countFrom === "body" &&
    bodyBoundary === "legacy-document-origin-fallback"
  ) {
    throw new Error(
      "Markdown PDF page-chrome invariant violated: legacy document-origin fallback cannot satisfy countFrom: body.",
    );
  }
  const usesLegacyDocumentVisibility =
    pageNumbers.enabled &&
    pageNumbers.scope === "body" &&
    bodyBoundary === "legacy-document-origin-fallback";
  const usesProvenBodyVisibility =
    pageNumbers.enabled && pageNumbers.scope === "body" && !usesLegacyDocumentVisibility;
  const usesDocumentVisibility =
    pageNumbers.enabled && (pageNumbers.scope === "document" || usesLegacyDocumentVisibility);
  const numberTarget = pageNumbers.enabled ? pageNumberSlot(pageNumbers.position) : undefined;
  const slots = {
    header: { ...profile.header },
    footer: { ...profile.footer },
  };
  if (numberTarget) {
    // The selected slot remains page-number-owned even when body visibility
    // keeps its content off pre-body pages.
    slots[numberTarget.area][numberTarget.slot] = usesDocumentVisibility ? pageNumbers.format : "";
  }

  const genericMarginBoxes: string[] = [];
  const pageAreas = [
    ["header", "top"],
    ["footer", "bottom"],
  ] as const;
  const pageSlots = ["left", "center", "right"] as const;

  for (const [area, cssArea] of pageAreas) {
    for (const slot of pageSlots) {
      const value = slots[area][slot];
      if (!value) {
        continue;
      }
      genericMarginBoxes.push(
        marginBoxRule(cssArea, slot, value, profile.metadata, slots[area].style),
      );
    }
  }

  const genericDeclarations =
    pageNumbers.enabled && pageNumbers.countFrom === "document"
      ? [`counter-increment: page ${pageNumbers.increment};`]
      : [];
  const generatedRules: string[] = [];

  if (genericDeclarations.length > 0 || genericMarginBoxes.length > 0) {
    generatedRules.push(pageRule("", genericDeclarations, genericMarginBoxes));
  }

  if (pageNumbers.enabled && pageNumbers.countFrom === "document") {
    generatedRules.push(
      pageRule(
        ":nth(1)",
        [`counter-reset: page ${pageNumbers.start - pageNumbers.increment};`],
        [],
      ),
    );
  }

  if (usesProvenBodyVisibility || (pageNumbers.enabled && pageNumbers.countFrom === "body")) {
    const bodyDeclarations =
      pageNumbers.enabled && pageNumbers.countFrom === "body"
        ? [`counter-increment: page ${pageNumbers.increment};`]
        : [];
    const bodyMarginBoxes =
      usesProvenBodyVisibility && numberTarget
        ? [
            marginBoxRule(
              numberTarget.area === "header" ? "top" : "bottom",
              numberTarget.slot,
              pageNumbers.format,
              profile.metadata,
              slots[numberTarget.area].style,
            ),
          ]
        : [];
    generatedRules.push(pageRule("body", bodyDeclarations, bodyMarginBoxes));

    if (pageNumbers.enabled && pageNumbers.countFrom === "body") {
      generatedRules.push(
        pageRule(
          "body:nth(1 of body)",
          [`counter-reset: page ${pageNumbers.start - pageNumbers.increment};`],
          [],
        ),
      );
    }
    generatedRules.push(".document-body {\n  page: body;\n}");
  }

  if (generatedRules.length === 0) {
    return "";
  }

  const tocMarginBoxes = [emptyMarginBoxes()];
  if (usesDocumentVisibility && numberTarget) {
    tocMarginBoxes.push(
      marginBoxRule(
        numberTarget.area === "header" ? "top" : "bottom",
        numberTarget.slot,
        pageNumbers.format,
        profile.metadata,
        slots[numberTarget.area].style,
      ),
    );
  }
  generatedRules.push(pageRule("toc", [], tocMarginBoxes));

  return `\n${generatedRules.join("\n\n")}\n`;
}

export { emptyMarginBoxes as createMarkdownPdfEmptyMarginBoxesCss };
