import { describe, expect, test } from "bun:test";

import {
  MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES,
  resolveMdPdfTemplateCodexFamily,
} from "../../src/cli/markdown-pdf/template-codex";
import { createSynthesisSignals } from "./synthesis-fixtures";

describe("cli action modules: md pdf-template codex families", () => {
  test("defines required deterministic family hooks", () => {
    expect(MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES["document-layered"]).toMatchObject({
      id: "document-layered",
      requiresCoverImage: false,
      defaultCoverLayout: "none",
      defaultCoverTitlePlacement: "document-title",
    });
    expect(MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES["document-layered"].requiredHooks).toEqual(
      expect.arrayContaining(["$body$", "$if(toc)$", "$toc$", "#TOC", ".cdx-code-line"]),
    );

    expect(MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES["cover-media-layered"]).toMatchObject({
      id: "cover-media-layered",
      requiresCoverImage: true,
      defaultCoverLayout: "contained-media",
      defaultCoverTitlePlacement: "below-media",
    });
    expect(MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES["cover-media-layered"].requiredHooks).toEqual(
      expect.arrayContaining(["$body$", "$if(toc)$", "$toc$", "#TOC", ".pdf-cover-media"]),
    );
  });

  test("selects cover-media family only when a cover image signal is available", () => {
    expect(resolveMdPdfTemplateCodexFamily(createSynthesisSignals())).toBe("document-layered");
    expect(
      resolveMdPdfTemplateCodexFamily(
        createSynthesisSignals({
          coverImage: {
            orientationBucket: "landscape",
            fitPressure: "normal",
          },
        }),
      ),
    ).toBe("cover-media-layered");
  });
});
