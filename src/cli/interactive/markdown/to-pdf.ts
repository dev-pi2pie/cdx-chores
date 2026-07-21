import { CliError } from "../../errors";

export async function handleMarkdownPdfToPdfInteractiveAction(): Promise<void> {
  throw new CliError("Interactive Markdown PDF route md:to-pdf is not implemented yet.", {
    code: "MARKDOWN_PDF_INTERACTIVE_NOT_READY",
    exitCode: 2,
  });
}
