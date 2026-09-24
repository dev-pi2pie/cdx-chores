import { describe, expect, test } from "bun:test";

import {
  hasExplicitMarkdownPdfCodexPageInformation,
  MARKDOWN_PDF_CODEX_PAGE_TEXT_MAX_LENGTH,
  prepareMarkdownPdfCodexPageInformationSignal,
  type MarkdownPdfCodexPageInformationInput,
} from "../../../../src/cli/markdown-pdf/profile-codex";

describe("internal Markdown PDF Codex page-information signals", () => {
  test("keeps omission distinct from OFF and strips inactive drafts and conflict data", () => {
    expect(hasExplicitMarkdownPdfCodexPageInformation(undefined)).toBe(false);
    expect(hasExplicitMarkdownPdfCodexPageInformation({})).toBe(false);
    expect(prepareMarkdownPdfCodexPageInformationSignal({})).toBeUndefined();
    const input = {
      pageNumbers: {
        enabled: false,
        position: "bottom-center",
        format: "draft marker",
        scope: "body",
        countFrom: "body",
        start: 1,
        increment: 1,
      },
      repeatingContent: {
        enabled: false,
        selected: ["top-left"],
        text: { "top-left": "draft marker" },
      },
      occupiedNumberSlot: { position: "bottom-center", choice: "retain", inheritedText: "secret" },
    } as const;
    const signal = prepareMarkdownPdfCodexPageInformationSignal(input);
    expect(signal).toEqual({
      pageNumbers: { enabled: false },
      repeatingContent: { enabled: false },
    });
    expect(JSON.stringify(signal)).not.toContain("secret");
    expect(JSON.stringify(signal)).not.toContain("draft marker");
  });

  test("preserves exact active labels, placeholders, and selected slot text only", () => {
    const signal = prepareMarkdownPdfCodexPageInformationSignal({
      pageNumbers: {
        enabled: true,
        position: "bottom-right",
        format: "  Page {page} / {pages}  ",
        scope: "body",
        countFrom: "body",
        start: 1,
        increment: 1,
      },
      repeatingContent: {
        enabled: true,
        selected: ["top-left"],
        text: { "top-left": " Exact {page} ", "top-right": "unselected" },
      },
    });
    expect(signal?.pageNumbers).toMatchObject({ format: "  Page {page} / {pages}  " });
    expect(signal?.repeatingContent).toEqual({
      enabled: true,
      selected: ["top-left"],
      text: { "top-left": " Exact {page} " },
    });
  });

  test("rejects each over-limit active text field before preparation", () => {
    const boundary = "x".repeat(MARKDOWN_PDF_CODEX_PAGE_TEXT_MAX_LENGTH);
    expect(() =>
      prepareMarkdownPdfCodexPageInformationSignal({
        pageNumbers: {
          enabled: true,
          position: "bottom-center",
          format: boundary,
          scope: "body",
          countFrom: "body",
          start: 1,
          increment: 1,
        },
      }),
    ).not.toThrow();
    expect(() =>
      prepareMarkdownPdfCodexPageInformationSignal({
        pageNumbers: {
          enabled: true,
          position: "bottom-center",
          format: `${boundary}x`,
          scope: "body",
          countFrom: "body",
          start: 1,
          increment: 1,
        },
      }),
    ).toThrow("Page-number label exceeds");
    expect(() =>
      prepareMarkdownPdfCodexPageInformationSignal({
        repeatingContent: {
          enabled: true,
          selected: ["top-left"],
          text: { "top-left": `${boundary}x` },
        },
      }),
    ).toThrow("Repeating content at top-left exceeds");
    expect(() =>
      prepareMarkdownPdfCodexPageInformationSignal({
        repeatingContent: { enabled: true, selected: ["top-left"], text: {} },
      }),
    ).toThrow("Repeating content at top-left must not be empty");
  });

  test("rejects malformed guided ON numbering instead of forwarding it", () => {
    const valid: NonNullable<MarkdownPdfCodexPageInformationInput["pageNumbers"]> = {
      enabled: true,
      position: "bottom-center",
      format: "Page {page}",
      scope: "body",
      countFrom: "body",
      start: 1,
      increment: 1,
    };
    for (const invalid of [{ format: "   " }, { format: undefined as unknown as string }]) {
      expect(() =>
        prepareMarkdownPdfCodexPageInformationSignal({ pageNumbers: { ...valid, ...invalid } }),
      ).toThrow("Page-number label must not be empty");
    }
    for (const invalid of [
      { start: 0 },
      { increment: 2 },
      { scope: "body" as const, countFrom: "document" as const },
    ]) {
      expect(() =>
        prepareMarkdownPdfCodexPageInformationSignal({ pageNumbers: { ...valid, ...invalid } }),
      ).toThrow("Page-number settings must use one guided body/document outcome");
    }
  });
});
