import { expect } from "bun:test";

function readCssDeclarationBlock(
  styleCss: string,
  selectorIndex: number,
): { declarations: Record<string, string>; endIndex: number } {
  const openBraceIndex = styleCss.indexOf("{", selectorIndex);
  expect(openBraceIndex).toBeGreaterThanOrEqual(0);
  let closeBraceIndex = -1;
  let quote: '"' | "'" | undefined;
  let parenDepth = 0;
  for (let index = openBraceIndex + 1; index < styleCss.length; index += 1) {
    const char = styleCss[index];
    const previous = styleCss[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (char === "}" && parenDepth === 0) {
      closeBraceIndex = index;
      break;
    }
  }
  expect(closeBraceIndex).toBeGreaterThan(openBraceIndex);
  return {
    declarations: parseCssDeclarations(styleCss.slice(openBraceIndex + 1, closeBraceIndex)),
    endIndex: closeBraceIndex,
  };
}

function parseCssDeclarations(block: string): Record<string, string> {
  const declarations: string[] = [];
  let declarationStart = 0;
  let quote: '"' | "'" | undefined;
  let parenDepth = 0;
  for (let index = 0; index < block.length; index += 1) {
    const char = block[index];
    const previous = block[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (char === ";" && parenDepth === 0) {
      declarations.push(block.slice(declarationStart, index));
      declarationStart = index + 1;
    }
  }
  declarations.push(block.slice(declarationStart));
  return Object.fromEntries(
    declarations
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1).trim()];
      }),
  );
}

export function cssDeclarationBlocksForSelector(
  styleCss: string,
  selector: string,
): Record<string, string>[] {
  const blocks: Record<string, string>[] = [];
  let searchIndex = 0;
  while (searchIndex < styleCss.length) {
    const selectorIndex = styleCss.indexOf(selector, searchIndex);
    if (selectorIndex < 0) {
      break;
    }
    const nextNonWhitespace = styleCss.slice(selectorIndex + selector.length).search(/\S/);
    const openBraceOffset = selectorIndex + selector.length + nextNonWhitespace;
    const previousNonWhitespace = styleCss.slice(0, selectorIndex).search(/\S\s*$/);
    const isExactSelector =
      nextNonWhitespace >= 0 &&
      styleCss[openBraceOffset] === "{" &&
      (previousNonWhitespace < 0 || styleCss[previousNonWhitespace] === "}");
    if (!isExactSelector) {
      searchIndex = selectorIndex + selector.length;
      continue;
    }
    const block = readCssDeclarationBlock(styleCss, selectorIndex);
    blocks.push(block.declarations);
    searchIndex = block.endIndex + 1;
  }
  expect(blocks.length).toBeGreaterThan(0);
  return blocks;
}

export function cssDeclarationsForSelector(
  styleCss: string,
  selector: string,
): Record<string, string> {
  const [declarations] = cssDeclarationBlocksForSelector(styleCss, selector);
  expect(declarations).toBeDefined();
  return declarations!;
}
