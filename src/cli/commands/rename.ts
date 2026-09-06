import type { Command } from "commander";

import { applyRenameCodexOptions, type RenameCodexCommandOptions } from "./rename/codex-options";
import { prepareRenameCodexTimeouts } from "./rename/codex-timeouts";
import { resolveCodexExecutionCommandOptions } from "../options/codex-execution-option";
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
import type { RenameSerialOrder, RenameSerialScope, TimestampTimezone } from "../rename-template";

interface RenameFileCommandOptions extends RenameCodexCommandOptions {
  prefix?: string;
  pattern?: string;
  serialOrder?: RenameSerialOrder;
  serialStart?: number;
  serialWidth?: number;
  serialScope?: RenameSerialScope;
  timestampTimezone?: TimestampTimezone;
  dryRun?: boolean;
}

interface RenameBatchCommandOptions extends RenameFileCommandOptions {
  profile?: string;
  previewSkips?: "summary" | "detailed";
  recursive?: boolean;
  maxDepth?: number;
  matchRegex?: string;
  skipRegex?: string;
  ext?: string[];
  skipExt?: string[];
}

interface RenameCommandActions {
  actionRenameApply: typeof actionRenameApply;
  actionRenameBatch: typeof actionRenameBatch;
  actionRenameCleanup: typeof actionRenameCleanup;
  actionRenameFile: typeof actionRenameFile;
}

const defaultRenameCommandActions: RenameCommandActions = {
  actionRenameApply,
  actionRenameBatch,
  actionRenameCleanup,
  actionRenameFile,
};

function configureRenameFileCommand(command: Command): Command {
  return applyRenameTemplateOptions(
    applyRenameCodexOptions(
      command
        .command("file")
        .description("Rename a single file")
        .argument("<path>", "Target file path")
        .option("--prefix <value>", "Filename prefix (optional)")
        .option("--dry-run", "Preview rename plan only", false),
    ),
  );
}

function configureRenameBatchLikeCommand(command: Command): Command {
  return applyRenameTemplateOptions(
    applyRenameCodexOptions(
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
        ),
    ),
  );
}

async function handleRenameBatchAction(
  runtime: CliRuntime,
  directory: string,
  options: RenameBatchCommandOptions,
  action: typeof actionRenameBatch,
): Promise<void> {
  const timeouts = prepareRenameCodexTimeouts(runtime, options);
  await action(runtime, {
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
    codexTimeoutMs: timeouts.codexTimeoutMs,
    codexExecution: resolveCodexExecutionCommandOptions(options),
    codexImages: options.codexImages,
    codexImagesTimeoutMs: timeouts.codexImagesTimeoutMs,
    codexImagesRetries: options.codexImagesRetries,
    codexImagesBatchSize: options.codexImagesBatchSize,
    codexDocs: options.codexDocs,
    codexDocsTimeoutMs: timeouts.codexDocsTimeoutMs,
    codexDocsRetries: options.codexDocsRetries,
    codexDocsBatchSize: options.codexDocsBatchSize,
  });
}

export function registerRenameCommands(
  program: Command,
  runtime: CliRuntime,
  actions: RenameCommandActions = defaultRenameCommandActions,
): void {
  const renameCommand = program.command("rename").description("Rename helpers");

  configureRenameFileCommand(renameCommand).action(
    async (path: string, options: RenameFileCommandOptions) => {
      const timeouts = prepareRenameCodexTimeouts(runtime, options);
      await actions.actionRenameFile(runtime, {
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
        codexTimeoutMs: timeouts.codexTimeoutMs,
        codexExecution: resolveCodexExecutionCommandOptions(options),
        codexImages: options.codexImages,
        codexImagesTimeoutMs: timeouts.codexImagesTimeoutMs,
        codexImagesRetries: options.codexImagesRetries,
        codexImagesBatchSize: options.codexImagesBatchSize,
        codexDocs: options.codexDocs,
        codexDocsTimeoutMs: timeouts.codexDocsTimeoutMs,
        codexDocsRetries: options.codexDocsRetries,
        codexDocsBatchSize: options.codexDocsBatchSize,
      });
    },
  );

  configureRenameBatchLikeCommand(
    renameCommand.command("batch").description("Batch rename files in a directory"),
  ).action(async (directory: string, options: RenameBatchCommandOptions) => {
    await handleRenameBatchAction(runtime, directory, options, actions.actionRenameBatch);
  });

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
        await actions.actionRenameCleanup(runtime, {
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
      await actions.actionRenameApply(runtime, { csv, autoClean: options.autoClean });
    });

  configureRenameBatchLikeCommand(
    program.command("batch-rename").description("Alias for `rename batch`"),
  ).action(async (directory: string, options: RenameBatchCommandOptions) => {
    await handleRenameBatchAction(runtime, directory, options, actions.actionRenameBatch);
  });
}
