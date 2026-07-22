import type { PreparedMarkdownPdfProfileCodex } from "../../markdown-pdf/profile-codex";
import type { MarkdownPdfProjectCodexPreparedArtifact } from "../../markdown-pdf/project-codex";
import type { PreparedMdPdfTemplateCodexArtifact } from "../../markdown-pdf/template-codex";
import type { PreparedMarkdownPdfDeterministicRecipe } from "./deterministic-authoring";

export type MarkdownPdfCodexArtifact = "profile" | "template-bundle" | "project-bundle";

export interface MarkdownPdfCodexSetup {
  artifact: MarkdownPdfCodexArtifact;
  baseProfile?: string;
  coverImage?: string;
  fontHints: string[];
  intent?: string;
  sample?: string;
}

export type MarkdownPdfCodexReportRetention =
  | { kind: "none" }
  | { kind: "with-artifact" }
  | { kind: "external"; path: string };

export type PreparedMarkdownPdfCodexCandidate =
  | {
      artifact: "profile";
      prepared: PreparedMarkdownPdfProfileCodex;
      setup: MarkdownPdfCodexSetup;
    }
  | {
      artifact: "template-bundle";
      prepared: PreparedMdPdfTemplateCodexArtifact;
      setup: MarkdownPdfCodexSetup;
    }
  | {
      artifact: "project-bundle";
      prepared: MarkdownPdfProjectCodexPreparedArtifact;
      setup: MarkdownPdfCodexSetup;
    };

export type MarkdownPdfGeneratedLifecycle = "temporary-render" | "save-and-render";

export type PreparedMarkdownPdfGeneratedCandidate =
  | { kind: "codex"; candidate: PreparedMarkdownPdfCodexCandidate }
  | { kind: "deterministic"; candidate: PreparedMarkdownPdfDeterministicRecipe };

export interface MarkdownPdfGeneratedLifecycleSelection {
  candidate: PreparedMarkdownPdfGeneratedCandidate;
  kind: "generated-lifecycle";
  lifecycle: MarkdownPdfGeneratedLifecycle;
  markdownInput: string;
  report: MarkdownPdfCodexReportRetention;
}

export type MarkdownPdfGeneratedLifecycleHandler = (
  selection: MarkdownPdfGeneratedLifecycleSelection,
) => Promise<"complete" | "review">;

export interface MarkdownPdfSavedRecipe {
  artifact: MarkdownPdfCodexArtifact;
  kind: "saved-recipe";
  outputPath: string;
  rendererSource: "existing-profile" | "existing-bundle";
  sample?: string;
}
