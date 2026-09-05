import { describe, expect, test } from "bun:test";

import {
  createMarkdownPdfTemplate,
  inspectMarkdownPdfTemplateBody,
} from "../../../src/cli/markdown-pdf";

describe("markdown PDF template body contract", () => {
  test("proves the built-in template body boundary", () => {
    const template = createMarkdownPdfTemplate();

    expect(template).toContain('<main class="document-body">');
    expect(inspectMarkdownPdfTemplateBody(template)).toEqual({
      status: "proven",
      hookCount: 1,
      insertionCount: 1,
    });
  });

  test("accepts document-body as an exact class token", () => {
    expect(
      inspectMarkdownPdfTemplateBody(
        '<main class="layout document-body printable"><section>$body$</section></main>',
      ),
    ).toEqual({ status: "proven", hookCount: 1, insertionCount: 1 });
  });

  test("rejects a missing document-body hook", () => {
    expect(inspectMarkdownPdfTemplateBody("<main>$body$</main>")).toEqual({
      status: "missing-hook",
      hookCount: 0,
      insertionCount: 1,
    });
  });

  test("rejects substring class matches", () => {
    expect(inspectMarkdownPdfTemplateBody('<main class="not-document-body">$body$</main>')).toEqual(
      { status: "missing-hook", hookCount: 0, insertionCount: 1 },
    );
  });

  test("rejects duplicate document-body hooks", () => {
    expect(
      inspectMarkdownPdfTemplateBody(
        '<main class="document-body">$body$</main><aside class="document-body"></aside>',
      ),
    ).toEqual({ status: "duplicate-hook", hookCount: 2, insertionCount: 1 });
  });

  test("rejects a missing body insertion point", () => {
    expect(inspectMarkdownPdfTemplateBody('<main class="document-body"></main>')).toEqual({
      status: "missing-insertion",
      hookCount: 1,
      insertionCount: 0,
    });
  });

  test("rejects duplicate body insertion points", () => {
    expect(
      inspectMarkdownPdfTemplateBody('<main class="document-body">$body$$body$</main>'),
    ).toEqual({ status: "duplicate-insertion", hookCount: 1, insertionCount: 2 });
  });

  test("rejects a body insertion point outside the hook", () => {
    expect(
      inspectMarkdownPdfTemplateBody(
        '<main class="document-body"></main><section>$body$</section>',
      ),
    ).toEqual({ status: "unrelated-insertion", hookCount: 1, insertionCount: 1 });
  });

  test("does not count comment-only matches", () => {
    expect(
      inspectMarkdownPdfTemplateBody(
        '<main class="document-body"><!-- Pandoc inserts $body$ here --></main>',
      ),
    ).toEqual({ status: "missing-insertion", hookCount: 1, insertionCount: 0 });
  });

  test("does not count attribute-only matches", () => {
    expect(
      inspectMarkdownPdfTemplateBody('<main class="document-body" data-slot="$body$"></main>'),
    ).toEqual({ status: "missing-insertion", hookCount: 1, insertionCount: 0 });
  });

  test.each([
    "iframe",
    "noembed",
    "noframes",
    "noscript",
    "plaintext",
    "script",
    "style",
    "textarea",
    "title",
    "xmp",
  ])("does not count a body token in the inert %s text container", (tagName) => {
    const result = inspectMarkdownPdfTemplateBody(
      `<main class="document-body"><${tagName}>$body$</${tagName}></main>`,
    );

    expect(result).toEqual({ status: "missing-insertion", hookCount: 1, insertionCount: 0 });
  });

  test("does not count an insertion in inert template content", () => {
    const result = inspectMarkdownPdfTemplateBody(
      '<main class="document-body"><template><p>$body$</p></template></main>',
    );

    expect(result).toEqual({ status: "missing-insertion", hookCount: 1, insertionCount: 0 });
  });
});
