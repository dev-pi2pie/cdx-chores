import { CliError } from "../../errors";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";

export async function handleMarkdownPdfToPdfInteractiveAction(
  _runtime: CliRuntime,
  _pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  throw new CliError("Interactive Markdown PDF route md:to-pdf is not implemented yet.", {
    code: "MARKDOWN_PDF_INTERACTIVE_NOT_READY",
    exitCode: 2,
  });
}
