import { describe, expect, test } from "bun:test";

import type { MarkdownPdfTemplateCodexDecision } from "../../../src/cli/markdown-pdf/template-codex/codex-decision";
import { MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT } from "../../../src/cli/markdown-pdf/template-codex/families";
import {
  synthesizeMdPdfTemplateCodex,
  synthesizeMdPdfTemplateCodexFromDecision,
} from "../../../src/cli/markdown-pdf/template-codex/synthesize";
import type { MdPdfTemplateCodexSignalCollection } from "../../../src/cli/markdown-pdf/template-codex/types";
import {
  createSynthesisOutputPlan,
  createSynthesisSignals,
} from "../../markdown-pdf/actions/template-synthesis-fixtures";

function createTemplateDecision(input: {
  cssBlocks?: MarkdownPdfTemplateCodexDecision["cssBlocks"];
  fontDecisions?: MarkdownPdfTemplateCodexDecision["fontDecisions"];
  signals: MdPdfTemplateCodexSignalCollection;
}): MarkdownPdfTemplateCodexDecision {
  const outputPlan = createSynthesisOutputPlan();
  const deterministic = synthesizeMdPdfTemplateCodex({
    outputPlan,
    signals: input.signals,
  });
  return {
    decisionMode: "adapted",
    templateFamily: "document-layered",
    recipePreset: "article",
    slots: deterministic.slots,
    cssBlocks: input.cssBlocks ?? [],
    fontDecisions: input.fontDecisions ?? [],
    managedAssets: [],
    warnings: [],
    unsupportedDirections: [],
  };
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

  test("keeps body-owned title ordering identical for deterministic and decision synthesis", () => {
    const outputPlan = createSynthesisOutputPlan();
    const signals = createSynthesisSignals({ toc: true });
    const deterministic = synthesizeMdPdfTemplateCodex({ outputPlan, signals });
    const adapted = synthesizeMdPdfTemplateCodexFromDecision({
      decision: createTemplateDecision({ signals }),
      outputPlan,
      signals,
    });

    for (const result of [deterministic, adapted]) {
      const tocIndex = result.templateHtml.indexOf(
        `<nav id="${MARKDOWN_PDF_TEMPLATE_CODEX_CONTRACT.html.tocId}" role="doc-toc">`,
      );
      const bodyIndex = result.templateHtml.indexOf('<main class="document-body">');
      const titleIndex = result.templateHtml.indexOf('<header class="document-title">');
      const bodyContentIndex = result.templateHtml.indexOf("$body$");

      expect(tocIndex).toBeGreaterThanOrEqual(0);
      expect(tocIndex).toBeLessThan(bodyIndex);
      expect(bodyIndex).toBeLessThan(titleIndex);
      expect(titleIndex).toBeLessThan(bodyContentIndex);
      expect(result.templateHtml.match(/<main class="document-body">/g)).toHaveLength(1);
    }
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

  test("suppresses duplicate metadata title blocks like profile auto title policy", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        titleSignals: {
          frontmatterTitle: { present: true, charCount: 14 },
          firstH1: { present: true, charCount: 14 },
          normalizedTitleMatch: true,
          duplicateVisibleTitleRisk: true,
        },
      }),
    });

    expect(result.titlePolicy).toMatchObject({
      metadataTitle: "suppress-duplicate",
      visibleMetadataTitle: false,
      duplicateVisibleTitleRisk: true,
    });
    expect(result.templateHtml).not.toContain('<header class="document-title">');
    expect(result.templateHtml).toContain(
      "<title>$if(title)$$title$$else$Markdown PDF$endif$</title>",
    );
    expect(result.templateHtml).toContain("$body$");
  });

  test("keeps metadata title blocks when there is no duplicate title risk", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({ toc: true }),
    });

    expect(result.titlePolicy).toMatchObject({
      metadataTitle: "show",
      visibleMetadataTitle: true,
    });
    expect(result.templateHtml).toContain('<header class="document-title">');
    expect(result.templateHtml).toContain('<h1 class="title">$title$</h1>');
    expect(result.templateHtml.indexOf('<nav id="TOC"')).toBeLessThan(
      result.templateHtml.indexOf('<header class="document-title">'),
    );
  });

  test("lets cover-title placement own the visible title block", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan({ includeCoverAsset: true }),
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "landscape",
          fitPressure: "normal",
        },
      }),
    });

    expect(result.titlePolicy).toMatchObject({
      metadataTitle: "suppress-cover-title",
      visibleMetadataTitle: false,
      coverTitleOwnsPlacement: true,
    });
    expect(result.templateHtml).toContain("pdf-cover-media__title");
    expect(result.templateHtml).not.toContain('<header class="document-title">');
  });

  test("preserves base-profile metadata title show ownership", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan({ includeCoverAsset: true }),
      signals: createSynthesisSignals({
        coverImage: {
          orientationBucket: "landscape",
          fitPressure: "normal",
        },
        toc: true,
        titleSignals: {
          frontmatterTitle: { present: true, charCount: 14 },
          firstH1: { present: true, charCount: 14 },
          normalizedTitleMatch: true,
          duplicateVisibleTitleRisk: true,
        },
        titlePolicySignals: { baseProfileMetadataTitle: "show" },
      }),
    });

    expect(result.titlePolicy).toMatchObject({
      metadataTitle: "show",
      visibleMetadataTitle: true,
    });
    expect(result.templateHtml).toContain('<header class="document-title">');
    const coverIndex = result.templateHtml.indexOf('<section class="pdf-cover');
    const tocIndex = result.templateHtml.indexOf('<nav id="TOC"');
    const bodyIndex = result.templateHtml.indexOf('<main class="document-body">');
    const titleIndex = result.templateHtml.indexOf('<header class="document-title">');
    expect(coverIndex).toBeLessThan(tocIndex);
    expect(tocIndex).toBeLessThan(bodyIndex);
    expect(bodyIndex).toBeLessThan(titleIndex);
  });

  test("preserves base-profile metadata title hide ownership", () => {
    const result = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        titlePolicySignals: { baseProfileMetadataTitle: "hide" },
      }),
    });

    expect(result.titlePolicy).toMatchObject({
      metadataTitle: "hide",
      visibleMetadataTitle: false,
    });
    expect(result.templateHtml).not.toContain('<header class="document-title">');
  });

  test("lets explicit title intent override default duplicate suppression", () => {
    const keep = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        titleSignals: {
          frontmatterTitle: { present: true, charCount: 14 },
          firstH1: { present: true, charCount: 14 },
          normalizedTitleMatch: true,
          duplicateVisibleTitleRisk: true,
        },
        titlePolicySignals: { explicitKeepMetadataTitleIntent: true },
      }),
    });
    const hide = synthesizeMdPdfTemplateCodex({
      outputPlan: createSynthesisOutputPlan(),
      signals: createSynthesisSignals({
        titlePolicySignals: { explicitHideMetadataTitleIntent: true },
      }),
    });

    expect(keep.titlePolicy).toMatchObject({
      metadataTitle: "show",
      visibleMetadataTitle: true,
    });
    expect(keep.templateHtml).toContain('<header class="document-title">');
    expect(hide.titlePolicy).toMatchObject({
      metadataTitle: "hide",
      visibleMetadataTitle: false,
    });
    expect(hide.templateHtml).not.toContain('<header class="document-title">');
  });
});
