export type CssInspectionIssue = "unterminated-comment" | "unterminated-string";

export interface CssInspectionOptions {
  commentReplacement: string;
  lowercase: boolean;
  maskStrings: boolean;
}

export interface CssInspectionResult {
  css: string;
  issue?: CssInspectionIssue;
}

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

/** Normalizes CSS syntax for bounded structural and ownership inspection. */
export function normalizeCssForInspection(
  css: string,
  options: CssInspectionOptions,
): CssInspectionResult {
  let result = "";
  let quote: '"' | "'" | undefined;
  const normalizeCase = (value: string): string =>
    options.lowercase ? value.toLowerCase() : value;

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];
    if (!char) {
      break;
    }

    if (quote) {
      if (char === "\\") {
        const escape = decodeCssEscape(css, index);
        result += options.maskStrings ? " " : normalizeCase(escape.value);
        index = escape.nextIndex;
        continue;
      }
      if (char === quote) {
        quote = undefined;
      }
      result += options.maskStrings ? " " : normalizeCase(char);
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      result += options.maskStrings ? " " : char;
      continue;
    }

    if (char === "/" && next === "*") {
      const commentEnd = css.indexOf("*/", index + 2);
      if (commentEnd < 0) {
        return { css: result, issue: "unterminated-comment" };
      }
      result += options.commentReplacement;
      index = commentEnd + 1;
      continue;
    }

    if (char === "\\") {
      const escape = decodeCssEscape(css, index);
      result += normalizeCase(escape.value);
      index = escape.nextIndex;
      continue;
    }

    result += normalizeCase(char);
  }

  return quote ? { css: result, issue: "unterminated-string" } : { css: result };
}
