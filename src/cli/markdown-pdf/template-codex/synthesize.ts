import { MARKDOWN_PDF_TEMPLATE_CODEX_FAMILIES, resolveMdPdfTemplateCodexFamily } from "./families";
import { resolveMdPdfTemplateCodexSlots, resolveMdPdfTemplateCodexThemeTokens } from "./slots";
import { synthesizeMdPdfTemplateCodexCss } from "./synthesize-css";
import { synthesizeMdPdfTemplateCodexHtml } from "./synthesize-template";
import type {
  MarkdownPdfTemplateCodexManagedAssetBinding,
  MarkdownPdfTemplateCodexOutputPlan,
  MarkdownPdfTemplateCodexSynthesisResult,
  MdPdfTemplateCodexSignalCollection,
  MarkdownPdfTemplateCodexFamilySpec,
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

function assertFamilyHooksPresent(input: {
  family: MarkdownPdfTemplateCodexFamilySpec;
  styleCss: string;
  templateHtml: string;
}): void {
  const synthesized = `${input.templateHtml}\n${input.styleCss}`;
  const missingHooks = input.family.requiredHooks.filter((hook) => !synthesized.includes(hook));
  if (missingHooks.length > 0) {
    throw new Error(
      `Generated ${input.family.id} template is missing required hooks: ${missingHooks.join(", ")}`,
    );
  }
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
  assertFamilyHooksPresent({ family, styleCss, templateHtml });

  return {
    decisionMode: "deterministic",
    templateFamily,
    slots,
    themeTokens,
    managedAssets,
    templateHtml,
    styleCss,
  };
}
