import { describe, expect, test } from "bun:test";

import {
  MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT,
  synthesizeMdPdfTemplateCodex,
} from "../../src/cli/markdown-pdf/template-codex";
import { createSynthesisOutputPlan, createSynthesisSignals } from "./synthesis-fixtures";

function readCssDeclarationBlock(
  styleCss: string,
  selectorIndex: number,
): { declarations: Record<string, string>; endIndex: number } {
  const openBraceIndex = styleCss.indexOf("{", selectorIndex);
  expect(openBraceIndex).toBeGreaterThanOrEqual(0);
  let closeBraceIndex = -1;
  let quote: '"' | "'" | undefined;
  let parenDepth = 0;
  for (let index = openBraceIndex + 1; index < styleCss.length; index += 1) {
    const char = styleCss[index];
    const previous = styleCss[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (char === "}" && parenDepth === 0) {
      closeBraceIndex = index;
      break;
    }
  }
  expect(closeBraceIndex).toBeGreaterThan(openBraceIndex);
  return {
    declarations: parseCssDeclarations(styleCss.slice(openBraceIndex + 1, closeBraceIndex)),
    endIndex: closeBraceIndex,
  };
}

function parseCssDeclarations(block: string): Record<string, string> {
  const declarations: string[] = [];
  let declarationStart = 0;
  let quote: '"' | "'" | undefined;
  let parenDepth = 0;
  for (let index = 0; index < block.length; index += 1) {
    const char = block[index];
    const previous = block[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      parenDepth += 1;
      continue;
    }
    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (char === ";" && parenDepth === 0) {
      declarations.push(block.slice(declarationStart, index));
      declarationStart = index + 1;
    }
  }
  declarations.push(block.slice(declarationStart));
  return Object.fromEntries(
    declarations
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1).trim()];
      }),
  );
}

function cssDeclarationBlocksForSelector(
  styleCss: string,
  selector: string,
): Record<string, string>[] {
  const blocks: Record<string, string>[] = [];
  let searchIndex = 0;
  while (searchIndex < styleCss.length) {
    const selectorIndex = styleCss.indexOf(selector, searchIndex);
    if (selectorIndex < 0) {
      break;
    }
    const block = readCssDeclarationBlock(styleCss, selectorIndex);
    blocks.push(block.declarations);
    searchIndex = block.endIndex + 1;
  }
  expect(blocks.length).toBeGreaterThan(0);
  return blocks;
}

function cssDeclarationsForSelector(styleCss: string, selector: string): Record<string, string> {
  const [declarations] = cssDeclarationBlocksForSelector(styleCss, selector);
  expect(declarations).toBeDefined();
  return declarations!;
}

function expectTocPageBreakCss(
  styleCss: string,
  expected: { before?: "page"; after?: "page" },
): void {
  const tocBlocks = cssDeclarationBlocksForSelector(
    styleCss,
    MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.tocSelector,
  );
  expect(tocBlocks).toEqual(expect.arrayContaining([expect.objectContaining({ page: "toc" })]));
  const pageBreakBlock = tocBlocks.find(
    (block) => "break-before" in block || "break-after" in block,
  );
  if (!expected.before && !expected.after) {
    expect(pageBreakBlock).toBeUndefined();
    return;
  }
  expect(pageBreakBlock).toMatchObject({
    ...(expected.before ? { "break-before": expected.before } : {}),
    ...(expected.after ? { "break-after": expected.after } : {}),
  });
  if (!expected.before) {
    expect(pageBreakBlock).not.toHaveProperty("break-before");
  }
  if (!expected.after) {
    expect(pageBreakBlock).not.toHaveProperty("break-after");
  }
}

describe("cli action modules: md pdf-template codex template synthesis", () => {
  test("preserves Pandoc document hooks and Shiki-compatible code selectors", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "report", toc: true }),
    });

    expect(result.templateHtml).toContain("$body$");
    expect(result.templateHtml).toContain("$if(title)$");
    expect(result.templateHtml).toContain("$if(toc)$");
    expect(result.templateHtml).toContain(
      `<nav id="${MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocId}" role="doc-toc">`,
    );
    expect(result.templateHtml).toContain("$toc$");
    expect(result.templateHtml).toContain("family=document-layered");
    expect(result.styleCss).toContain("family=document-layered");
    expect(result.styleCss).toContain(MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.tocSelector);
    expect(result.styleCss).toContain(MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.codeLineSelector);
    expect(result.styleCss).toContain(".cdx-code-line-content");
  });

  test("omits cover media and ToC page-break CSS for plain document synthesis", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "article" }),
    });

    expect(result.templateFamily).toBe("document-layered");
    expect(result.slots.cover.enabled).toBe(false);
    expect(result.templateHtml).not.toContain("pdf-cover");
    expect(result.styleCss).not.toContain("@page cover");
    expect(result.styleCss).not.toContain(".pdf-cover-media");
    expect(result.styleCss).not.toContain("break-before: page;");
    expect(result.styleCss).not.toContain("break-after: page;");
  });

  test("maps contained cover media to page-relative CSS without source pixel sizing", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan({ includeCoverAsset: true }),
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "panoramic",
          fitPressure: "letterbox-risk",
          width: 4200,
          height: 1200,
        },
        signalMode: "cover-image-only",
      }),
    });

    expect(result.templateHtml).toContain('src="assets/cover.png"');
    expect(result.templateHtml).toContain('data-image-fit="contain"');
    expect(result.templateHtml).toContain('data-cover-layout="contained-media"');
    expect(result.templateHtml).toContain('data-title-placement="below-media"');
    expect(result.templateHtml).toContain('data-orientation="panoramic"');
    expect(result.templateHtml).toContain('data-fit-pressure="letterbox-risk"');
    expect(result.styleCss).toContain("object-fit: contain;");
    expect(result.styleCss).toContain("@page cover");
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover")).toMatchObject({
      "break-after": "page",
      "min-height": "100vh",
      page: "cover",
    });
    expect(
      cssDeclarationsForSelector(
        result.styleCss,
        MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.css.coverMediaSelector,
      ),
    ).toMatchObject({
      display: "flex",
      padding: "18mm",
    });
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__image")).toEqual({
      display: "block",
      height: "68vh",
      "max-height": "68vh",
      "max-width": "100%",
      "object-fit": "contain",
      "object-position": "center",
      width: "100%",
    });
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__caption")).toMatchObject({
      display: "flex",
      gap: "2mm",
      "margin-top": "8mm",
    });
    expect(result.styleCss).not.toMatch(
      /\b(?:width|height|max-height|max-width)\s*:\s*(?:4200|1200)(?:\b|[a-z%])/i,
    );
  });

  test("rejects cover-media synthesis when no cover asset is bound", () => {
    expect(() =>
      synthesizeMdPdfTemplateCodex({
        outputPlan: createSynthesisOutputPlan(),
        signals: createSynthesisSignals({
          coverImage: {
            orientationBucket: "landscape",
            fitPressure: "normal",
            width: 1800,
            height: 1200,
          },
          signalMode: "deterministic",
        }),
      }),
    ).toThrow(/template:cover-media-class/);
  });

  test("maps cover-fit cover media to page-relative CSS without source pixel sizing", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan({ includeCoverAsset: true }),
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "landscape",
          fitPressure: "normal",
          width: 1800,
          height: 1200,
        },
        signalMode: "deterministic",
      }),
    });

    expect(result.templateHtml).toContain('data-image-fit="cover"');
    expect(result.styleCss).toContain("object-fit: cover;");
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__image")).toEqual({
      display: "block",
      height: "76vh",
      "max-height": "76vh",
      "max-width": "100%",
      "object-fit": "cover",
      "object-position": "center",
      width: "100%",
    });
    expect(result.styleCss).not.toMatch(
      /\b(?:width|height|max-height|max-width)\s*:\s*(?:1800|1200)(?:\b|[a-z%])/i,
    );
  });

  test("maps unknown cover metadata to safe contained cover media", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan({ includeCoverAsset: true }),
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "unknown",
          fitPressure: "unknown",
        },
        signalMode: "cover-image-only",
      }),
    });

    expect(result.slots.cover).toMatchObject({
      enabled: true,
      imageFit: "contain",
      layout: "contained-media",
      orientationBucket: "unknown",
      fitPressure: "unknown",
    });
    expect(result.templateHtml).toContain('data-orientation="unknown"');
    expect(result.templateHtml).toContain('data-fit-pressure="unknown"');
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media__image")).toMatchObject({
      height: "68vh",
      "max-height": "68vh",
      "object-fit": "contain",
    });
  });

  test("maps ToC page-break options into CSS branches", () => {
    const reportAuto = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "report", toc: true }),
    });
    expectTocPageBreakCss(reportAuto.styleCss, { after: "page" });

    const articleAuto = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "article", toc: true }),
    });
    expectTocPageBreakCss(articleAuto.styleCss, {});

    const explicitBefore = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "before",
      }),
    });
    expectTocPageBreakCss(explicitBefore.styleCss, { before: "page" });

    const explicitAfter = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "after",
      }),
    });
    expectTocPageBreakCss(explicitAfter.styleCss, { after: "page" });

    const explicitBoth = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "both",
      }),
    });
    expectTocPageBreakCss(explicitBoth.styleCss, { before: "page", after: "page" });

    const explicitNone = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "none",
      }),
    });
    expectTocPageBreakCss(explicitNone.styleCss, {});

    const tocDisabledAfter = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: false,
        tocPageBreak: "after",
      }),
    });
    expectTocPageBreakCss(tocDisabledAfter.styleCss, {});
  });
});
