import { describe, expect, test } from "bun:test";

import { synthesizeMdPdfTemplateCodex } from "../../src/cli/markdown-pdf/template-codex";
import { createSynthesisOutputPlan, createSynthesisSignals } from "./synthesis-fixtures";

function cssDeclarationsForSelector(styleCss: string, selector: string): Record<string, string> {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector} \\{[\\s\\S]*?\\n\\}`).exec(styleCss);
  expect(match).not.toBeNull();
  return Object.fromEntries(
    (match?.[0] ?? "")
      .split("\n")
      .slice(1, -1)
      .map((line) => line.trim().replace(/;$/, ""))
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1).trim()];
      }),
  );
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
    expect(result.templateHtml).toContain('<nav id="TOC" role="doc-toc">');
    expect(result.templateHtml).toContain("$toc$");
    expect(result.templateHtml).toContain("family=document-layered");
    expect(result.styleCss).toContain("family=document-layered");
    expect(result.styleCss).toContain("#TOC");
    expect(result.styleCss).toContain(".cdx-code-line");
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
    expect(cssDeclarationsForSelector(result.styleCss, ".pdf-cover-media")).toMatchObject({
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

  test("maps ToC page-break options into CSS branches", () => {
    const reportAuto = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ preset: "report", toc: true }),
    });
    expect(reportAuto.styleCss).toContain("break-after: page;");
    expect(reportAuto.styleCss).not.toContain("break-before: page;");

    const explicitBefore = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "before",
      }),
    });
    expect(explicitBefore.styleCss).toContain("break-before: page;");
    expect(explicitBefore.styleCss).not.toContain("break-after: page;");

    const explicitBoth = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "both",
      }),
    });
    expect(explicitBoth.styleCss).toContain("break-before: page;");
    expect(explicitBoth.styleCss).toContain("break-after: page;");

    const explicitNone = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        preset: "article",
        toc: true,
        tocPageBreak: "none",
      }),
    });
    expect(explicitNone.styleCss).not.toContain("break-before: page;");
    expect(explicitNone.styleCss).not.toContain("break-after: page;");
  });
});
