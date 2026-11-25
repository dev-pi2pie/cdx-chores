import {
  type InlineDeclaration,
  type InlineVariables,
  inlineValue,
  inlineVariables,
} from "./ast-title-variables";
import { normalizeCssForInspection } from "../css-inspection";

export interface TitleBlockStyle {
  display: "box" | "omitted" | "unknown";
  visibility: "visible" | "hidden" | "unknown";
  variables: InlineVariables;
  position: string | null;
  float: string | null;
}

export const documentTitleStyle: TitleBlockStyle = {
  display: "box",
  visibility: "visible",
  variables: () => undefined,
  position: "static",
  float: "none",
};
const singleDisplayBox =
  /^(?:inline-(?:block|flex|grid|table)|table-(?:caption|cell|row|row-group|header-group|footer-group))$/u;
const insideDisplay = new Set(["flow", "flow-root", "flex", "grid", "table"]);

// WeasyPrint accepts one outside keyword, one inside keyword, and an optional
// list-item in any order. List items only support flow and flow-root.
function generatesBox(value: string): boolean {
  if (singleDisplayBox.test(value)) return true;
  const tokens = value.split(/ +/u);
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
  // Only CSS whitespace separates tokens. Other Unicode spaces can be part of an identifier.
  const source = css.replace(/[\t\n\r\f]/gu, " ");
  let start = 0;
  let depth = 0;
  for (const token of source.matchAll(/[(){}[\];]|$/gu)) {
    const char = token[0];
    if (char === "" || (char === ";" && depth === 0)) {
      const match =
        /^ *(display|visibility|position|float|--[-\w\u0080-\u{10ffff}]+) *: *([\s\S]*?) *(! *important)? *$/iu.exec(
          source.slice(start, token.index),
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

type Property = "display" | "visibility" | "float" | "position";
type Cascade = Partial<Record<Property, string | null>>;

function accepted(property: Property, value: string): boolean {
  switch (property) {
    case "display":
      return (
        value === "none" ||
        value === "table-column" ||
        value === "table-column-group" ||
        generatesBox(value)
      );
    case "visibility":
      return /^(visible|hidden|collapse)$/u.test(value);
    case "float":
      return /^(none|left|right|inline-start|inline-end|footnote)$/u.test(value);
    case "position":
      return /^(?:static|relative|absolute|fixed|(?:running|note)\( *(?:--|-?[_a-zA-Z\u0080-\u{10ffff}])[-\w\u0080-\u{10ffff}]* *\))$/u.test(
        value,
      );
  }
}

// A declaration invalid after var() substitution uses its initial or inherited
// value. An invalid literal has no effect on the cascade.
function cascade(rules: InlineDeclaration[], variables: InlineVariables): Cascade {
  const result: Cascade = {};
  const priority = new Set<Property>();
  for (const { property, value: raw, important } of rules) {
    if (
      property !== "display" &&
      property !== "visibility" &&
      property !== "float" &&
      property !== "position"
    )
      continue;
    if (priority.has(property) && !important) continue;
    const value = inlineValue(raw, variables);
    const folded = value?.toLowerCase();
    if (value === undefined) result[property] = null;
    else if (folded === "inherit" || folded === "initial") result[property] = folded;
    else {
      // Display tokens and position function names retain their case in WeasyPrint.
      const preserveCase =
        property === "display" || (property === "position" && value.includes("("));
      const keyword = preserveCase ? value : value.toLowerCase();
      if (accepted(property, keyword)) result[property] = keyword;
      else if (/(?<![\w-])var\(/iu.test(raw))
        result[property] = property === "visibility" ? "inherit" : "initial";
      else continue;
    }
    if (important) priority.add(property);
  }
  return result;
}

function computed(value: string | null | undefined, initial: string, parent: string | null) {
  if (value === "inherit") return parent;
  return value === "initial" || value === undefined ? initial : value;
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

  if (!style && !hiddenAttribute && inherited.position === "static" && inherited.float === "none")
    return inherited;
  const rules = [...declarations(style)];
  const variables = inlineVariables(rules, inherited.variables);
  const values = cascade(rules, variables);
  const position = computed(values.position, "static", inherited.position);
  const specifiedFloat = computed(values.float, "none", inherited.float);
  const positioned = position === "absolute" || position === "fixed";
  // Running elements and named notes contribute to page material outside the body.
  const running = position?.startsWith("running(") || position?.startsWith("note(");
  const float = positioned || running ? "none" : specifiedFloat;

  const value =
    values.display === undefined && hiddenAttribute
      ? "none"
      : computed(values.display, "block", "block");
  let display: TitleBlockStyle["display"] = "box";
  if (running || value === "none") display = "omitted";
  else if (value === null) display = "unknown";
  else if (value === "table-column" || value === "table-column-group") {
    // WeasyPrint converts floated and absolutely positioned table columns to
    // block boxes before discarding the contents of remaining column boxes.
    if (!positioned && (specifiedFloat === "none" || specifiedFloat === null)) {
      display = position === null || specifiedFloat === null ? "unknown" : "omitted";
    }
  }

  const ownVisibility =
    values.visibility === undefined
      ? inherited.visibility
      : computed(values.visibility, "visible", inherited.visibility);
  const visibility =
    ownVisibility === null || ownVisibility === "unknown"
      ? "unknown"
      : ownVisibility === "visible"
        ? "visible"
        : "hidden";
  if (inherited.display === "unknown" && display === "box") display = "unknown";
  return { display, visibility, variables, position, float };
}
