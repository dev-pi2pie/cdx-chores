import { describe, expect, test } from "bun:test";

import { promptTextWithGhost } from "../../../src/cli/prompts/text-inline";
import { FakePromptWriteStream } from "./prompt-fixtures";

describe("text inline prompt controller", () => {
  test("promptTextWithGhost falls back to simple input when advanced prompt fails", async () => {
    const calls: string[] = [];
    const stdout = new FakePromptWriteStream();
    const result = await promptTextWithGhost({
      message: "Template",
      helpLines: ["Custom filename template"],
      ghostHintLabel: "Template suggestion (Right arrow to accept)",
      ghostText: "{timestamp}-{stem}",
      runtimeConfig: {
        mode: "auto",
        autocomplete: {
          enabled: true,
          minChars: 1,
          maxSuggestions: 12,
          includeHidden: false,
        },
      },
      stdin: { isTTY: true } as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.trim().length > 0 ? true : "Required"),
      promptImpls: {
        advancedInline: async () => {
          throw new Error("boom");
        },
        simpleInput: async (options) => {
          calls.push(String(options.message));
          return "{date}-{stem}";
        },
      },
    });

    expect(result).toBe("{date}-{stem}");
    expect(calls).toEqual(["Template"]);
    expect(stdout.text).toContain("Custom filename template\n");
    expect(stdout.text).toContain(
      "Template suggestion (Right arrow to accept): {timestamp}-{stem}",
    );
  });

  test("promptTextWithGhost preserves the revision value when advanced input falls back", async () => {
    let advancedCalls = 0;
    let receivedDefault: unknown;
    const stdout = new FakePromptWriteStream();
    const result = await promptTextWithGhost({
      message: "Page-number label",
      ghostHintLabel: "Page-number label suggestion",
      ghostText: "Page {page} of {pages}",
      initialValue: "Page {page}",
      completionKind: "markdown-pdf-page-label",
      runtimeConfig: {
        mode: "auto",
        autocomplete: {
          enabled: true,
          minChars: 1,
          maxSuggestions: 12,
          includeHidden: false,
        },
      },
      stdin: { isTTY: true } as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.includes("{page}") ? true : "Include {page}"),
      promptImpls: {
        advancedInline: async () => {
          advancedCalls += 1;
          throw new Error("boom");
        },
        simpleInput: async (options) => {
          receivedDefault = options.default;
          return String(options.default);
        },
      },
    });

    expect(advancedCalls).toBe(1);
    expect(receivedDefault).toBe("Page {page}");
    expect(result).toBe("Page {page}");
  });

  test("promptTextWithGhost passes the initial value to simple input as its default", async () => {
    let receivedDefault: unknown;
    const stdout = new FakePromptWriteStream();
    const result = await promptTextWithGhost({
      message: "Page-number label",
      helpLines: [
        "{page}: current logical page number",
        "{pages}: final logical page number in the selected countFrom domain",
        "{pdfPage}: current physical PDF page",
        "{pdfPages}: total physical PDF pages",
      ],
      ghostHintLabel: "Page-number label suggestion",
      ghostText: "Page {page} of {pages}",
      initialValue: "Page {page}",
      completionKind: "markdown-pdf-page-label",
      runtimeConfig: {
        mode: "simple",
        autocomplete: {
          enabled: true,
          minChars: 1,
          maxSuggestions: 12,
          includeHidden: false,
        },
      },
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.includes("{page}") ? true : "Include {page}"),
      promptImpls: {
        simpleInput: async (options) => {
          receivedDefault = options.default;
          return String(options.default);
        },
      },
    });

    expect(result).toBe("Page {page}");
    expect(receivedDefault).toBe("Page {page}");
    expect(stdout.text).toContain("{page}: current logical page number");
    expect(stdout.text).toContain(
      "{pages}: final logical page number in the selected countFrom domain",
    );
    expect(stdout.text).toContain("{pdfPage}: current physical PDF page");
    expect(stdout.text).toContain("{pdfPages}: total physical PDF pages");
    expect(stdout.text).not.toContain("Page-number label suggestion");
  });

  test("promptTextWithGhost prints the fresh Markdown PDF suggestion in simple mode", async () => {
    const stdout = new FakePromptWriteStream();
    const result = await promptTextWithGhost({
      message: "Page-number label",
      helpLines: [
        "{page}: current logical page number",
        "{pages}: final logical page number in the selected countFrom domain",
        "{pdfPage}: current physical PDF page",
        "{pdfPages}: total physical PDF pages",
      ],
      ghostHintLabel: "Page-number label suggestion",
      ghostText: "Page {page} of {pages}",
      completionKind: "markdown-pdf-page-label",
      runtimeConfig: {
        mode: "simple",
        autocomplete: {
          enabled: true,
          minChars: 1,
          maxSuggestions: 12,
          includeHidden: false,
        },
      },
      stdout: stdout as unknown as NodeJS.WritableStream,
      validate: (value) => (value.includes("{page}") ? true : "Include {page}"),
      promptImpls: {
        simpleInput: async (options) => {
          expect(options.default).toBeUndefined();
          return "Page {page}";
        },
      },
    });

    expect(result).toBe("Page {page}");
    expect(stdout.text).toContain("{page}: current logical page number");
    expect(stdout.text).toContain(
      "{pages}: final logical page number in the selected countFrom domain",
    );
    expect(stdout.text).toContain("{pdfPage}: current physical PDF page");
    expect(stdout.text).toContain("{pdfPages}: total physical PDF pages");
    expect(stdout.text).toContain("Page-number label suggestion: Page {page} of {pages}");
  });
});
