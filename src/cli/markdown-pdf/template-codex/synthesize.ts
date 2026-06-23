import { resolveMdPdfTemplateCodexFamily } from "./families";
import { resolveMdPdfTemplateCodexSlots, resolveMdPdfTemplateCodexThemeTokens } from "./slots";
import { synthesizeMdPdfTemplateCodexCss } from "./synthesize-css";
import { synthesizeMdPdfTemplateCodexHtml } from "./synthesize-template";
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
  const slots = resolveMdPdfTemplateCodexSlots({
    family: templateFamily,
    signals: input.signals,
  });
  const themeTokens = resolveMdPdfTemplateCodexThemeTokens(input.signals, slots);
  const managedAssets = bindManagedAssets(input.outputPlan);

  return {
    decisionMode: "deterministic",
    templateFamily,
    slots,
    themeTokens,
    managedAssets,
    templateHtml: synthesizeMdPdfTemplateCodexHtml({
      family: templateFamily,
      managedAssets,
      outputPlan: input.outputPlan,
      signals: input.signals,
      slots,
    }),
    styleCss: synthesizeMdPdfTemplateCodexCss({
      family: templateFamily,
      outputPlan: input.outputPlan,
      signals: input.signals,
      slots,
      themeTokens,
    }),
  };
}
