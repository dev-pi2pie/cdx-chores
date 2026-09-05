import { describe, expect, test } from "bun:test";

import { prepareMarkdownPdfProfileInit } from "../../../src/cli/markdown-pdf/profile/init-service";
import { normalizeMarkdownPdfOptions } from "../../../src/cli/markdown-pdf/validation";

describe("cli action modules: md to-pdf profile init", () => {
  test("accepts normalized code settings without changing omitted direct defaults", () => {
    const normalizedOptions = normalizeMarkdownPdfOptions();
    const directEquivalent = prepareMarkdownPdfProfileInit(normalizedOptions);
    const customized = prepareMarkdownPdfProfileInit(normalizedOptions, {
      code: {
        highlight: true,
        theme: "vitesse-light",
        lineNumbers: true,
        transformerNotation: true,
      },
    });

    expect(directEquivalent.profile.code).toEqual({
      highlight: false,
      theme: "github-light",
      lineNumbers: false,
      transformerNotation: false,
    });
    expect(customized.profile).toEqual({
      ...directEquivalent.profile,
      code: {
        highlight: true,
        theme: "vitesse-light",
        lineNumbers: true,
        transformerNotation: true,
      },
    });
  });

  test("copies only supported defined Profile fields from runtime input", () => {
    const normalizedOptions = normalizeMarkdownPdfOptions();
    const directEquivalent = prepareMarkdownPdfProfileInit(normalizedOptions);
    const runtimeInput = {
      code: undefined,
      header: undefined,
      footer: undefined,
      pageNumbers: {
        enabled: false,
        scope: "body",
        countFrom: "document",
        start: 0,
        increment: 1,
        position: "bottom-center",
        format: "{page}",
      },
      unexpected: "must not be copied",
    } as const;
    const prepared = prepareMarkdownPdfProfileInit(normalizedOptions, runtimeInput as never);

    expect(prepared.profile).toEqual({
      ...directEquivalent.profile,
      pageNumbers: runtimeInput.pageNumbers,
    });
    expect(prepared.profile).not.toHaveProperty("unexpected");
    expect(prepared.profile.pageNumbers).not.toBe(runtimeInput.pageNumbers);
  });
});
