import { normalizeCssForInspection } from "./css-inspection";

type Visibility = "visible" | "hidden" | "omitted";
const cssWide = /^(?:initial|inherit|unset|revert|revert-layer)$/u;
// Recognize explicit box-generating display values. An invalid declaration
// must not cancel a preceding display:none or override the HTML hidden attribute.
const displayBox =
  /^(?:block|inline|inline-block|list-item|flow|flow-root|flex|inline-flex|grid|inline-grid|table|inline-table|table-(?:caption|cell|column|column-group|row|row-group|header-group|footer-group)|(?:block|inline)\s+(?:flow|flow-root|flex|grid|table))$/u;

function* declarations(style: string) {
  const { css } = normalizeCssForInspection(style, {
    lowercase: true,
    maskStrings: true,
    commentReplacement: " ",
  });
  let start = 0;
  let depth = 0;
  for (const token of css.matchAll(/[(){}[\];]|$/gu)) {
    const char = token[0];
    if (char === "" || (char === ";" && depth === 0)) {
      const match =
        /^\s*(display|visibility|all)\s*:\s*([a-z-]+(?:\s+[a-z-]+)*?)\s*(!\s*important)?\s*$/u.exec(
          css.slice(start, token.index),
        );
      if (match) yield { property: match[1], value: match[2]!, important: !!match[3] };
      start = token.index + 1;
    } else if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) depth = Math.max(depth - 1, 0);
  }
}

// display:none removes the subtree. visibility is inherited and a descendant
// can restore visibility:visible. Inline author display overrides the UA's [hidden].
export function titleBlockVisibility(
  attributes: unknown,
  inherited: "hidden" | "visible",
): Visibility {
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

  let omitted = hiddenAttribute;
  let visibility = inherited;
  let displayImportant = false;
  let visibilityImportant = false;
  for (const { property, value, important } of declarations(style)) {
    const wide = cssWide.test(value);
    if (
      (property === "display" || (property === "all" && wide)) &&
      (!displayImportant || important) &&
      (value === "none" || wide || displayBox.test(value))
    ) {
      omitted = value === "none" || (value.startsWith("revert") && hiddenAttribute);
      displayImportant = important;
    }
    if (
      (property === "visibility" || (property === "all" && wide)) &&
      (!visibilityImportant || important)
    ) {
      if (value === "hidden" || value === "collapse") visibility = "hidden";
      else if (value === "visible" || value === "initial") visibility = "visible";
      else if (wide) visibility = inherited;
      else continue;
      visibilityImportant = important;
    }
  }
  return omitted ? "omitted" : visibility;
}
