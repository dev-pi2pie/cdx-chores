import {
  assertMarkdownPdfTemplateCodexFamilyHooksPresent,
  MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES,
  resolveMdPdfTemplateCodexFamily,
} from "./families";
import {
  materializeMdPdfTemplateCodexFontDecisions,
  resolveMdPdfTemplateCodexSlots,
  resolveMdPdfTemplateCodexThemeTokens,
} from "./slots";
import { synthesizeMdPdfTemplateCodexCss } from "./synthesize-css";
import { synthesizeMdPdfTemplateCodexHtml } from "./synthesize-template";
import type { MarkdownPdfTemplateCodexDecision } from "./codex-decision";
import type {
  MarkdownPdfTemplateCodexManagedAssetBinding,
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexSynthesisResult,
  MdPdfTemplateCodexSignalCollection,
} from "./types";

function bindManagedAssets(
  outputPlan: MarkdownPdfTemplateCodexOutputPlan,
): MarkdownPdfTemplateCodexManagedAssetBinding[] {
  const coverAsset = outputPlan.assets.find((asset) => asset.role === "cover-image");
  if (!coverAsset) {
    return [];
  }
  return [
    {
      role: "cover-image",
      bundlePath: coverAsset.bundlePath,
      sourceBasename: coverAsset.sourceBasename,
    },
  ];
}

export function synthesizeMdPdfTemplateCodex(input: {
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  signals: MdPdfTemplateCodexSignalCollection;
}): MarkdownPdfTemplateCodexSynthesisResult {
  const templateFamily = resolveMdPdfTemplateCodexFamily(input.signals);
  const family = MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES[templateFamily];
  const slots = resolveMdPdfTemplateCodexSlots({
    family: templateFamily,
    signals: input.signals,
  });
  const themeTokens = resolveMdPdfTemplateCodexThemeTokens(input.signals, slots);
  const managedAssets = bindManagedAssets(input.outputPlan);
  const templateHtml = synthesizeMdPdfTemplateCodexHtml({
    family: templateFamily,
    managedAssets,
    outputPlan: input.outputPlan,
    signals: input.signals,
    slots,
  });
  const styleCss = synthesizeMdPdfTemplateCodexCss({
    family: templateFamily,
    outputPlan: input.outputPlan,
    signals: input.signals,
    slots,
    themeTokens,
  });
  assertMarkdownPdfTemplateCodexFamilyHooksPresent({ family, styleCss, templateHtml });

  return {
    decisionMode: "deterministic",
    templateFamily,
    slots,
    themeTokens,
    fontDecisions: [],
    managedAssets,
    templateHtml,
    styleCss,
  };
}

function managedAssetsFromDecision(input: {
  decision: MarkdownPdfTemplateCodexDecision;
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
}): MarkdownPdfTemplateCodexManagedAssetBinding[] {
  const plannedAssetsByBundlePath = new Map(
    input.outputPlan.assets.map((asset) => [asset.bundlePath, asset]),
  );
  return input.decision.managedAssets.map((asset) => {
    const plannedAsset = plannedAssetsByBundlePath.get(asset.bundlePath);
    return {
      role: plannedAsset?.role ?? "cover-image",
      bundlePath: asset.bundlePath,
      sourceBasename: asset.sourceLabel,
    };
  });
}

function appendDecisionCssBlocks(
  styleCss: string,
  decision: MarkdownPdfTemplateCodexDecision,
): string {
  if (decision.cssBlocks.length === 0) {
    return styleCss;
  }
  return `${styleCss}
/* Codex bounded CSS blocks */
${decision.cssBlocks.map((block) => `/* slot=${block.slot} */\n${block.css}`).join("\n")}
`;
}

export function synthesizeMdPdfTemplateCodexFromDecision(input: {
  decision: MarkdownPdfTemplateCodexDecision;
  outputPlan: MarkdownPdfTemplateCodexOutputPlan;
  signals: MdPdfTemplateCodexSignalCollection;
}): MarkdownPdfTemplateCodexSynthesisResult {
  const templateFamily =
    input.decision.templateFamily ?? resolveMdPdfTemplateCodexFamily(input.signals);
  const slots = input.decision.slots;
  const fontDecisions = materializeMdPdfTemplateCodexFontDecisions({
    decisions: input.decision.fontDecisions,
    signals: input.signals,
  });
  const themeTokens = resolveMdPdfTemplateCodexThemeTokens(input.signals, slots, fontDecisions);

  if (input.decision.decisionMode === "no-usable-template") {
    return {
      decisionMode: input.decision.decisionMode,
      templateFamily,
      slots,
      themeTokens,
      fontDecisions,
      managedAssets: [],
      warnings: input.decision.warnings,
      unsupportedDirections: input.decision.unsupportedDirections,
      fallbackReason: input.decision.fallbackReason,
      templateHtml: "",
      styleCss: "",
    };
  }

  const family = MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES[templateFamily];
  const managedAssets = managedAssetsFromDecision({
    decision: input.decision,
    outputPlan: input.outputPlan,
  });
  const templateHtml = synthesizeMdPdfTemplateCodexHtml({
    family: templateFamily,
    managedAssets,
    outputPlan: input.outputPlan,
    signals: input.signals,
    slots,
  });
  const styleCss = appendDecisionCssBlocks(
    synthesizeMdPdfTemplateCodexCss({
      family: templateFamily,
      outputPlan: input.outputPlan,
      signals: input.signals,
      slots,
      themeTokens,
    }),
    input.decision,
  );
  assertMarkdownPdfTemplateCodexFamilyHooksPresent({ family, styleCss, templateHtml });

  return {
    decisionMode: input.decision.decisionMode,
    templateFamily,
    slots,
    themeTokens,
    fontDecisions,
    managedAssets,
    warnings: input.decision.warnings,
    unsupportedDirections: input.decision.unsupportedDirections,
    fallbackReason: input.decision.fallbackReason,
    templateHtml,
    styleCss,
  };
}
