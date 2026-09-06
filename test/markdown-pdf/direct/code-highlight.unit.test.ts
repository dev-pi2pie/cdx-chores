import { describe, expect, test } from "bun:test";

import { MARKDOWN_PDF_CODE_CLASSES } from "../../../src/cli/markdown-pdf/code-style";
import { highlightMarkdownPdfCodeBlocks } from "../../../src/cli/markdown-pdf/code-highlight";
import type { EffectiveMarkdownPdfCodeOptions } from "../../../src/cli/markdown-pdf/profile/types";

const CODE_OPTIONS: EffectiveMarkdownPdfCodeOptions = {
  highlight: true,
  theme: "github-light",
  lineNumbers: false,
  transformerNotation: false,
};

describe("markdown PDF Shiki code highlighting", () => {
  test("highlights supported language fences and adds stable hook classes", async () => {
    const html = [
      "<!DOCTYPE html>",
      '<html><body><pre id="sample"><code class="language-js">const x = 1;</code></pre></body></html>',
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain('id="sample"');
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.block);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.content);
    expect(result).toContain("shiki");
    expect(result).toContain("github-light");
  });

  test("strips code font-family styles from highlighted output", async () => {
    const html =
      '<html><body><pre style="font-family: Source Code Pro; background: #fff"><code class="language-js">const x = 1;</code></pre></body></html>';

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain("background-color");
    expect(result).not.toContain("font-family");
  });

  test("marks no-language and non-bundled-language blocks as plain", async () => {
    const html = [
      "<html><body>",
      "<pre><code>plain text</code></pre>",
      '<pre><code class="language-not-real">x</code></pre>',
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.plainBlock, "g"))).toHaveLength(2);
    expect(result).toContain("plain text");
    expect(result).toContain("language-not-real");
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock);
  });

  test("normalizes Pandoc sourceCode aliases before highlighting", async () => {
    const html =
      '<html><body><pre class="sourceCode bash"><code class="sourceCode bash">echo ok</code></pre></body></html>';

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock);
    expect(result).toContain("shiki");
    expect(result).toContain("echo");
  });

  test("finds supported Pandoc sourceCode language after extra classes", async () => {
    const html =
      '<html><body><pre class="sourceCode numberLines javascript"><code class="sourceCode numberLines javascript">const x = 1;</code></pre></body></html>';

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock);
    expect(result).toContain("shiki");
  });

  test("highlights bundled Shiki languages beyond the smoke fixture set", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-json">{"ok":true}</code></pre>',
      '<pre><code class="language-rust">let ok = true;</code></pre>',
      '<pre><code class="language-c++">auto ok = true;</code></pre>',
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(
      result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock, "g")) ?? [],
    ).toHaveLength(3);
    expect(result).toContain("shiki");
    expect(result).toContain("ok");
  });

  test("generates profile-controlled line number markup for highlighted blocks", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-py">print("one")\nprint("two")</code></pre>',
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      lineNumbers: true,
    });

    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.numberedBlock);
    expect(result.match(/class="line cdx-code-line"/g)).toHaveLength(2);
    expect(result).toContain('class="cdx-code-line-number" aria-hidden="true">1</span>');
    expect(result).toContain('class="cdx-code-line-number" aria-hidden="true">2</span>');
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineContent);
    expect(result).toContain('data-line="1"');
    expect(result).toContain('data-line="2"');
    expect(result).not.toContain("</span>\n<span");
  });

  test("keeps plain blocks unnumbered when line numbers are enabled", async () => {
    const html = [
      "<html><body>",
      "<pre><code>plain text</code></pre>",
      '<pre><code class="language-not-real">x</code></pre>',
      '<pre><code class="language-js">const x = 1;</code></pre>',
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      lineNumbers: true,
    });

    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.plainBlock, "g"))).toHaveLength(2);
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.numberedBlock, "g"))).toHaveLength(1);
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineNumber, "g"))).toHaveLength(1);
  });

  test("applies opt-in transformer notation classes and removes marker comments", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-js">',
      "const kept = true; // [!code highlight]\n",
      "const added = true; // [!code ++]\n",
      "const removed = false; // [!code --]\n",
      "const focused = true; // [!code focus]\n",
      "const failed = false; // [!code error]\n",
      "const maybe = true; // [!code warning]",
      "</code></pre>",
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      transformerNotation: true,
    });

    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineHighlighted);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineInserted);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineDeleted);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineFocused);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineError);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineWarning);
    expect(result).not.toContain("[!code");
    expect(result).not.toContain("has-highlighted");
    expect(result).not.toContain("has-diff");
    expect(result).not.toContain("has-focused");
    expect(result).not.toContain("has-error");
    expect(result).toContain("kept");
    expect(result).toContain("added");
    expect(result).toContain("removed");
    expect(result).toContain("focused");
    expect(result).toContain("failed");
    expect(result).toContain("maybe");
  });

  test("applies opt-in transformer notation ranges", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-js">',
      "const highlightedOne = true; // [!code highlight:2]\n",
      "const highlightedTwo = true;\n",
      "const insertedOne = true; // [!code ++:2]\n",
      "const insertedTwo = true;\n",
      "const deletedOne = false; // [!code --:2]\n",
      "const deletedTwo = false;\n",
      "const focusedOne = true; // [!code focus:2]\n",
      "const focusedTwo = true;\n",
      "const errorOne = false; // [!code error:2]\n",
      "const errorTwo = false;\n",
      "const warningOne = true; // [!code warning:2]\n",
      "const warningTwo = true;",
      "</code></pre>",
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      transformerNotation: true,
    });

    expect(
      result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineHighlighted, "g")) ?? [],
    ).toHaveLength(2);
    expect(
      result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineInserted, "g")) ?? [],
    ).toHaveLength(2);
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineDeleted, "g")) ?? []).toHaveLength(
      2,
    );
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineFocused, "g")) ?? []).toHaveLength(
      2,
    );
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineError, "g")) ?? []).toHaveLength(
      2,
    );
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineWarning, "g")) ?? []).toHaveLength(
      2,
    );
    expect(result).not.toContain("[!code");
  });

  test("leaves transformer notation markers inert when the feature is disabled", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-js">',
      "const kept = true; // [!code highlight]\n",
      "const added = true; // [!code ++]\n",
      "const removed = false; // [!code --]\n",
      "const focused = true; // [!code focus]\n",
      "const failed = false; // [!code error]\n",
      "const maybe = true; // [!code warning]",
      "</code></pre>",
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain("[!code highlight]");
    expect(result).toContain("[!code ++]");
    expect(result).toContain("[!code --]");
    expect(result).toContain("[!code focus]");
    expect(result).toContain("[!code error]");
    expect(result).toContain("[!code warning]");
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineHighlighted);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineInserted);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineDeleted);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineFocused);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineError);
    expect(result).not.toContain(MARKDOWN_PDF_CODE_CLASSES.lineWarning);
  });

  test("combines transformer notation with line number markup", async () => {
    const html = [
      "<html><body>",
      '<pre><code class="language-js">',
      "const kept = true; // [!code highlight]\n",
      "const added = true; // [!code ++]\n",
      "const focused = true; // [!code focus]\n",
      "const failed = false; // [!code error]\n",
      "const maybe = true; // [!code warning]",
      "</code></pre>",
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      lineNumbers: true,
      transformerNotation: true,
    });

    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.numberedBlock);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineHighlighted);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineInserted);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineFocused);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineError);
    expect(result).toContain(MARKDOWN_PDF_CODE_CLASSES.lineWarning);
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.lineNumber, "g"))).toHaveLength(5);
    expect(result).not.toContain("[!code");
  });

  test("preserves surrounding content while replacing multiple code blocks", async () => {
    const html = [
      "<html><body>",
      "<h1>Before</h1>",
      '<pre><code class="language-js">const x = 1;</code></pre>',
      "<p>Between</p>",
      '<pre><code class="language-yaml">enabled: true</code></pre>',
      "<footer>After</footer>",
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain("<h1>Before</h1>");
    expect(result).toContain("<p>Between</p>");
    expect(result).toContain("<footer>After</footer>");
    expect(result.match(new RegExp(MARKDOWN_PDF_CODE_CLASSES.highlightedBlock, "g"))).toHaveLength(
      2,
    );
  });

  test("returns original HTML when highlighting is disabled", async () => {
    const html =
      '<html><body><pre><code class="language-js">const x = 1;</code></pre></body></html>';

    const result = await highlightMarkdownPdfCodeBlocks(html, {
      ...CODE_OPTIONS,
      highlight: false,
    });

    expect(result).toBe(html);
  });
});
