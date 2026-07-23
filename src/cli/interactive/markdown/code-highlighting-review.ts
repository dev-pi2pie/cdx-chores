import { printLine } from "../../actions/shared";
import {
  normalizeMarkdownPdfProfile,
  type NormalizedMarkdownPdfCode,
} from "../../markdown-pdf/profile";
import type { CliRuntime } from "../../types";
import {
  markdownPdfRenderCodeHighlightChoiceLabel,
  type MarkdownPdfRenderCodeHighlightChoice,
} from "./render-code-highlighting";

function formatCodeSettings(heading: string, code: Readonly<NormalizedMarkdownPdfCode>): string[] {
  return [
    heading,
    `- Highlighting: ${code.highlight ? "enabled" : "disabled"}`,
    `- Code highlighting theme: ${code.theme}${code.highlight ? "" : " (used when enabled)"}`,
    `- Line numbers: ${code.lineNumbers ? "enabled" : "disabled"}`,
    `- Transformer notation: ${code.transformerNotation ? "enabled" : "disabled"}`,
  ];
}

export function resolveReusableMarkdownPdfCode(
  profile: Record<string, unknown>,
): NormalizedMarkdownPdfCode {
  return normalizeMarkdownPdfProfile({ profile }).profile.code;
}

export function tryResolveReusableMarkdownPdfCode(
  profile: Record<string, unknown>,
): NormalizedMarkdownPdfCode | undefined {
  try {
    return resolveReusableMarkdownPdfCode(profile);
  } catch {
    return undefined;
  }
}

export function formatReusableMarkdownPdfCodeReview(
  code: Readonly<NormalizedMarkdownPdfCode>,
): string[] {
  return formatCodeSettings("Reusable Profile settings:", code);
}

export function formatMarkdownPdfRenderOverrideReview(
  choice: MarkdownPdfRenderCodeHighlightChoice,
): string[] {
  return ["Render override:", `- ${markdownPdfRenderCodeHighlightChoiceLabel(choice)}`];
}

export function formatEffectiveMarkdownPdfCodeReview(
  code: Readonly<NormalizedMarkdownPdfCode>,
): string[] {
  return formatCodeSettings("Effective render:", code);
}

export function renderReusableMarkdownPdfCodeReview(
  runtime: CliRuntime,
  code: Readonly<NormalizedMarkdownPdfCode>,
): void {
  for (const line of formatReusableMarkdownPdfCodeReview(code)) {
    printLine(runtime.stderr, line);
  }
}
