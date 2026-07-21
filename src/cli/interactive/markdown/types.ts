export type MarkdownPdfInteractiveEntry = "to-pdf" | "pdf-recipes";

export type MarkdownPdfInteractiveCheckpoint =
  | "entry"
  | "source"
  | "preparation"
  | "review"
  | "lifecycle"
  | "materialization";

export type MarkdownPdfInteractiveNavigation = "continue" | "back" | "cancel";

export type MarkdownPdfInteractiveSource =
  | "built-in"
  | "existing-profile"
  | "existing-bundle"
  | "custom-inputs"
  | "generated";

export type MarkdownPdfInteractiveArtifact = "profile" | "template-bundle" | "project-bundle";

export type MarkdownPdfInteractivePreparation = "starter" | "formal-guide" | "codex-assistant";

export type MarkdownPdfInteractiveLifecycle =
  | "render-existing"
  | "temporary-render"
  | "save-and-render"
  | "save-only";

export type MarkdownPdfInteractiveMaterializationStatus =
  | "pending"
  | "prepared"
  | "committed"
  | "rendered"
  | "failed"
  | "discarded";

export interface MarkdownPdfInteractiveMaterialization {
  reportPath?: string;
  status: MarkdownPdfInteractiveMaterializationStatus;
  outputPath?: string;
}

export interface MarkdownPdfInteractiveSessionState {
  checkpoint: MarkdownPdfInteractiveCheckpoint;
  entry?: MarkdownPdfInteractiveEntry;
  source?: MarkdownPdfInteractiveSource;
  artifact?: MarkdownPdfInteractiveArtifact;
  preparation?: MarkdownPdfInteractivePreparation;
  lifecycle?: MarkdownPdfInteractiveLifecycle;
  navigation?: MarkdownPdfInteractiveNavigation;
  materialization?: MarkdownPdfInteractiveMaterialization;
}
