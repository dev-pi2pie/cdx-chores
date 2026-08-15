import { CliError } from "../../errors";
import {
  MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME,
  type NormalizedMarkdownPdfProfile,
} from "../profile";
import { inspectMarkdownPdfTemplateBody } from "../template-body";
import type { MarkdownPdfTemplateCompatibilityResult } from "../template-compatibility";

export const MD_PDF_PROJECT_CODEX_PAGE_NUMBER_VALIDATION_NAMES = {
  profileBodyCompatibility: "profile-body-page-number-compatibility",
  templateCssOwnership: "template-page-number-css-ownership",
} as const;

interface CssBlock {
  body: string;
  prelude: string;
}

const ORDINARY_PAGE_CHROME_PROPERTIES = new Set(["all", "color", "line-height"]);
const PAGE_MARGIN_BOX_PATTERN =
  /^@(top|bottom|left|right)-(left|center|right|top|middle|bottom)(?:-corner)?$/iu;
const MAX_TEMPLATE_CSS_INSPECTION_CHARS = 100_000;
const MAX_TEMPLATE_CSS_BLOCKS = 2_000;
const MAX_TEMPLATE_CSS_NESTING_DEPTH = 24;

function decodeCssEscape(css: string, index: number): { nextIndex: number; value: string } {
  const next = css[index + 1];
  if (next === "\n" || next === "\f") {
    return { nextIndex: index + 1, value: "" };
  }
  if (next === "\r") {
    return {
      nextIndex: css[index + 2] === "\n" ? index + 2 : index + 1,
      value: "",
    };
  }
  const hex = css.slice(index + 1).match(/^[0-9a-f]{1,6}/iu)?.[0];
  if (hex) {
    const codePoint = Number.parseInt(hex, 16);
    let nextIndex = index + hex.length;
    const trailingWhitespace = css[nextIndex + 1];
    if (trailingWhitespace && /[ \t\r\n\f]/u.test(trailingWhitespace)) {
      nextIndex += trailingWhitespace === "\r" && css[nextIndex + 2] === "\n" ? 2 : 1;
    }
    return {
      nextIndex,
      value: codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "\uFFFD",
    };
  }
  return next ? { nextIndex: index + 1, value: next } : { nextIndex: index, value: "\\" };
}

/**
 * Removes comments and masks string contents before structural inspection.
 * CSS escapes outside strings are decoded so escaped at-rules, properties,
 * functions, and counter names cannot bypass the ownership contract.
 */
function normalizeCssForInspection(css: string): string {
  let result = "";
  let quote: '"' | "'" | undefined;

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];
    if (!char) {
      break;
    }

    if (quote) {
      if (char === "\\") {
        const escape = decodeCssEscape(css, index);
        result += " ";
        index = escape.nextIndex;
        continue;
      }
      if (char === quote) {
        quote = undefined;
      }
      result += " ";
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      result += " ";
      continue;
    }

    if (char === "/" && next === "*") {
      const commentEnd = css.indexOf("*/", index + 2);
      if (commentEnd < 0) {
        throw new Error("Generated Template stylesheet contains an unterminated comment.");
      }
      result += " ";
      index = commentEnd + 1;
      continue;
    }

    if (char === "\\") {
      const escape = decodeCssEscape(css, index);
      result += escape.value;
      index = escape.nextIndex;
      continue;
    }

    result += char;
  }

  if (quote) {
    throw new Error("Generated Template stylesheet contains an unterminated string.");
  }
  return result;
}

function matchingBrace(css: string, openIndex: number): number {
  let depth = 1;
  for (let index = openIndex + 1; index < css.length; index += 1) {
    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  throw new Error("Generated Template stylesheet contains unbalanced braces.");
}

function cssBlocks(css: string, depth = 0): CssBlock[] {
  if (depth > MAX_TEMPLATE_CSS_NESTING_DEPTH) {
    throw new Error("Generated Template stylesheet exceeds the supported rule nesting depth.");
  }
  const blocks: CssBlock[] = [];
  let statementStart = 0;

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === "}") {
      throw new Error("Generated Template stylesheet contains unbalanced braces.");
    }
    if (char === ";") {
      statementStart = index + 1;
      continue;
    }
    if (char !== "{") {
      continue;
    }

    const closeIndex = matchingBrace(css, index);
    const prelude = css.slice(statementStart, index).trim();
    if (!prelude) {
      throw new Error("Generated Template stylesheet contains a rule without a prelude.");
    }
    const body = css.slice(index + 1, closeIndex);
    blocks.push({ body, prelude }, ...cssBlocks(body, depth + 1));
    index = closeIndex;
    statementStart = closeIndex + 1;
  }

  return blocks;
}

function declarations(css: string): Array<{ property: string; value: string }> {
  const output: Array<{ property: string; value: string }> = [];
  let statementStart = 0;

  for (let index = 0; index <= css.length; index += 1) {
    const char = css[index];
    if (char === "{") {
      const closeIndex = matchingBrace(css, index);
      index = closeIndex;
      statementStart = closeIndex + 1;
      continue;
    }
    if (char !== ";" && index !== css.length) {
      continue;
    }

    const statement = css.slice(statementStart, index).trim();
    statementStart = index + 1;
    const colonIndex = statement.indexOf(":");
    if (colonIndex <= 0 || statement.startsWith("@")) {
      continue;
    }
    output.push({
      property: statement.slice(0, colonIndex).trim().toLowerCase(),
      value: statement.slice(colonIndex + 1).trim(),
    });
  }

  return output;
}

function isPageRule(prelude: string): boolean {
  return /^@page(?:\s|:|$)/iu.test(prelude);
}

function pageName(prelude: string): string | undefined {
  const remainder = prelude.replace(/^@page/iu, "").trimStart();
  if (!remainder || remainder.startsWith(":")) {
    return undefined;
  }
  return remainder.match(/^[-_A-Za-z][-_A-Za-z0-9]*/u)?.[0];
}

function isAllowedNamedPage(prelude: string): boolean {
  const name = pageName(prelude);
  return name === "cover" || name === "toc";
}

function isProfileOwnedCounterName(name: string): boolean {
  const normalizedName = name.toLowerCase();
  return (
    normalizedName === "page" ||
    normalizedName === "pages" ||
    normalizedName === MARKDOWN_PDF_LOGICAL_PAGE_COUNTER_NAME
  );
}

function referencesProfileOrIndeterminateCounter(value: string): boolean {
  if (/\btarget-counters?\s*\(/iu.test(value)) {
    return true;
  }
  const callPattern = /\bcounters?\s*\(\s*/giu;
  for (const match of value.matchAll(callPattern)) {
    const argumentStart = (match.index ?? 0) + match[0].length;
    const argument = value.slice(argumentStart);
    const firstArgumentMatch = argument.match(/^([-_A-Za-z][-_A-Za-z0-9]*)/u);
    const firstArgument = firstArgumentMatch?.[1];
    const followingSyntax = firstArgumentMatch
      ? argument.slice(firstArgumentMatch[0].length).trimStart()[0]
      : undefined;
    if (
      !firstArgument ||
      (followingSyntax !== ")" && followingSyntax !== ",") ||
      isProfileOwnedCounterName(firstArgument)
    ) {
      return true;
    }
  }
  return false;
}

function declaresCounterMutation(property: string): boolean {
  return (
    property === "counter-reset" || property === "counter-increment" || property === "counter-set"
  );
}

function mutationValueTokens(value: string): string[] | undefined {
  const tokens: string[] = [];
  let depth = 0;
  let tokenStart: number | undefined;
  for (let index = 0; index <= value.length; index += 1) {
    const char = value[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth < 0) {
        return undefined;
      }
    }
    const boundary =
      index === value.length || (depth === 0 && char !== undefined && /\s/u.test(char));
    if (tokenStart === undefined && !boundary) {
      tokenStart = index;
    }
    if (tokenStart !== undefined && boundary) {
      tokens.push(value.slice(tokenStart, index));
      tokenStart = undefined;
    }
  }
  return depth === 0 ? tokens : undefined;
}

function isStaticUnrelatedCounterName(token: string): boolean {
  const literalName = token.match(/^[-_A-Za-z][-_A-Za-z0-9]*$/u)?.[0]?.toLowerCase();
  if (literalName) {
    return !isProfileOwnedCounterName(literalName);
  }
  const reversedName = token
    .match(/^reversed\(\s*([-_A-Za-z][-_A-Za-z0-9]*)\s*\)$/iu)?.[1]
    ?.toLowerCase();
  return Boolean(reversedName && !isProfileOwnedCounterName(reversedName));
}

function isStaticCounterNumericValue(token: string): boolean {
  return /^[+-]?\d+$/u.test(token) || /^calc\(.+\)$/iu.test(token);
}

function mutationValueUsesIndeterminateOrProfileCounterName(value: string): boolean {
  const tokens = mutationValueTokens(value);
  if (!tokens || tokens.length === 0) {
    return true;
  }
  for (let index = 0; index < tokens.length; index += 1) {
    const counterName = tokens[index];
    if (!counterName || !isStaticUnrelatedCounterName(counterName)) {
      return true;
    }
    const numericValue = tokens[index + 1];
    if (numericValue && isStaticCounterNumericValue(numericValue)) {
      index += 1;
    }
  }
  return false;
}

function counterMutationCompetesWithProfile(input: { property: string; value: string }): boolean {
  if (!declaresCounterMutation(input.property)) {
    return false;
  }
  return mutationValueUsesIndeterminateOrProfileCounterName(input.value);
}

function competesWithOrdinaryPageChrome(property: string): boolean {
  return (
    ORDINARY_PAGE_CHROME_PROPERTIES.has(property) ||
    property === "font" ||
    property.startsWith("font-") ||
    property === "padding" ||
    property.startsWith("padding-") ||
    property === "border" ||
    property.startsWith("border-")
  );
}

function competesWithInheritedOrdinaryPageChrome(property: string): boolean {
  return (
    ORDINARY_PAGE_CHROME_PROPERTIES.has(property) ||
    property === "font" ||
    property.startsWith("font-")
  );
}

function assertOrdinaryPageOwnership(pageRule: CssBlock): void {
  for (const declaration of declarations(pageRule.body)) {
    if (competesWithInheritedOrdinaryPageChrome(declaration.property)) {
      throw new Error(
        `Generated Template stylesheet must not declare competing ordinary-page ${declaration.property} styling.`,
      );
    }
  }

  for (const marginBox of cssBlocks(pageRule.body).filter((block) =>
    PAGE_MARGIN_BOX_PATTERN.test(block.prelude.trim()),
  )) {
    for (const declaration of declarations(marginBox.body)) {
      if (
        declaration.property === "content" &&
        referencesProfileOrIndeterminateCounter(declaration.value)
      ) {
        throw new Error(
          "Generated Template stylesheet must not place Profile-owned page counters in ordinary-page margin boxes.",
        );
      }
      if (competesWithOrdinaryPageChrome(declaration.property)) {
        throw new Error(
          `Generated Template stylesheet must not declare competing ordinary-page margin-box ${declaration.property} styling.`,
        );
      }
    }
  }
}

/**
 * Validates only the freshly generated Template stylesheet contribution.
 * Profile renderer CSS and later user stylesheets deliberately do not pass
 * through this ownership boundary.
 */
export function validateMdPdfProjectCodexTemplatePageNumberCssOwnership(
  templateStyleCss: string,
): void {
  if (templateStyleCss.length > MAX_TEMPLATE_CSS_INSPECTION_CHARS) {
    throw new Error("Generated Template stylesheet exceeds the supported inspection size.");
  }
  const normalizedCss = normalizeCssForInspection(templateStyleCss);
  const blocks = cssBlocks(normalizedCss);
  if (blocks.length > MAX_TEMPLATE_CSS_BLOCKS) {
    throw new Error("Generated Template stylesheet exceeds the supported rule count.");
  }
  if (blocks.some((block) => declarations(block.body).some(counterMutationCompetesWithProfile))) {
    throw new Error(
      "Generated Template stylesheet must not mutate Profile-owned page counters or use indeterminate counter mutation.",
    );
  }
  if (
    blocks.some((block) =>
      declarations(block.body).some((declaration) =>
        referencesProfileOrIndeterminateCounter(declaration.value),
      ),
    )
  ) {
    throw new Error(
      "Generated Template stylesheet must not reference Profile-owned or indeterminate counters.",
    );
  }
  for (const block of blocks) {
    if (!isPageRule(block.prelude)) {
      continue;
    }
    if (!isAllowedNamedPage(block.prelude)) {
      assertOrdinaryPageOwnership(block);
    }
  }
}

/** Resolves the normalized final Profile against the actual generated HTML. */
export function assessMdPdfProjectCodexProfileBodyCompatibility(input: {
  profile: NormalizedMarkdownPdfProfile;
  templateHtml: string;
}): MarkdownPdfTemplateCompatibilityResult {
  const inspection = inspectMarkdownPdfTemplateBody(input.templateHtml);
  if (inspection.status !== "proven") {
    throw new CliError(
      `The generated Project Template requires exactly one .document-body element containing the single live $body$ insertion point (found ${inspection.status}).`,
      {
        code: "MARKDOWN_PDF_BODY_BOUNDARY_REQUIRED",
        exitCode: 2,
      },
    );
  }
  return { bodyBoundary: "proven", inspection };
}
