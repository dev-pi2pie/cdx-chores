import { describe, expect, test } from "bun:test";

import {
  assessMarkdownPdfTemplateCompatibility,
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
} from "../../../../src/cli/markdown-pdf";

describe("Markdown PDF selected-template compatibility", () => {
  test("does not require body proof for disabled numbering or document visibility", () => {
    expect(
      assessMarkdownPdfTemplateCompatibility({
        builtIn: false,
        profile: DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
        templateHtml: "<main>$body$</main>",
      }),
    ).toEqual({ bodyBoundary: "not-required" });

    expect(
      assessMarkdownPdfTemplateCompatibility({
        builtIn: false,
        profile: {
          ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
          pageNumbers: {
            ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
            enabled: true,
            scope: "document",
          },
        },
        templateHtml: "<main>$body$</main>",
      }),
    ).toEqual({ bodyBoundary: "not-required" });
  });

  test("rejects a managed Template that promises but violates the hook contract", () => {
    expect(() =>
      assessMarkdownPdfTemplateCompatibility({
        builtIn: false,
        profile: {
          ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
          pageNumbers: {
            ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
            enabled: true,
          },
        },
        templateHtml: [
          '<meta name="generator" content="cdx-chores md pdf-template codex">',
          "<main>$body$</main>",
        ].join("\n"),
      }),
    ).toThrow("selected managed Markdown PDF template requires exactly one .document-body");
  });

  test("does not treat generator marker text in ordinary content as a managed Template", () => {
    expect(
      assessMarkdownPdfTemplateCompatibility({
        builtIn: false,
        profile: {
          ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
          pageNumbers: {
            ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
            enabled: true,
          },
        },
        templateHtml: [
          '<p>&lt;meta name="generator" content="cdx-chores md pdf-template codex"&gt;</p>',
          "<main>$body$</main>",
        ].join("\n"),
      }),
    ).toMatchObject({ bodyBoundary: "legacy-document-origin-fallback" });
  });

  test("treats an actual Codex identity comment as a managed Template marker", () => {
    expect(() =>
      assessMarkdownPdfTemplateCompatibility({
        builtIn: false,
        profile: {
          ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
          pageNumbers: {
            ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.pageNumbers,
            enabled: true,
          },
        },
        templateHtml: [
          "<!-- cdx-chores md pdf-template codex | bundle=test | family=editorial-report -->",
          "<main>$body$</main>",
        ].join("\n"),
      }),
    ).toThrow("selected managed Markdown PDF template requires exactly one .document-body");
  });

  test("requires managed identity and exactly one live cover element", () => {
    const coverProfile = {
      ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
      cover: {
        ...DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.cover,
        enabled: true,
      },
    };
    const managedMarker =
      "<!-- cdx-chores md pdf-template codex | bundle=test | family=editorial-report -->";

    expect(
      assessMarkdownPdfTemplateCompatibility({
        builtIn: true,
        profile: coverProfile,
        templateHtml: '<section class="pdf-cover"></section><main>$body$</main>',
      }),
    ).toEqual({ bodyBoundary: "not-required", coverBoundary: "built-in" });

    expect(() =>
      assessMarkdownPdfTemplateCompatibility({
        builtIn: false,
        profile: coverProfile,
        templateHtml: '<section class="pdf-cover"></section><main>$body$</main>',
      }),
    ).toThrow("selected custom Template has no supported cover hook");

    for (const covers of [
      "",
      '<template><section class="pdf-cover"></section></template>',
      '<section class="pdf-cover"></section><section class="pdf-cover"></section>',
    ]) {
      expect(() =>
        assessMarkdownPdfTemplateCompatibility({
          builtIn: false,
          profile: coverProfile,
          templateHtml: `${managedMarker}${covers}<main>$body$</main>`,
        }),
      ).toThrow("requires exactly one live .pdf-cover element");
    }

    expect(
      assessMarkdownPdfTemplateCompatibility({
        builtIn: false,
        profile: coverProfile,
        templateHtml: `${managedMarker}<section class="pdf-cover"></section><main>$body$</main>`,
      }),
    ).toEqual({ bodyBoundary: "not-required", coverBoundary: "managed-proven" });
  });
});
