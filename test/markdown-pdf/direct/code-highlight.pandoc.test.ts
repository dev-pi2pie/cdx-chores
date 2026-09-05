import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parse, type DefaultTreeAdapterTypes } from "parse5";

import { MARKDOWN_PDF_CODE_CLASSES } from "../../../src/cli/markdown-pdf/code-style";
import { highlightMarkdownPdfCodeBlocks } from "../../../src/cli/markdown-pdf/code-highlight";
import type { EffectiveMarkdownPdfCodeOptions } from "../../../src/cli/markdown-pdf/profile/types";
import { REPO_ROOT } from "../../helpers/cli-test-utils";
import { withPandocFixtureDir, type PandocRunner } from "../pandoc-support";

const CODE_OPTIONS: EffectiveMarkdownPdfCodeOptions = {
  highlight: true,
  theme: "github-light",
  lineNumbers: false,
  transformerNotation: false,
};

const FIXTURE_DIR = join(REPO_ROOT, "test", "fixtures", "docs", "markdown-pdf-code");

type Parse5Node = DefaultTreeAdapterTypes.Node;
type Parse5Element = DefaultTreeAdapterTypes.Element;

async function pandocHtmlFixture(runPandoc: PandocRunner, fileName: string): Promise<string> {
  const proc = await runPandoc([
    join(FIXTURE_DIR, fileName),
    "--standalone",
    "--from",
    "markdown",
    "--to",
    "html",
  ]);
  expect(proc.exitCode).toBe(0);
  return proc.stdout;
}

function countClass(html: string, className: string): number {
  return html.match(new RegExp(className, "g"))?.length ?? 0;
}

function isElement(node: Parse5Node): node is Parse5Element {
  return "tagName" in node;
}

function attrValue(node: Parse5Element, name: string): string | undefined {
  return node.attrs.find((attr) => attr.name === name)?.value;
}

function classList(node: Parse5Element): string[] {
  return attrValue(node, "class")?.split(/\s+/).filter(Boolean) ?? [];
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

function collectElements(node: Parse5Node, elements: Parse5Element[] = []): Parse5Element[] {
  if (isElement(node)) {
    elements.push(node);
  }
  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      collectElements(child, elements);
    }
  }
  return elements;
}

function lineElements(html: string): Parse5Element[] {
  return collectElements(parse(html)).filter((node) =>
    classList(node).includes(MARKDOWN_PDF_CODE_CLASSES.shikiLine),
  );
}

function expectLineTextState(html: string, text: string, className: string): void {
  const line = lineElements(html).find((node) => collectText(node).includes(text));
  expect(line).toBeDefined();
  expect(classList(line as Parse5Element)).toContain(className);
}

function expectLineTextWithoutState(html: string, text: string, className: string): void {
  const line = lineElements(html).find((node) => collectText(node).includes(text));
  expect(line).toBeDefined();
  expect(classList(line as Parse5Element)).not.toContain(className);
}

function expectNumberedLineState(html: string, lineNumber: number, className: string): void {
  const line = lineElements(html).find(
    (node) => attrValue(node, "data-line") === String(lineNumber),
  );
  expect(line).toBeDefined();
  expect(classList(line as Parse5Element)).toContain(className);
}

describe("markdown PDF Shiki code highlighting", () => {
  test("transforms required Pandoc fixture HTML with stable code hooks", async () => {
    await withPandocFixtureDir("code-highlight-pandoc", async (_fixtureDir, runPandoc) => {
      const cases = [
        {
          fileName: "code-basic.md",
          options: CODE_OPTIONS,
          expectedHighlighted: 1,
          expectedPlain: 0,
          expectedTheme: "github-light",
        },
        {
          fileName: "code-plain-and-unsupported.md",
          options: CODE_OPTIONS,
          expectedHighlighted: 0,
          expectedPlain: 2,
          expectedTheme: undefined,
        },
        {
          fileName: "code-wrapping.md",
          options: { ...CODE_OPTIONS, theme: "light-plus" as const },
          expectedHighlighted: 1,
          expectedPlain: 0,
          expectedTheme: "light-plus",
        },
        {
          fileName: "code-mixed-content.md",
          options: CODE_OPTIONS,
          expectedHighlighted: 2,
          expectedPlain: 0,
          expectedTheme: "github-light",
          expectedContent: ["Intro paragraph before code.", "<table>"],
        },
        {
          fileName: "code-line-numbers.md",
          options: { ...CODE_OPTIONS, lineNumbers: true },
          expectedHighlighted: 1,
          expectedPlain: 0,
          expectedTheme: "github-light",
          expectedLineNumbers: 4,
        },
        {
          fileName: "code-transformer-highlight-line.md",
          options: { ...CODE_OPTIONS, transformerNotation: true },
          expectedHighlighted: 1,
          expectedPlain: 0,
          expectedTheme: "github-light",
          expectedClasses: [MARKDOWN_PDF_CODE_CLASSES.lineHighlighted],
          rejectedContent: ["[!code", "has-highlighted", "has-diff"],
        },
        {
          fileName: "code-transformer-diff.md",
          options: { ...CODE_OPTIONS, transformerNotation: true },
          expectedHighlighted: 1,
          expectedPlain: 0,
          expectedTheme: "github-light",
          expectedClasses: [
            MARKDOWN_PDF_CODE_CLASSES.lineInserted,
            MARKDOWN_PDF_CODE_CLASSES.lineDeleted,
          ],
          rejectedContent: ["[!code", "has-highlighted", "has-diff"],
        },
        {
          fileName: "code-transformer-focus.md",
          options: { ...CODE_OPTIONS, transformerNotation: true },
          expectedHighlighted: 1,
          expectedPlain: 0,
          expectedTheme: "github-light",
          expectedClasses: [MARKDOWN_PDF_CODE_CLASSES.lineFocused],
          expectedClassCounts: [{ className: MARKDOWN_PDF_CODE_CLASSES.lineFocused, count: 3 }],
          expectedLineTextStates: [
            { text: "focused = true", className: MARKDOWN_PDF_CODE_CLASSES.lineFocused },
            { text: "alsoFocused = true", className: MARKDOWN_PDF_CODE_CLASSES.lineFocused },
            { text: "focusedByRange = true", className: MARKDOWN_PDF_CODE_CLASSES.lineFocused },
          ],
          rejectedLineTextStates: [
            { text: "normal = true", className: MARKDOWN_PDF_CODE_CLASSES.lineFocused },
          ],
          rejectedContent: ["[!code", "has-focused"],
        },
        {
          fileName: "code-transformer-error-warning.md",
          options: { ...CODE_OPTIONS, transformerNotation: true },
          expectedHighlighted: 1,
          expectedPlain: 0,
          expectedTheme: "github-light",
          expectedClasses: [
            MARKDOWN_PDF_CODE_CLASSES.lineError,
            MARKDOWN_PDF_CODE_CLASSES.lineWarning,
          ],
          expectedClassCounts: [
            { className: MARKDOWN_PDF_CODE_CLASSES.lineError, count: 3 },
            { className: MARKDOWN_PDF_CODE_CLASSES.lineWarning, count: 3 },
          ],
          expectedLineTextStates: [
            { text: "failed = false", className: MARKDOWN_PDF_CODE_CLASSES.lineError },
            { text: "errorRange = false", className: MARKDOWN_PDF_CODE_CLASSES.lineError },
            { text: "stillError = false", className: MARKDOWN_PDF_CODE_CLASSES.lineError },
            { text: "maybe = true", className: MARKDOWN_PDF_CODE_CLASSES.lineWarning },
            { text: "warningRange = true", className: MARKDOWN_PDF_CODE_CLASSES.lineWarning },
            { text: "stillWarning = true", className: MARKDOWN_PDF_CODE_CLASSES.lineWarning },
          ],
          rejectedLineTextStates: [
            { text: "valid = true", className: MARKDOWN_PDF_CODE_CLASSES.lineError },
            { text: "valid = true", className: MARKDOWN_PDF_CODE_CLASSES.lineWarning },
          ],
          rejectedContent: ["[!code", "has-error-level"],
        },
        {
          fileName: "code-transformer-line-numbers-combined.md",
          options: { ...CODE_OPTIONS, lineNumbers: true, transformerNotation: true },
          expectedHighlighted: 1,
          expectedPlain: 0,
          expectedTheme: "github-light",
          expectedLineNumbers: 6,
          expectedClasses: [
            MARKDOWN_PDF_CODE_CLASSES.lineHighlighted,
            MARKDOWN_PDF_CODE_CLASSES.lineInserted,
            MARKDOWN_PDF_CODE_CLASSES.lineDeleted,
            MARKDOWN_PDF_CODE_CLASSES.lineFocused,
            MARKDOWN_PDF_CODE_CLASSES.lineError,
            MARKDOWN_PDF_CODE_CLASSES.lineWarning,
          ],
          expectedClassCounts: [
            { className: MARKDOWN_PDF_CODE_CLASSES.lineHighlighted, count: 1 },
            { className: MARKDOWN_PDF_CODE_CLASSES.lineDeleted, count: 1 },
            { className: MARKDOWN_PDF_CODE_CLASSES.lineInserted, count: 1 },
            { className: MARKDOWN_PDF_CODE_CLASSES.lineFocused, count: 1 },
            { className: MARKDOWN_PDF_CODE_CLASSES.lineError, count: 1 },
            { className: MARKDOWN_PDF_CODE_CLASSES.lineWarning, count: 1 },
          ],
          expectedNumberedLineStates: [
            { lineNumber: 1, className: MARKDOWN_PDF_CODE_CLASSES.lineHighlighted },
            { lineNumber: 2, className: MARKDOWN_PDF_CODE_CLASSES.lineDeleted },
            { lineNumber: 3, className: MARKDOWN_PDF_CODE_CLASSES.lineInserted },
            { lineNumber: 4, className: MARKDOWN_PDF_CODE_CLASSES.lineFocused },
            { lineNumber: 5, className: MARKDOWN_PDF_CODE_CLASSES.lineError },
            { lineNumber: 6, className: MARKDOWN_PDF_CODE_CLASSES.lineWarning },
          ],
          rejectedContent: ["[!code", "has-highlighted", "has-diff", "has-focused"],
        },
      ];

      for (const fixtureCase of cases) {
        const result = await highlightMarkdownPdfCodeBlocks(
          await pandocHtmlFixture(runPandoc, fixtureCase.fileName),
          fixtureCase.options,
        );

        expect(
          result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock, "g")) ?? [],
        ).toHaveLength(fixtureCase.expectedHighlighted);
        expect(
          result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.plainBlock, "g")) ?? [],
        ).toHaveLength(fixtureCase.expectedPlain);
        if (fixtureCase.expectedTheme) {
          expect(result).toContain(fixtureCase.expectedTheme);
        }
        for (const expectedContent of fixtureCase.expectedContent ?? []) {
          expect(result).toContain(expectedContent);
        }
        for (const expectedClass of fixtureCase.expectedClasses ?? []) {
          expect(result).toContain(expectedClass);
        }
        for (const expectedClassCount of fixtureCase.expectedClassCounts ?? []) {
          expect(countClass(result, expectedClassCount.className)).toBe(expectedClassCount.count);
        }
        for (const expectedLineState of fixtureCase.expectedLineTextStates ?? []) {
          expectLineTextState(result, expectedLineState.text, expectedLineState.className);
        }
        for (const rejectedLineState of fixtureCase.rejectedLineTextStates ?? []) {
          expectLineTextWithoutState(result, rejectedLineState.text, rejectedLineState.className);
        }
        for (const rejectedContent of fixtureCase.rejectedContent ?? []) {
          expect(result).not.toContain(rejectedContent);
        }
        if (fixtureCase.expectedLineNumbers) {
          expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.numberedBlock);
          expect(
            result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineNumber, "g")) ?? [],
          ).toHaveLength(fixtureCase.expectedLineNumbers);
          expect(result).toContain(`data-line="${fixtureCase.expectedLineNumbers}"`);
          expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineContent);
        }
        for (const expectedLineState of fixtureCase.expectedNumberedLineStates ?? []) {
          expectNumberedLineState(
            result,
            expectedLineState.lineNumber,
            expectedLineState.className,
          );
        }
      }
    });
  }, 90_000);

  test("keeps transformer markers inert in Pandoc fixture HTML when disabled", async () => {
    await withPandocFixtureDir("code-highlight-pandoc-inert", async (_fixtureDir, runPandoc) => {
      const result = await highlightMarkdownPdfCodeBlocks(
        await pandocHtmlFixture(runPandoc, "code-transformer-line-numbers-combined.md"),
        CODE_OPTIONS,
      );

      expect(result).toContain("[!code highlight]");
      expect(result).toContain("[!code --]");
      expect(result).toContain("[!code ++]");
      expect(result).toContain("[!code focus]");
      expect(result).toContain("[!code error]");
      expect(result).toContain("[!code warning]");
      expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineHighlighted);
      expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineDeleted);
      expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineInserted);
      expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineFocused);
      expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineError);
      expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineWarning);
    });
  }, 20_000);
});
