import type { Command } from "commander";

import {
  actionRenameApply,
  actionRenameBatch,
  actionRenameCleanup,
  actionRenameFile,
} from "../actions";
import type {
  RenameCleanupConflictStrategy,
  RenameCleanupStyle,
  RenameCleanupTimestampAction,
} from "../actions/rename";
import { applyRenameTemplateOptions } from "../options/common";
import {
  collectCsvListOption,
  parseRenameCleanupConflictStrategyOption,
  parseRenameCleanupStyleOption,
  parseRenameCleanupTimestampActionOption,
} from "../options/parsers";
import type { CliRuntime } from "../types";
import type {
  RenameSerialOrder,
  RenameSerialScope,
  TimestampTimezone,
} from "../rename-template";

function configureRenameFileCommand(command: Command): Command {
  return applyRenameTemplateOptions(
    command
      .command("file")
      .description("Rename a single file")
      .argument("<path>", "Target file path")
      .option("--prefix <value>", "Filename prefix (optional)")
      .option("--dry-run", "Preview rename plan only", false)
      .option("--codex", "Auto-route eligible files to Codex analyzers by file type", false)
      .option(
        "--codex-images",
        "Use only the Codex image analyzer for supported static image files",
        false,
      )
      .option(
        "--codex-images-timeout-ms <ms>",
        "Codex image-title generation timeout per request in milliseconds",
        (value) => Number(value),
      )
      .option("--codex-images-retries <count>", "Retry failed Codex image-title requests", (value) =>
        Number(value),
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
      .option(
        "--codex-docs-timeout-ms <ms>",
        "Codex document-title generation timeout per request in milliseconds",
        (value) => Number(value),
      )
      .option("--codex-docs-retries <count>", "Retry failed Codex document-title requests", (value) =>
        Number(value),
      )
      .option(
        "--codex-docs-batch-size <count>",
        "Number of documents per Codex document-title request batch",
        (value) => Number(value),
      ),
  );
}

function configureRenameBatchLikeCommand(command: Command): Command {
  return applyRenameTemplateOptions(
    command
      .argument("<directory>", "Target directory")
      .option("--prefix <value>", "Filename prefix (optional)")
      .option("--profile <name>", "Preset file profile: all, images, media, docs")
      .option("--dry-run", "Preview rename plan only", false)
      .option("--preview-skips <mode>", "Skipped-item preview mode: summary or detailed")
      .option("--recursive", "Traverse subdirectories recursively", false)
      .option("--max-depth <value>", "Maximum recursive depth (root=0)", (value) => Number(value))
      .option("--match-regex <pattern>", "Only include files whose basename matches the regex")
      .option("--skip-regex <pattern>", "Exclude files whose basename matches the regex")
      .option(
        "--ext <value>",
        "Only include file extensions (repeatable or comma-separated)",
        collectCsvListOption,
        [],
      )
      .option(
        "--skip-ext <value>",
        "Exclude file extensions (repeatable or comma-separated)",
        collectCsvListOption,
        [],
      )
      .option("--codex", "Auto-route eligible files to Codex analyzers by file type", false)
      .option(
        "--codex-images",
        "Use only the Codex image analyzer for supported static image files",
        false,
      )
      .option(
        "--codex-images-timeout-ms <ms>",
        "Codex image-title generation timeout per request in milliseconds",
        (value) => Number(value),
      )
      .option(
        "--codex-images-retries <count>",
        "Retry failed Codex image-title requests (per batch)",
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
      .option(
        "--codex-docs-timeout-ms <ms>",
        "Codex document-title generation timeout per request in milliseconds",
        (value) => Number(value),
      )
      .option(
        "--codex-docs-retries <count>",
        "Retry failed Codex document-title requests (per batch)",
        (value) => Number(value),
      )
      .option(
        "--codex-docs-batch-size <count>",
        "Number of documents per Codex document-title request batch",
        (value) => Number(value),
      ),
  );
}

async function handleRenameBatchAction(
  runtime: CliRuntime,
  directory: string,
  options: {
    prefix?: string;
    pattern?: string;
    serialOrder?: RenameSerialOrder;
    serialStart?: number;
    serialWidth?: number;
    serialScope?: RenameSerialScope;
    timestampTimezone?: TimestampTimezone;
    profile?: string;
    dryRun?: boolean;
    previewSkips?: "summary" | "detailed";
    recursive?: boolean;
    maxDepth?: number;
    matchRegex?: string;
    skipRegex?: string;
    ext?: string[];
    skipExt?: string[];
    codex?: boolean;
    codexImages?: boolean;
    codexImagesTimeoutMs?: number;
    codexImagesRetries?: number;
    codexImagesBatchSize?: number;
    codexDocs?: boolean;
    codexDocsTimeoutMs?: number;
    codexDocsRetries?: number;
    codexDocsBatchSize?: number;
  },
): Promise<void> {
  await actionRenameBatch(runtime, {
    directory,
    prefix: options.prefix,
    pattern: options.pattern,
    serialOrder: options.serialOrder,
    serialStart: options.serialStart,
    serialWidth: options.serialWidth,
    serialScope: options.serialScope,
    timestampTimezone: options.timestampTimezone,
    profile: options.profile,
    dryRun: options.dryRun,
    previewSkips: options.previewSkips,
    recursive: options.recursive,
    maxDepth: options.maxDepth,
    matchRegex: options.matchRegex,
    skipRegex: options.skipRegex,
    ext: options.ext,
    skipExt: options.skipExt,
    codex: options.codex,
    codexImages: options.codexImages,
    codexImagesTimeoutMs: options.codexImagesTimeoutMs,
    codexImagesRetries: options.codexImagesRetries,
    codexImagesBatchSize: options.codexImagesBatchSize,
    codexDocs: options.codexDocs,
    codexDocsTimeoutMs: options.codexDocsTimeoutMs,
    codexDocsRetries: options.codexDocsRetries,
    codexDocsBatchSize: options.codexDocsBatchSize,
  });
}

export function registerRenameCommands(program: Command, runtime: CliRuntime): void {
  const renameCommand = program.command("rename").description("Rename helpers");

  configureRenameFileCommand(renameCommand).action(
    async (
      path: string,
      options: {
        prefix?: string;
        pattern?: string;
        serialOrder?: RenameSerialOrder;
        serialStart?: number;
        serialWidth?: number;
        serialScope?: RenameSerialScope;
        timestampTimezone?: TimestampTimezone;
        dryRun?: boolean;
        codex?: boolean;
        codexImages?: boolean;
        codexImagesTimeoutMs?: number;
        codexImagesRetries?: number;
        codexImagesBatchSize?: number;
        codexDocs?: boolean;
        codexDocsTimeoutMs?: number;
        codexDocsRetries?: number;
        codexDocsBatchSize?: number;
      },
    ) => {
      await actionRenameFile(runtime, {
        path,
        prefix: options.prefix,
        pattern: options.pattern,
        serialOrder: options.serialOrder,
        serialStart: options.serialStart,
        serialWidth: options.serialWidth,
        serialScope: options.serialScope,
        timestampTimezone: options.timestampTimezone,
        dryRun: options.dryRun,
        codex: options.codex,
        codexImages: options.codexImages,
        codexImagesTimeoutMs: options.codexImagesTimeoutMs,
        codexImagesRetries: options.codexImagesRetries,
        codexImagesBatchSize: options.codexImagesBatchSize,
        codexDocs: options.codexDocs,
        codexDocsTimeoutMs: options.codexDocsTimeoutMs,
        codexDocsRetries: options.codexDocsRetries,
        codexDocsBatchSize: options.codexDocsBatchSize,
      });
    },
  );

  configureRenameBatchLikeCommand(
    renameCommand.command("batch").description("Batch rename files in a directory"),
  ).action(
    async (
      directory: string,
      options: Parameters<typeof handleRenameBatchAction>[2],
    ) => {
      await handleRenameBatchAction(runtime, directory, options);
    },
  );

  renameCommand
    .command("cleanup")
    .description("Normalize existing filenames by explicit hint families")
    .argument("<path>", "Target file or directory path")
    .option(
      "--hint <value>",
      "Cleanup hint family (repeatable or comma-separated): date, timestamp, serial, uid",
      collectCsvListOption,
      [],
    )
    .option(
      "--hints <value>",
      "Alias for --hint (repeatable or comma-separated): date, timestamp, serial, uid",
      collectCsvListOption,
      [],
    )
    .option(
      "--style <value>",
      "Cleanup output style: preserve, slug",
      parseRenameCleanupStyleOption,
    )
    .option(
      "--timestamp-action <value>",
      "Timestamp fragment handling when --hint timestamp is active: keep or remove",
      parseRenameCleanupTimestampActionOption,
    )
    .option(
      "--conflict-strategy <value>",
      "Cleanup conflict strategy: skip, number, uid-suffix",
      parseRenameCleanupConflictStrategyOption,
    )
    .option("--dry-run", "Preview cleanup plan only", false)
    .option("--preview-skips <mode>", "Skipped-item preview mode: summary or detailed")
    .option("--recursive", "Traverse subdirectories recursively", false)
    .option("--max-depth <value>", "Maximum recursive depth (root=0)", (value) => Number(value))
    .option("--match-regex <pattern>", "Only include files whose basename matches the regex")
    .option("--skip-regex <pattern>", "Exclude files whose basename matches the regex")
    .option(
      "--ext <value>",
      "Only include file extensions (repeatable or comma-separated)",
      collectCsvListOption,
      [],
    )
    .option(
      "--skip-ext <value>",
      "Exclude file extensions (repeatable or comma-separated)",
      collectCsvListOption,
      [],
    )
    .action(
      async (
        path: string,
        options: {
          hint?: string[];
          hints?: string[];
          style?: RenameCleanupStyle;
          timestampAction?: RenameCleanupTimestampAction;
          conflictStrategy?: RenameCleanupConflictStrategy;
          dryRun?: boolean;
          previewSkips?: "summary" | "detailed";
          recursive?: boolean;
          maxDepth?: number;
          matchRegex?: string;
          skipRegex?: string;
          ext?: string[];
          skipExt?: string[];
        },
      ) => {
        await actionRenameCleanup(runtime, {
          path,
          hints: [...(options.hint ?? []), ...(options.hints ?? [])],
          style: options.style,
          timestampAction: options.timestampAction,
          conflictStrategy: options.conflictStrategy,
          dryRun: options.dryRun,
          previewSkips: options.previewSkips,
          recursive: options.recursive,
          maxDepth: options.maxDepth,
          matchRegex: options.matchRegex,
          skipRegex: options.skipRegex,
          ext: options.ext,
          skipExt: options.skipExt,
        });
      },
    );

  renameCommand
    .command("apply")
    .description("Apply a previously generated rename plan CSV")
    .argument("<csv>", "Rename plan CSV path")
    .option("--auto-clean", "Delete the plan CSV after a successful apply", false)
    .action(async (csv: string, options: { autoClean?: boolean }) => {
      await actionRenameApply(runtime, { csv, autoClean: options.autoClean });
    });

  configureRenameBatchLikeCommand(
    program.command("batch-rename").description("Alias for `rename batch`"),
  ).action(
    async (
      directory: string,
      options: Parameters<typeof handleRenameBatchAction>[2],
    ) => {
      await handleRenameBatchAction(runtime, directory, options);
    },
  );
}
