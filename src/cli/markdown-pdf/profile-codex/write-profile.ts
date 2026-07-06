import { inferMarkdownPdfProfileFormat, serializeMarkdownPdfProfile } from "../profile";

export function serializeMarkdownPdfProfileCodexProfile(input: {
  finalProfile: Record<string, unknown>;
  outputPath: string;
}): string {
  const format = inferMarkdownPdfProfileFormat(input.outputPath);
  return serializeMarkdownPdfProfile(input.finalProfile, format);
}
