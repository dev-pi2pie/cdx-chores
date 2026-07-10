import { shellQuote } from "../codex-path-display";

export function createMdPdfTemplateCodexRenderCommand(input: {
  bundlePath: string;
  inputPath: string;
}): string {
  return `cdx-chores md to-pdf --input ${shellQuote(input.inputPath)} --bundle ${shellQuote(
    input.bundlePath,
  )} --output ${shellQuote("<output.pdf>")}`;
}
