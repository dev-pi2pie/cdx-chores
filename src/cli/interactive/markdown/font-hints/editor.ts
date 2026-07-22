import { compileMarkdownPdfInteractiveFontHintDraft } from "./compile";
import {
  normalizeMarkdownPdfInteractiveFontHintFamilyName,
  normalizeMarkdownPdfInteractiveFontHintText,
} from "./text";
import type {
  MarkdownPdfInteractiveFontHintDraft,
  MarkdownPdfInteractiveFontHintEditorAction,
  MarkdownPdfInteractiveFontHintEditorChoice,
  MarkdownPdfInteractiveFontHintMode,
} from "./types";

export function buildMarkdownPdfInteractiveFontHintModeChoices(): Array<
  MarkdownPdfInteractiveFontHintEditorChoice<MarkdownPdfInteractiveFontHintMode | "back">
> {
  return [
    {
      name: "Build a font hint",
      value: "builder",
      description: "Pick a font preference, then choose the intended use.",
    },
    {
      name: "Write a complete custom hint",
      value: "custom",
      description: "Type the final --font-hint text directly.",
    },
    {
      name: "Back",
      value: "back",
    },
  ];
}

export function buildMarkdownPdfInteractiveFontHintNextStepChoices(): Array<
  MarkdownPdfInteractiveFontHintEditorChoice<MarkdownPdfInteractiveFontHintEditorAction>
> {
  return [
    { name: "Add this font hint", value: "accept" },
    { name: "Revise font preference", value: "revise-preference" },
    { name: "Revise intended use", value: "revise-use" },
    { name: "Write a complete custom hint", value: "switch-to-custom" },
    { name: "Back", value: "back" },
  ];
}

function normalizeCompiledHint(value: string): string {
  return normalizeMarkdownPdfInteractiveFontHintFamilyName(value);
}

export function findExactMarkdownPdfInteractiveFontHintDuplicate(
  existing: readonly string[],
  candidate: string | MarkdownPdfInteractiveFontHintDraft,
): string | undefined {
  const compiled =
    typeof candidate === "string"
      ? normalizeMarkdownPdfInteractiveFontHintText(candidate)
      : compileMarkdownPdfInteractiveFontHintDraft(candidate);
  const normalizedCandidate = normalizeCompiledHint(compiled);
  return existing.find((hint) => normalizeCompiledHint(hint) === normalizedCandidate);
}

export function replaceMarkdownPdfInteractiveFontHint(
  hints: readonly string[],
  index: number,
  next: string,
): string[] {
  const copy = [...hints];
  copy.splice(index, 1, normalizeMarkdownPdfInteractiveFontHintText(next));
  return copy;
}

export function removeMarkdownPdfInteractiveFontHint(
  hints: readonly string[],
  index: number,
): string[] {
  const copy = [...hints];
  copy.splice(index, 1);
  return copy;
}

export function moveMarkdownPdfInteractiveFontHint(
  hints: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const copy = [...hints];
  const [moved] = copy.splice(fromIndex, 1);
  if (moved === undefined) {
    return copy;
  }
  copy.splice(toIndex, 0, moved);
  return copy;
}
