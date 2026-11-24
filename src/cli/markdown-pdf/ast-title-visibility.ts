import {
  type InlineDeclaration,
  type InlineVariables,
  inlineKeywords,
  inlineVariables,
} from "./ast-title-variables";
import { normalizeCssForInspection } from "./css-inspection";

export interface TitleBlockStyle {
  display: "box" | "omitted" | "unknown";
  visibility: "visible" | "hidden" | "unknown";
  variables: InlineVariables;
}

export const documentTitleStyle: TitleBlockStyle = {
  display: "box",
  visibility: "visible",
  variables: () => undefined,
};
const singleDisplayBox =
  /^(?:inline-(?:block|flex|grid|table)|table-(?:caption|cell|column|column-group|row|row-group|header-group|footer-group))$/u;
const insideDisplay = new Set(["flow", "flow-root", "flex", "grid", "table"]);

// WeasyPrint accepts one outside keyword, one inside keyword, and an optional
// list-item in any order. List items only support flow and flow-root.
function generatesBox(value: string): boolean {
  if (singleDisplayBox.test(value)) return true;
  const tokens = value.split(/\s+/u);
  if (tokens.length > 3) return false;
  let outside = false;
  let inside: string | undefined;
  let listItem = false;
  for (const token of tokens) {
    if (!outside && (token === "block" || token === "inline")) outside = true;
    else if (!inside && insideDisplay.has(token)) inside = token;
    else if (!listItem && token === "list-item") listItem = true;
    else return false;
  }
  return !listItem || !inside || inside === "flow" || inside === "flow-root";
}

function* declarations(style: string): Generator<InlineDeclaration> {
  const { css } = normalizeCssForInspection(style, {
    lowercase: false,
    preserveTokenBoundaries: true,
    maskStrings: true,
    commentReplacement: " ",
  });
  let start = 0;
  let depth = 0;
  for (const token of css.matchAll(/[(){}[\];]|$/gu)) {
    const char = token[0];
    if (char === "" || (char === ";" && depth === 0)) {
      const match =
        /^\s*(display|visibility|--[\w-]+)\s*:\s*([\s\S]*?)\s*(!\s*important)?\s*$/iu.exec(
          css.slice(start, token.index),
        );
      if (match) {
        const name = match[1]!;
        yield {
          property: name.startsWith("--") ? name : name.toLowerCase(),
          value: match[2]!,
          important: !!match[3],
        };
      }
      start = token.index + 1;
    } else if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) depth = Math.max(depth - 1, 0);
  }
}

// display:none removes the subtree. visibility is inherited and a descendant
// can restore visibility:visible. Inline author display overrides the UA's [hidden].
export function titleBlockVisibility(
  attributes: unknown,
  inherited: TitleBlockStyle,
): TitleBlockStyle {
  const entries = Array.isArray(attributes) ? attributes[2] : undefined;
  if (!Array.isArray(entries)) return inherited;
  let hiddenAttribute = false;
  let style = "";
  for (const entry of entries) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") continue;
    const name = entry[0].toLowerCase();
    if (name === "hidden") hiddenAttribute = true;
    if (name === "style" && typeof entry[1] === "string") style = entry[1];
  }

  if (!style && !hiddenAttribute) return inherited;
  const rules = [...declarations(style)];
  const variables = inlineVariables(rules, inherited.variables);
  let display: TitleBlockStyle["display"] = hiddenAttribute ? "omitted" : "box";
  let visibility = inherited.visibility;
  let displayImportant = false;
  let visibilityImportant = false;
  for (const { property, value: raw, important } of rules) {
    if (property !== "display" && property !== "visibility") continue;
    const value = inlineKeywords(raw, variables);
    const folded = value?.toLowerCase();
    const wide = folded === "initial" || folded === "inherit";
    // Invalid literal declarations are ignored. A winning var() declaration
    // that computes to an invalid value uses the initial or inherited value.
    const substituted = /(?<![\w-])var\(/iu.test(raw);
    if (
      property === "display" &&
      (!displayImportant || important) &&
      (substituted || value === undefined || value === "none" || wide || generatesBox(value))
    ) {
      display = value === undefined ? "unknown" : value === "none" ? "omitted" : "box";
      displayImportant = important;
    }
    if (property === "visibility" && (!visibilityImportant || important)) {
      if (value === undefined) visibility = "unknown";
      else if (folded === "hidden" || folded === "collapse") visibility = "hidden";
      else if (folded === "visible" || folded === "initial") visibility = "visible";
      else if (wide || substituted) visibility = inherited.visibility;
      else continue;
      visibilityImportant = important;
    }
  }
  if (inherited.display === "unknown" && display === "box") display = "unknown";
  return { display, visibility, variables };
}
