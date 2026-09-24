import type { MarkdownPdfTemplateCodexResolvedSlots } from "./types-synthesis";
import type { MdPdfTemplateCodexSignalCollection } from "./types-signals";
import type { MarkdownPdfMetadataTitleBlockMode } from "../profile/types";

export type MarkdownPdfTemplateCodexMetadataTitlePolicy =
  | "hide"
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
  profileMetadataTitle?: MarkdownPdfMetadataTitleBlockMode;
}): MarkdownPdfTemplateCodexTitlePolicyDecision {
  const duplicateVisibleTitleRisk = input.signals.documentSignals.title.duplicateVisibleTitleRisk;
  const coverTitleOwnsPlacement = input.slots.cover.enabled;
  if (input.profileMetadataTitle === "show" || input.profileMetadataTitle === "hide") {
    return {
      metadataTitle: input.profileMetadataTitle,
      visibleMetadataTitle: input.profileMetadataTitle === "show",
      duplicateVisibleTitleRisk,
      coverTitleOwnsPlacement,
      reason: `final profile titleBlock.metadataTitle ${input.profileMetadataTitle}s metadata title output`,
    };
  }
  if (input.profileMetadataTitle === "auto" && coverTitleOwnsPlacement) {
    return {
      metadataTitle: "suppress-cover-title",
      visibleMetadataTitle: false,
      duplicateVisibleTitleRisk,
      coverTitleOwnsPlacement,
      reason: "final profile auto title policy places the title on the cover",
    };
  }
  const baseProfileMetadataTitle = input.signals.title.baseProfileMetadataTitle;

  if (input.signals.title.explicitHideMetadataTitleIntent) {
    return {
      metadataTitle: "hide",
      visibleMetadataTitle: false,
      duplicateVisibleTitleRisk,
      coverTitleOwnsPlacement,
      reason: "explicit intent suppresses metadata title output",
    };
  }

  if (input.signals.title.explicitKeepMetadataTitleIntent) {
    return {
      metadataTitle: "show",
      visibleMetadataTitle: true,
      duplicateVisibleTitleRisk,
      coverTitleOwnsPlacement,
      reason: "explicit intent preserves metadata title output",
    };
  }

  if (baseProfileMetadataTitle === "hide") {
    return {
      metadataTitle: "hide",
      visibleMetadataTitle: false,
      duplicateVisibleTitleRisk,
      coverTitleOwnsPlacement,
      reason: "base profile titleBlock.metadataTitle hides metadata title output",
    };
  }

  if (baseProfileMetadataTitle === "show") {
    return {
      metadataTitle: "show",
      visibleMetadataTitle: true,
      duplicateVisibleTitleRisk,
      coverTitleOwnsPlacement,
      reason: "base profile titleBlock.metadataTitle preserves metadata title output",
    };
  }

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
