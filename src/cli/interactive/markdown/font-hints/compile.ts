import { normalizeMarkdownPdfInteractiveFontHintText } from "./text";
import type {
  MarkdownPdfInteractiveFontHintBuiltDraft,
  MarkdownPdfInteractiveFontHintDraft,
  MarkdownPdfInteractiveFontHintIntendedUse,
} from "./types";

export function intendedUseLabel(use?: MarkdownPdfInteractiveFontHintIntendedUse): string {
  if (!use || use.kind === "general-body") {
    return "Keep this preference general";
  }
  if (use.kind === "body") {
    return "Body text";
  }
  if (use.kind === "language-body") {
    return `Language-specific body text — ${normalizeMarkdownPdfInteractiveFontHintText(use.language)}`;
  }
  if (use.kind === "heading") {
    return "Headings and titles";
  }
  if (use.kind === "code") {
    return "Code text";
  }
  if (use.kind === "code-symbols") {
    return "Code symbols";
  }
  return "Page headers and footers";
}

function compileBuiltDraft(draft: MarkdownPdfInteractiveFontHintBuiltDraft): string {
  const preference = normalizeMarkdownPdfInteractiveFontHintText(draft.preference);
  const intendedUse = draft.intendedUse;

  if (!intendedUse || intendedUse.kind === "general-body") {
    return `Prefer ${preference}`;
  }
  if (intendedUse.kind === "body") {
    return `Prefer ${preference} for body text`;
  }
  if (intendedUse.kind === "language-body") {
    return `Prefer ${preference} for ${normalizeMarkdownPdfInteractiveFontHintText(
      intendedUse.language,
    )} body text`;
  }
  if (intendedUse.kind === "heading") {
    return `Prefer ${preference} for headings and titles`;
  }
  if (intendedUse.kind === "code") {
    return `Prefer ${preference} for code text`;
  }
  if (intendedUse.kind === "code-symbols") {
    return `Prefer ${preference} for code symbols`;
  }
  return `Prefer ${preference} for page headers and footers`;
}

export function compileMarkdownPdfInteractiveFontHintDraft(
  draft: MarkdownPdfInteractiveFontHintDraft,
): string {
  if (draft.kind === "custom") {
    return normalizeMarkdownPdfInteractiveFontHintText(draft.text);
  }
  return compileBuiltDraft(draft);
}

export function formatMarkdownPdfInteractiveFontHintPreview(
  draft: MarkdownPdfInteractiveFontHintDraft,
): string[] {
  const compiled = compileMarkdownPdfInteractiveFontHintDraft(draft);
  const lines = ["Font hint preview", ""];

  if (draft.kind === "custom") {
    lines.push("Input mode: complete custom", "");
    lines.push("Compiled hint:");
    lines.push(compiled);
    lines.push("", "Direct option:");
    lines.push(`--font-hint = ${compiled}`);
    lines.push("", "Assignment: determined during Codex preparation");
    return lines;
  }

  lines.push(`Preference: ${normalizeMarkdownPdfInteractiveFontHintText(draft.preference)}`);
  lines.push(`Intended use: ${intendedUseLabel(draft.intendedUse)}`);
  lines.push("", "Compiled hint:");
  lines.push(compiled);
  lines.push("", "Direct option:");
  lines.push(`--font-hint = ${compiled}`);
  lines.push("", "Assignment: determined during Codex preparation");
  return lines;
}
