import type { MarkdownPdfPageChromePosition, NormalizedMarkdownPdfProfile } from "./types";

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

export function createMarkdownPdfPageChromeCss(
  profile: NormalizedMarkdownPdfProfile | undefined,
): string {
  if (!profile) {
    return "";
  }

  const slots = {
    header: { ...profile.header },
    footer: { ...profile.footer },
  };
  if (profile.pageNumbers.enabled) {
    const target = pageNumberSlot(profile.pageNumbers.position);
    slots[target.area][target.slot] = profile.pageNumbers.format;
  }

  const rules: string[] = [];
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
      rules.push(`  @${cssArea}-${slot} {
    content: ${cssContentFromTemplate(value, profile.metadata)};
  }`);
    }
  }

  if (rules.length === 0) {
    return "";
  }

  return `
@page {
${rules.join("\n\n")}
}

@page toc {
}
`;
}
