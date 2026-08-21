import { Option, type Command } from "commander";

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
  RenameFileOptions,
} from "../actions/rename";
import {
  formatLegacyCodexTimeoutNotice,
  parseUniqueCodexTimeoutDuration,
  resolveCodexTimeout,
} from "../options/codex-timeout";
import type { LegacyCodexTimeoutMigration } from "../options/codex-timeout";
import { applyRenameTemplateOptions } from "../options/common";
import {
  collectCsvListOption,
  parseRenameCleanupConflictStrategyOption,
  parseRenameCleanupStyleOption,
  parseRenameCleanupTimestampActionOption,
} from "../options/parsers";
import type { CliRuntime } from "../types";
import type { RenameSerialOrder, RenameSerialScope, TimestampTimezone } from "../rename-template";

interface RenameCodexCommandOptions {
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

function createCodexTimeoutOption(optionName: string, description: string): Option {
  return new Option(`${optionName} <duration>`, description).argParser<number | undefined>(
    (value, previous) => parseUniqueCodexTimeoutDuration(value, previous, optionName),
  );
}

function applyRenameCodexOptions(command: Command): Command {
  return command
    .option("--codex", "Auto-route eligible files to Codex analyzers by file type", false)
    .addOption(
      createCodexTimeoutOption(
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
      createCodexTimeoutOption(
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
      createCodexTimeoutOption(
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

interface ResolvedRenameAnalyzerCodexTimeout {
  actionTimeoutMs?: number;
  migration?: LegacyCodexTimeoutMigration;
}

function resolveRenameAnalyzerCodexTimeout(options: {
  scopedTimeoutMs?: number;
  scopedOptionName: string;
  legacyScopedTimeoutMs?: number;
  legacyScopedOptionName: string;
}): ResolvedRenameAnalyzerCodexTimeout {
  const resolved = resolveCodexTimeout({
    scopedTimeoutMs: options.scopedTimeoutMs,
    scopedOptionName: options.scopedOptionName,
    legacyScopedTimeoutMs: options.legacyScopedTimeoutMs,
    legacyScopedOptionName: options.legacyScopedOptionName,
  });
  return {
    actionTimeoutMs: resolved.source === "default" ? undefined : resolved.timeoutMs,
    migration:
      options.legacyScopedTimeoutMs === undefined
        ? undefined
        : {
            legacyOptionName: options.legacyScopedOptionName,
            replacementOptionName: options.scopedOptionName,
            timeoutMs: options.legacyScopedTimeoutMs,
          },
  };
}

function resolveRenameCodexTimeouts(options: RenameCodexCommandOptions): {
  timeouts: Pick<
    RenameFileOptions,
    "codexTimeoutMs" | "codexImagesTimeoutMs" | "codexDocsTimeoutMs"
  >;
  notice?: string;
} {
  const image = resolveRenameAnalyzerCodexTimeout({
    scopedTimeoutMs: options.codexImagesTimeout,
    scopedOptionName: "--codex-images-timeout",
    legacyScopedTimeoutMs: options.codexImagesTimeoutMs,
    legacyScopedOptionName: "--codex-images-timeout-ms",
  });
  const document = resolveRenameAnalyzerCodexTimeout({
    scopedTimeoutMs: options.codexDocsTimeout,
    scopedOptionName: "--codex-docs-timeout",
    legacyScopedTimeoutMs: options.codexDocsTimeoutMs,
    legacyScopedOptionName: "--codex-docs-timeout-ms",
  });
  const migrations = [image.migration, document.migration].filter(
    (migration): migration is LegacyCodexTimeoutMigration => migration !== undefined,
  );

  return {
    timeouts: {
      codexTimeoutMs: options.codexTimeout,
      codexImagesTimeoutMs: image.actionTimeoutMs,
      codexDocsTimeoutMs: document.actionTimeoutMs,
    },
    notice: formatLegacyCodexTimeoutNotice(migrations),
  };
}

function prepareRenameCodexTimeouts(
  runtime: CliRuntime,
  options: RenameCodexCommandOptions,
): Pick<RenameFileOptions, "codexTimeoutMs" | "codexImagesTimeoutMs" | "codexDocsTimeoutMs"> {
  const resolved = resolveRenameCodexTimeouts(options);
  if (resolved.notice) {
    runtime.stderr.write(resolved.notice);
  }
  return resolved.timeouts;
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
