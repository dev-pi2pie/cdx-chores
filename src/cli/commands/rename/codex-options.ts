import type { Command } from "commander";

import { createCodexTimeoutDurationOption } from "../../options/codex-timeout-option";

export interface RenameCodexCommandOptions {
  codex?: boolean;
  codexTimeout?: number;
  codexImages?: boolean;
  codexImagesTimeout?: number;
  codexImagesTimeoutMs?: number;
  codexImagesRetries?: number;
  codexImagesBatchSize?: number;
  codexDocs?: boolean;
  codexDocsTimeout?: number;
  codexDocsTimeoutMs?: number;
  codexDocsRetries?: number;
  codexDocsBatchSize?: number;
}

export function applyRenameCodexOptions(command: Command): Command {
  return command
    .option("--codex", "Auto-route eligible files to Codex analyzers by file type", false)
    .addOption(
      createCodexTimeoutDurationOption(
        "--codex-timeout",
        "Timeout for each Codex request attempt (for example: 30s, 2m)",
      ),
    )
    .option(
      "--codex-images",
      "Use only the Codex image analyzer for supported static image files",
      false,
    )
    .addOption(
      createCodexTimeoutDurationOption(
        "--codex-images-timeout",
        "Override the per-attempt timeout for Codex image-title requests",
      ).conflicts("codexImagesTimeoutMs"),
    )
    .option(
      "--codex-images-timeout-ms <ms>",
      "Deprecated millisecond-only image timeout; use --codex-images-timeout",
      (value) => Number(value),
    )
    .option(
      "--codex-images-retries <count>",
      "Retry count after the initial Codex image-title request, per batch",
      (value) => Number(value),
    )
    .option(
      "--codex-images-batch-size <count>",
      "Number of images per Codex image-title request batch",
      (value) => Number(value),
    )
    .option(
      "--codex-docs",
      "Use only the Codex document analyzer for supported docs (.md, .txt, .json, .yaml, .toml, .xml, .html, .pdf, ...)",
      false,
    )
    .addOption(
      createCodexTimeoutDurationOption(
        "--codex-docs-timeout",
        "Override the per-attempt timeout for Codex document-title requests",
      ).conflicts("codexDocsTimeoutMs"),
    )
    .option(
      "--codex-docs-timeout-ms <ms>",
      "Deprecated millisecond-only document timeout; use --codex-docs-timeout",
      (value) => Number(value),
    )
    .option(
      "--codex-docs-retries <count>",
      "Retry count after the initial Codex document-title request, per batch",
      (value) => Number(value),
    )
    .option(
      "--codex-docs-batch-size <count>",
      "Number of documents per Codex document-title request batch",
      (value) => Number(value),
    );
}
