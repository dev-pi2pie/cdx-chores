import { parse, parseFragment, serialize, type DefaultTreeAdapterTypes } from "parse5";
import { createHighlighter } from "shiki";

import { CliError } from "../errors";
import { MARKDOWN_PDF_CODE_THEMES, type EffectiveMarkdownPdfCodeOptions } from "./profile";

type Parse5Node = DefaultTreeAdapterTypes.Node;
type Parse5Element = DefaultTreeAdapterTypes.Element;
type Parse5ParentNode = DefaultTreeAdapterTypes.ParentNode;

const CODE_LANGUAGE_SUPPORT = [
  { language: "javascript", aliases: ["js"] },
  { language: "typescript", aliases: ["ts"] },
  { language: "jsx", aliases: [] },
  { language: "tsx", aliases: [] },
  { language: "shellscript", aliases: ["sh", "bash", "zsh"] },
  { language: "yaml", aliases: ["yml"] },
  { language: "markdown", aliases: ["md"] },
  { language: "python", aliases: ["py"] },
] as const;

const CODE_LANGUAGES = CODE_LANGUAGE_SUPPORT.map(({ language }) => language);

const LANGUAGE_ALIASES = new Map<string, string>(
  CODE_LANGUAGE_SUPPORT.flatMap(({ language, aliases }) => [
    [language, language],
    ...aliases.map((alias) => [alias, language] as const),
  ]),
);

interface CodeBlock {
  parent: Parse5ParentNode;
  index: number;
  pre: Parse5Element;
  code: Parse5Element;
}

interface MarkdownPdfCodeRenderer {
  supportedLanguages: Set<string>;
  render(code: string, language: string, theme: EffectiveMarkdownPdfCodeOptions["theme"]): string;
}

function isElement(node: Parse5Node): node is Parse5Element {
  return "tagName" in node;
}

function attrValue(node: Parse5Element, name: string): string | undefined {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

function setAttr(node: Parse5Element, name: string, value: string): void {
  const attr = node.attrs.find((candidate) => candidate.name === name);
  if (attr) {
    attr.value = value;
    return;
  }
  node.attrs.push({ name, value });
}

function addClasses(node: Parse5Element, classes: string[]): void {
  const current = attrValue(node, "class")?.split(/\s+/).filter(Boolean) ?? [];
  setAttr(node, "class", Array.from(new Set([...current, ...classes])).join(" "));
}

function stripFontFamilyStyle(node: Parse5Element): void {
  const style = attrValue(node, "style");
  if (!style) {
    return;
  }

  const nextStyle = style
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^font-family\s*:/i.test(part))
    .join(";");
  if (nextStyle) {
    setAttr(node, "style", nextStyle);
  } else {
    node.attrs = node.attrs.filter((attr) => attr.name !== "style");
  }
}

function collectText(node: Parse5Node): string {
  if (node.nodeName === "#text" && "value" in node && typeof node.value === "string") {
    return node.value;
  }
  if ("childNodes" in node) {
    return node.childNodes.map(collectText).join("");
  }
  return "";
}

function walkElements(node: Parse5Node, visitor: (node: Parse5Element) => void): void {
  if (isElement(node)) {
    visitor(node);
  }
  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      walkElements(child, visitor);
    }
  }
}

function findCodeBlocks(node: Parse5Node, blocks: CodeBlock[] = []): CodeBlock[] {
  if (!("childNodes" in node)) {
    return blocks;
  }

  node.childNodes.forEach((child, index) => {
    if (isElement(child) && child.tagName === "pre") {
      const code = child.childNodes.find(
        (candidate) => isElement(candidate) && candidate.tagName === "code",
      );
      if (code && isElement(code)) {
        blocks.push({ parent: node, index, pre: child, code });
      }
    }
    findCodeBlocks(child, blocks);
  });
  return blocks;
}

function classTokens(...nodes: Parse5Element[]): string[] {
  return nodes.flatMap((node) => attrValue(node, "class")?.split(/\s+/).filter(Boolean) ?? []);
}

function findSupportedLanguageToken(tokens: string[]): string | undefined {
  for (const token of tokens) {
    const language = LANGUAGE_ALIASES.get(token.toLowerCase());
    if (language) {
      return language;
    }
  }
  return undefined;
}

function extractCodeLanguage(block: CodeBlock): string | undefined {
  const classes = classTokens(block.code, block.pre);
  for (const token of classes) {
    const match = token.match(/^(?:language|lang)-(.+)$/);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  if (classes.includes("sourceCode")) {
    return findSupportedLanguageToken(classes.filter((token) => token !== "sourceCode"));
  }
  return undefined;
}

function normalizeCodeLanguage(language: string | undefined): string | undefined {
  if (!language) {
    return undefined;
  }
  return LANGUAGE_ALIASES.get(language) ?? language;
}

function markPlainBlock(block: CodeBlock): void {
  addClasses(block.pre, ["cdx-code", "cdx-code--plain"]);
  addClasses(block.code, ["cdx-code__content"]);
}

function copyAttrIfMissing(source: Parse5Element, target: Parse5Element, name: string): void {
  const value = attrValue(source, name);
  if (value && !attrValue(target, name)) {
    setAttr(target, name, value);
  }
}

function parseSinglePreFragment(html: string): Parse5Element {
  const fragment = parseFragment(html);
  const pre = fragment.childNodes.find((node) => isElement(node) && node.tagName === "pre");
  if (!pre || !isElement(pre)) {
    throw new CliError("Shiki did not return a <pre> code block.", {
      code: "INVALID_INPUT",
      exitCode: 1,
    });
  }
  return pre;
}

function applyHighlightedBlock(block: CodeBlock, highlightedPre: Parse5Element): void {
  addClasses(highlightedPre, ["cdx-code", "cdx-code--highlighted"]);
  copyAttrIfMissing(block.pre, highlightedPre, "id");
  stripFontFamilyStyle(highlightedPre);

  for (const node of highlightedPre.childNodes) {
    if (isElement(node) && node.tagName === "code") {
      addClasses(node, ["cdx-code__content"]);
    }
  }

  walkElements(highlightedPre, stripFontFamilyStyle);
  block.parent.childNodes[block.index] = highlightedPre;
  highlightedPre.parentNode = block.parent;
}

function transformCodeBlocks(
  document: DefaultTreeAdapterTypes.Document,
  options: EffectiveMarkdownPdfCodeOptions,
  renderer: MarkdownPdfCodeRenderer,
): string {
  for (const block of findCodeBlocks(document)) {
    const language = normalizeCodeLanguage(extractCodeLanguage(block));
    if (!language || !renderer.supportedLanguages.has(language)) {
      markPlainBlock(block);
      continue;
    }

    const highlightedPre = parseSinglePreFragment(
      renderer.render(collectText(block.code), language, options.theme),
    );
    applyHighlightedBlock(block, highlightedPre);
  }

  return serialize(document);
}

export async function highlightMarkdownPdfCodeBlocks(
  html: string,
  options: EffectiveMarkdownPdfCodeOptions,
): Promise<string> {
  if (!options.highlight) {
    return html;
  }

  let document: DefaultTreeAdapterTypes.Document;
  try {
    document = parse(html);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to parse Markdown PDF HTML for code highlighting: ${message}`, {
      code: "INVALID_INPUT",
      exitCode: 1,
    });
  }

  const highlighter = await createHighlighter({
    themes: [...MARKDOWN_PDF_CODE_THEMES],
    langs: [...CODE_LANGUAGES],
  });
  const renderer: MarkdownPdfCodeRenderer = {
    supportedLanguages: new Set(highlighter.getLoadedLanguages()),
    render: (code, language, theme) =>
      highlighter.codeToHtml(code, {
        lang: language,
        theme,
      }),
  };

  try {
    return transformCodeBlocks(document, options, renderer);
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`Failed to highlight Markdown PDF code blocks: ${message}`, {
      code: "INVALID_INPUT",
      exitCode: 1,
    });
  } finally {
    highlighter.dispose();
  }
}
