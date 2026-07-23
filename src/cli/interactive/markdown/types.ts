export type MarkdownPdfInteractiveEntry = "to-pdf" | "pdf-recipes";

export type MarkdownPdfInteractiveCheckpoint =
  | "entry"
  | "source"
  | "preparation"
  | "review"
  | "lifecycle"
  | "materialization";

export type MarkdownPdfInteractiveNavigation = "continue" | "back" | "cancel";

export type MarkdownPdfInteractiveReviewDecision = "accept" | "revise" | "back" | "cancel";

export type MarkdownPdfInteractiveSource =
  | "built-in"
  | "existing-profile"
  | "existing-bundle"
  | "custom-inputs"
  | "generated";

export type MarkdownPdfInteractiveRenderSource = Exclude<MarkdownPdfInteractiveSource, "generated">;

export type MarkdownPdfInteractiveCustomInputMode = "explicit" | "bundle-with-explicit";

export type MarkdownPdfInteractiveExplicitRole = "profile" | "template" | "css";

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
  status: MarkdownPdfInteractiveMaterializationStatus;
  artifactOutputPath?: string;
  pdfOutputPath?: string;
  reportOutputPath?: string;
  ownedTemporaryBundlePath?: string;
}
