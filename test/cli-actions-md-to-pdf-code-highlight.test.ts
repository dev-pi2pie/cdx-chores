import { describe, expect, test } from "bun:test";

import { highlightMarkdownPdfCodeBlocks } from "../src/cli/markdown-pdf/code-highlight";
import type { EffectiveMarkdownPdfCodeOptions } from "../src/cli/markdown-pdf";

const CODE_OPTIONS: EffectiveMarkdownPdfCodeOptions = {
  highlight: true,
  theme: "github-light",
  lineNumbers: false,
};

describe("markdown PDF Shiki code highlighting", () => {
  test("highlights supported language fences and adds stable hook classes", async () => {
    const html = [
      "<!DOCTYPE html>",
      '<html><body><pre id="sample"><code class="language-js">const x = 1;</code></pre></body></html>',
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain('id="sample"');
    expect(result).toContain("cdx-code");
    expect(result).toContain("cdx-code--highlighted");
    expect(result).toContain("cdx-code__content");
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

  test("marks no-language and unsupported-language blocks as plain", async () => {
    const html = [
      "<html><body>",
      "<pre><code>plain text</code></pre>",
      '<pre><code class="language-not-real">x</code></pre>',
      "</body></html>",
    ].join("");

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result.match(/cdx-code--plain/g)).toHaveLength(2);
    expect(result).toContain("plain text");
    expect(result).toContain("language-not-real");
    expect(result).not.toContain("cdx-code--highlighted");
  });

  test("normalizes Pandoc sourceCode aliases before highlighting", async () => {
    const html =
      '<html><body><pre class="sourceCode bash"><code class="sourceCode bash">echo ok</code></pre></body></html>';

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain("cdx-code--highlighted");
    expect(result).toContain("shiki");
    expect(result).toContain("echo");
  });

  test("finds supported Pandoc sourceCode language after extra classes", async () => {
    const html =
      '<html><body><pre class="sourceCode numberLines javascript"><code class="sourceCode numberLines javascript">const x = 1;</code></pre></body></html>';

    const result = await highlightMarkdownPdfCodeBlocks(html, CODE_OPTIONS);

    expect(result).toContain("cdx-code--highlighted");
    expect(result).toContain("shiki");
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
    expect(result.match(/cdx-code--highlighted/g)).toHaveLength(2);
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
