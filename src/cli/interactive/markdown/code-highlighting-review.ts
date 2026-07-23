import { printLine } from "../../actions/shared";
import {
  normalizeMarkdownPdfProfile,
  type NormalizedMarkdownPdfCode,
} from "../../markdown-pdf/profile";
import type { CliRuntime } from "../../types";

export function resolveReusableMarkdownPdfCode(
  profile: Record<string, unknown>,
): NormalizedMarkdownPdfCode {
  return normalizeMarkdownPdfProfile({ profile }).profile.code;
}

export function renderReusableMarkdownPdfCodeReview(
  runtime: CliRuntime,
  code: Readonly<NormalizedMarkdownPdfCode>,
): void {
  printLine(runtime.stderr, "Reusable Profile settings:");
  printLine(runtime.stderr, `- Highlighting: ${code.highlight ? "enabled" : "disabled"}`);
  printLine(
    runtime.stderr,
    `- Code highlighting theme: ${code.theme}${code.highlight ? "" : " (used when enabled)"}`,
  );
  printLine(runtime.stderr, `- Line numbers: ${code.lineNumbers ? "enabled" : "disabled"}`);
  printLine(
    runtime.stderr,
    `- Transformer notation: ${code.transformerNotation ? "enabled" : "disabled"}`,
  );
}
