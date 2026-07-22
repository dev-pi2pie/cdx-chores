export type MarkdownPdfInteractiveFontHintArtifact =
  | "profile"
  | "template-bundle"
  | "project-bundle";

export type MarkdownPdfInteractiveFontHintIntendedUse =
  | { kind: "general-body" }
  | { kind: "body" }
  | { kind: "language-body"; language: string }
  | { kind: "heading" }
  | { kind: "code" }
  | { kind: "code-symbols" }
  | { kind: "page-chrome" };

export interface MarkdownPdfInteractiveFontHintBuiltDraft {
  kind: "built";
  preference: string;
  intendedUse?: MarkdownPdfInteractiveFontHintIntendedUse;
}

export interface MarkdownPdfInteractiveFontHintCustomDraft {
  kind: "custom";
  text: string;
}

export type MarkdownPdfInteractiveFontHintDraft =
  | MarkdownPdfInteractiveFontHintBuiltDraft
  | MarkdownPdfInteractiveFontHintCustomDraft;

export type MarkdownPdfInteractiveFontHintEditorAction =
  | "accept"
  | "revise-preference"
  | "revise-use"
  | "switch-to-custom"
  | "back";

export interface MarkdownPdfInteractiveFontHintEditorChoice<TValue> {
  name: string;
  value: TValue;
  description?: string;
}

export type MarkdownPdfInteractiveFontHintPreferenceChoice =
  | string
  | {
      name: string;
      value: string;
      description?: string;
    };

export interface MarkdownPdfInteractiveFontHintSuggestionService {
  cancel(): void;
  promptPreference(current?: string): Promise<string | undefined>;
}

export interface MarkdownPdfInteractiveFontHintEditorSession {
  cancel(): void;
  edit(
    runtime: CliRuntime,
    current: readonly string[],
    artifact: MarkdownPdfInteractiveFontHintArtifact,
  ): Promise<string[]>;
}
import type { CliRuntime } from "../../../types";
