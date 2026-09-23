import { describe, expect, test } from "bun:test";

import {
  MARKDOWN_PDF_PROFILE_TEXT_COVER_MARKER,
  normalizeMarkdownPdfProfile,
} from "../../../../../src/cli/markdown-pdf/profile";
import type { MarkdownPdfTemplateCodexDecision } from "../../../../../src/cli/markdown-pdf/template-codex/codex-decision";
import {
  synthesizeMdPdfTemplateCodex,
  synthesizeMdPdfTemplateCodexFromDecision,
} from "../../../../../src/cli/markdown-pdf/template-codex/synthesize";
import { validateMdPdfTemplateCodexSynthesis } from "../../../../../src/cli/markdown-pdf/template-codex/validate-template";
import { createSynthesisOutputPlan, createSynthesisSignals } from "../template-synthesis-fixtures";

function textCoverProfile(input: {
  metadataTitle?: "auto" | "show" | "hide";
  style: "plain" | "report";
}) {
  return normalizeMarkdownPdfProfile({
    profile: {
      cover: {
        enabled: true,
        style: input.style,
        fields: {
          title: "A & B <Guide>",
          subtitle: "A practical subtitle",
          author: "Sample Author",
          company: "Sample Company",
          date: "2026-09-24",
        },
      },
      titleBlock: { metadataTitle: input.metadataTitle ?? "auto" },
    },
  }).profile;
}

describe("cli action modules: md pdf-template codex Profile text cover", () => {
  test("keeps one managed report-cover hook without baking Profile text", () => {
    const profile = textCoverProfile({ style: "report" });
    const outputPlan = createSynthesisOutputPlan();
    const signals = createSynthesisSignals({ orientation: "landscape", pageSize: "A4" });
    const result = synthesizeMdPdfTemplateCodex({ outputPlan, signals, textCoverProfile: profile });

    expect(result.templateFamily).toBe("document-layered");
    expect(result.slots.cover).toMatchObject({
      enabled: true,
      style: "report",
      titlePlacement: "text-cover",
    });
    expect(result.managedAssets).toEqual([]);
    expect(result.templateHtml.match(/<section class="pdf-cover\b/g)).toHaveLength(1);
    expect(result.templateHtml).toContain(
      `<section class="pdf-cover pdf-cover--report" ${MARKDOWN_PDF_PROFILE_TEXT_COVER_MARKER}></section>`,
    );
    expect(result.templateHtml).not.toContain("A & B <Guide>");
    expect(result.templateHtml).not.toContain("Sample Company");
    expect(result.templateHtml).not.toContain('<header class="document-title">');
    expect(result.templateHtml).not.toContain("pdf-cover-media__image");
    expect(result.styleCss).toContain("size: A4 landscape;");
    expect(result.styleCss).not.toContain(".pdf-cover-media__image");
    validateMdPdfTemplateCodexSynthesis({
      compatibilityProfile: profile,
      outputPlan,
      synthesis: result,
    });
  });

  test("keeps a plain text-cover hook after an image-free model decision", () => {
    const profile = textCoverProfile({ metadataTitle: "show", style: "plain" });
    const outputPlan = createSynthesisOutputPlan();
    const signals = createSynthesisSignals({ pageSize: "A4", orientation: "portrait" });
    const base = synthesizeMdPdfTemplateCodex({ outputPlan, signals });
    const decision: MarkdownPdfTemplateCodexDecision = {
      decisionMode: "adapted",
      templateFamily: "document-layered",
      recipePreset: "article",
      slots: base.slots,
      cssBlocks: [],
      fontDecisions: [],
      managedAssets: [],
      warnings: [],
      unsupportedDirections: [],
    };
    expect(decision.slots.cover.enabled).toBe(false);

    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision,
      outputPlan,
      signals,
      textCoverProfile: profile,
    });

    expect(result.decisionMode).toBe("adapted");
    expect(result.slots.cover).toMatchObject({ enabled: true, style: "plain" });
    expect(result.templateHtml.match(/<section class="pdf-cover\b/g)).toHaveLength(1);
    expect(result.templateHtml).toContain('class="pdf-cover pdf-cover--plain"');
    expect(result.templateHtml).not.toContain('class="pdf-cover pdf-cover--report"');
    expect(result.templateHtml).toContain(MARKDOWN_PDF_PROFILE_TEXT_COVER_MARKER);
    expect(result.templateHtml).not.toContain("A & B <Guide>");
    expect(result.templateHtml).toContain('<header class="document-title">');
    expect(result.styleCss).toContain("size: A4 portrait;");
    validateMdPdfTemplateCodexSynthesis({
      compatibilityProfile: profile,
      outputPlan,
      synthesis: result,
    });
  });

  test("keeps an assigned image as the sole cover", () => {
    const profile = textCoverProfile({ style: "report" });
    const outputPlan = createSynthesisOutputPlan({ includeCoverAsset: true });
    const signals = createSynthesisSignals({ coverImage: {} });
    const result = synthesizeMdPdfTemplateCodex({ outputPlan, signals, textCoverProfile: profile });

    expect(result.templateHtml.match(/<section class="pdf-cover\b/g)).toHaveLength(1);
    expect(result.templateHtml).toContain('src="assets/cover.png"');
    expect(result.templateHtml).not.toContain("Sample Company");
    expect(result.styleCss).not.toContain("border-left: 8mm solid #1f5f8b;");
    expect(result.slots.cover.style).toBe("media");
  });

  test("does not turn a no-usable model decision into a Template", () => {
    const profile = textCoverProfile({ style: "report" });
    const outputPlan = createSynthesisOutputPlan();
    const signals = createSynthesisSignals();
    const base = synthesizeMdPdfTemplateCodex({ outputPlan, signals });
    const decision: MarkdownPdfTemplateCodexDecision = {
      decisionMode: "no-usable-template",
      slots: base.slots,
      cssBlocks: [],
      fontDecisions: [],
      managedAssets: [],
      warnings: [],
      unsupportedDirections: [],
    };

    const result = synthesizeMdPdfTemplateCodexFromDecision({
      decision,
      outputPlan,
      signals,
      textCoverProfile: profile,
    });

    expect(result.slots.cover.enabled).toBe(false);
    expect(result.templateHtml).toBe("");
    expect(result.styleCss).toBe("");
  });
});
