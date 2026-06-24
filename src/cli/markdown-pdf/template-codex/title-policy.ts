import type { MarkdownPdfTemplateCodexResolvedSlots } from "./types-synthesis";
import type { MdPdfTemplateCodexSignalCollection } from "./types-signals";

export type MarkdownPdfTemplateCodexMetadataTitlePolicy =
  | "show"
  | "suppress-duplicate"
  | "suppress-cover-title";

export interface MarkdownPdfTemplateCodexTitlePolicyDecision {
  metadataTitle: MarkdownPdfTemplateCodexMetadataTitlePolicy;
  visibleMetadataTitle: boolean;
  duplicateVisibleTitleRisk: boolean;
  coverTitleOwnsPlacement: boolean;
  reason: string;
}

export function resolveMdPdfTemplateCodexTitlePolicy(input: {
  signals: MdPdfTemplateCodexSignalCollection;
  slots: MarkdownPdfTemplateCodexResolvedSlots;
}): MarkdownPdfTemplateCodexTitlePolicyDecision {
  const duplicateVisibleTitleRisk = input.signals.documentSignals.title.duplicateVisibleTitleRisk;
  const coverTitleOwnsPlacement =
    input.slots.cover.enabled && input.slots.cover.titlePlacement !== "document-title";

  if (coverTitleOwnsPlacement) {
    return {
      metadataTitle: "suppress-cover-title",
      visibleMetadataTitle: false,
      duplicateVisibleTitleRisk,
      coverTitleOwnsPlacement,
      reason: "cover slot owns visible title placement",
    };
  }

  if (duplicateVisibleTitleRisk) {
    return {
      metadataTitle: "suppress-duplicate",
      visibleMetadataTitle: false,
      duplicateVisibleTitleRisk,
      coverTitleOwnsPlacement,
      reason: "frontmatter title matches first H1",
    };
  }

  return {
    metadataTitle: "show",
    visibleMetadataTitle: true,
    duplicateVisibleTitleRisk,
    coverTitleOwnsPlacement,
    reason: "no duplicate title suppression needed",
  };
}
