import { describe, expect, test } from "bun:test";

import { synthesizeMdPdfTemplateCodex } from "../../src/cli/markdown-pdf/template-codex";
import { createSynthesisOutputPlan, createSynthesisSignals } from "./synthesis-fixtures";

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
    expect(result.styleCss).toContain("object-fit: contain;");
    expect(result.styleCss).toContain("height: 68vh;");
    expect(result.styleCss).not.toContain("4200px");
    expect(result.styleCss).not.toContain("1200px");
    expect(result.styleCss).not.toContain("width: 4200");
    expect(result.styleCss).not.toContain("height: 1200");
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
    expect(result.styleCss).toContain("height: 76vh;");
    expect(result.styleCss).not.toContain("1800px");
    expect(result.styleCss).not.toContain("1200px");
    expect(result.styleCss).not.toContain("width: 1800");
    expect(result.styleCss).not.toContain("height: 1200");
  });
});
