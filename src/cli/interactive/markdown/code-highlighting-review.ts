import { printLine } from "../../actions/shared";
import {
  DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE,
  normalizeMarkdownPdfProfile,
  resolveMarkdownPdfCodeOptions,
  type NormalizedMarkdownPdfCode,
} from "../../markdown-pdf/profile";
import type { CliRuntime } from "../../types";
import type { PreparedMarkdownPdfGeneratedCandidate } from "./codex-types";
import {
  compileMarkdownPdfRenderCodeHighlightChoice,
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

export function resolveGeneratedReusableMarkdownPdfCode(
  generated: PreparedMarkdownPdfGeneratedCandidate,
): NormalizedMarkdownPdfCode | undefined {
  if (generated.kind === "deterministic") {
    return generated.candidate.artifact === "profile"
      ? resolveReusableMarkdownPdfCode(generated.candidate.prepared.profile)
      : undefined;
  }
  const candidate = generated.candidate;
  if (candidate.artifact === "profile") {
    return candidate.prepared.kind === "profile"
      ? tryResolveReusableMarkdownPdfCode(candidate.prepared.finalProfile)
      : undefined;
  }
  if (candidate.artifact === "template-bundle") {
    return undefined;
  }
  return tryResolveReusableMarkdownPdfCode(candidate.prepared.profilePhase.finalProfile);
}

export function resolveGeneratedEffectiveMarkdownPdfCode(
  generated: PreparedMarkdownPdfGeneratedCandidate,
  choice: MarkdownPdfRenderCodeHighlightChoice,
): NormalizedMarkdownPdfCode {
  return resolveMarkdownPdfCodeOptions({
    profile:
      resolveGeneratedReusableMarkdownPdfCode(generated) ??
      DEFAULT_NORMALIZED_MARKDOWN_PDF_PROFILE.code,
    cliHighlight: compileMarkdownPdfRenderCodeHighlightChoice(choice),
  });
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
