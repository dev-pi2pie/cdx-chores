import { shellQuote } from "../codex-path-display";

export function createMdPdfTemplateCodexRenderCommand(input: {
  bundlePath: string;
  inputPath: string;
  profilePath?: string;
}): string {
  const profile = input.profilePath ? ` --profile ${shellQuote(input.profilePath)}` : "";
  return `cdx-chores md to-pdf --input ${shellQuote(input.inputPath)} --bundle ${shellQuote(
    input.bundlePath,
  )}${profile} --output ${shellQuote("<output.pdf>")}`;
}
