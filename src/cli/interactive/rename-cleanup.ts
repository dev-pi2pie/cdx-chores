import { rm } from "node:fs/promises";

import { confirm, input, select } from "@inquirer/prompts";

import {
  actionRenameApply,
  actionRenameCleanup,
  collectRenameCleanupAnalyzerEvidence,
  resolveRenameCleanupTarget,
  suggestRenameCleanupWithCodex,
  writeRenameCleanupAnalysisCsv,
} from "../actions";
import { displayPath, printLine } from "../actions/shared";
import { promptRequiredPathWithConfig } from "../prompts/path";
import type { CliRuntime } from "../types";
import type {
  RenameCleanupConflictStrategy,
  RenameCleanupHint,
  RenameCleanupOptions,
  RenameCleanupStyle,
  RenameCleanupTimestampAction,
} from "../actions";
import { createInteractiveAnalyzerStatus } from "./analyzer-status";
import type { InteractivePathPromptContext } from "./shared";

const INTERACTIVE_CLEANUP_HINT_CHOICES: Array<{
  name: string;
  value: RenameCleanupHint;
  description: string;
}> = [
  {
    name: "timestamp",
    value: "timestamp",
    description: "Date-plus-time fragments such as macOS screenshot timestamps",
  },
  { name: "date", value: "date", description: "Date-only fragments such as 2026-03-03" },
  { name: "serial", value: "serial", description: "Trailing counters such as (2), -01, or _003" },
  { name: "uid", value: "uid", description: "Existing uid-<token> fragments" },
];

function parseInteractiveCsvList(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
}

async function promptInteractiveCleanupHints(): Promise<RenameCleanupHint[]> {
  const selected: RenameCleanupHint[] = [];

  while (true) {
    const remainingChoices = INTERACTIVE_CLEANUP_HINT_CHOICES.filter(
      (choice) => !selected.includes(choice.value),
    );
    const choice = await select<RenameCleanupHint | "done">({
      message: selected.length === 0 ? "Add a cleanup hint" : "Add another cleanup hint or finish",
      choices: [
        ...remainingChoices,
        ...(selected.length > 0
          ? [
              {
                name: "done",
                value: "done" as const,
                description: `Selected: ${selected.join(", ")}`,
              },
            ]
          : []),
      ],
    });

    if (choice === "done") {
      return selected;
    }

    selected.push(choice);
  }
}

async function promptCleanupStyle(): Promise<RenameCleanupStyle> {
  return select<RenameCleanupStyle>({
    message: "Cleanup output style",
    choices: [
      {
        name: "preserve",
        value: "preserve",
        description: "Keep readable spacing while normalizing matched fragments",
      },
      {
        name: "slug",
        value: "slug",
        description: "Convert the remaining text to kebab-case",
      },
    ],
    default: "preserve",
  });
}

async function promptCleanupTimestampAction(): Promise<RenameCleanupTimestampAction> {
  return select<RenameCleanupTimestampAction>({
    message: "Timestamp fragment handling",
    choices: [
      {
        name: "keep",
        value: "keep",
        description: "Keep matched timestamps in normalized form",
      },
      {
        name: "remove",
        value: "remove",
        description: "Remove matched timestamps from the basename",
      },
    ],
    default: "keep",
  });
}

async function promptManualCleanupSettings(): Promise<{
  hints: RenameCleanupHint[];
  style: RenameCleanupStyle;
  timestampAction?: RenameCleanupTimestampAction;
}> {
  const hints = await promptInteractiveCleanupHints();
  const style = await promptCleanupStyle();
  const timestampAction = hints.includes("timestamp")
    ? await promptCleanupTimestampAction()
    : undefined;
  return { hints, style, timestampAction };
}

async function promptCleanupScopeOptions(pathKind: "file" | "directory"): Promise<
  Pick<
    RenameCleanupOptions,
    "recursive" | "maxDepth" | "matchRegex" | "skipRegex" | "ext" | "skipExt"
  >
> {
  const recursive =
    pathKind === "directory"
      ? await confirm({
          message: "Traverse subdirectories recursively?",
          default: false,
        })
      : false;
  const maxDepthInput =
    pathKind === "directory" && recursive
      ? await input({ message: "Max recursive depth (optional, root=0)", default: "" })
      : "";
  const filterFiles =
    pathKind === "directory"
      ? await confirm({
          message: "Filter files before cleanup?",
          default: false,
        })
      : false;
  const matchRegex =
    pathKind === "directory" && filterFiles
      ? await input({ message: "Match regex (optional)", default: "" })
      : "";
  const skipRegex =
    pathKind === "directory" && filterFiles
      ? await input({ message: "Skip regex (optional)", default: "" })
      : "";
  const extInput =
    pathKind === "directory" && filterFiles
      ? await input({
          message: "Only extensions (optional, comma-separated)",
          default: "",
        })
      : "";
  const skipExtInput =
    pathKind === "directory" && filterFiles
      ? await input({
          message: "Skip extensions (optional, comma-separated)",
          default: "",
        })
      : "";

  return {
    recursive: pathKind === "directory" ? recursive : undefined,
    maxDepth: maxDepthInput.trim() ? Number(maxDepthInput.trim()) : undefined,
    matchRegex: matchRegex.trim() ? matchRegex.trim() : undefined,
    skipRegex: skipRegex.trim() ? skipRegex.trim() : undefined,
    ext: parseInteractiveCsvList(extInput),
    skipExt: parseInteractiveCsvList(skipExtInput),
  };
}

function printCleanupCodexSuggestion(
  runtime: CliRuntime,
  options: {
    hints: RenameCleanupHint[];
    style: RenameCleanupStyle;
    timestampAction?: RenameCleanupTimestampAction;
    confidence: number;
    reasoningSummary: string;
  },
): void {
  printLine(runtime.stdout, "Codex cleanup suggestion:");
  printLine(runtime.stdout, `- hints: ${options.hints.join(", ")}`);
  printLine(runtime.stdout, `- style: ${options.style}`);
  if (options.timestampAction) {
    printLine(runtime.stdout, `- timestamp action: ${options.timestampAction}`);
  }
  printLine(runtime.stdout, `- confidence: ${Math.round(options.confidence * 100)}%`);
  printLine(runtime.stdout, `- reasoning: ${options.reasoningSummary}`);
  printLine(runtime.stdout);
}

async function promptCleanupSettingsFromSuggestion(
  runtime: CliRuntime,
  options: {
    path: string;
    scope: Pick<
      RenameCleanupOptions,
      "recursive" | "maxDepth" | "matchRegex" | "skipRegex" | "ext" | "skipExt"
    >;
  },
): Promise<
  | {
      hints: RenameCleanupHint[];
      style: RenameCleanupStyle;
      timestampAction?: RenameCleanupTimestampAction;
      analysisReportPath?: string;
    }
  | undefined
> {
  const status = createInteractiveAnalyzerStatus(runtime.stdout);
  try {
    status.start("Sampling filenames for cleanup analysis...");
    const evidence = await collectRenameCleanupAnalyzerEvidence(runtime, {
      path: options.path,
      ...options.scope,
      onProgress: (phase) => {
        if (phase === "grouping") {
          status.update("Grouping filename patterns for cleanup analysis...");
        }
      },
    });
    status.wait("Waiting for Codex cleanup suggestions...");
    const result = await suggestRenameCleanupWithCodex({
      evidence,
      workingDirectory: runtime.cwd,
    });
    status.stop();

    if (!result.suggestion) {
      if (result.errorMessage) {
        printLine(runtime.stdout, `Codex cleanup suggestion unavailable: ${result.errorMessage}`);
        printLine(runtime.stdout, "Falling back to manual cleanup settings.");
        printLine(runtime.stdout);
      }
      return undefined;
    }

    printCleanupCodexSuggestion(runtime, {
      hints: result.suggestion.recommendedHints,
      style: result.suggestion.recommendedStyle,
      timestampAction: result.suggestion.recommendedTimestampAction,
      confidence: result.suggestion.confidence,
      reasoningSummary: result.suggestion.reasoningSummary,
    });

    const writeAnalysisReport = await confirm({
      message: "Write grouped cleanup analysis report CSV?",
      default: false,
    });
    let analysisReportPath: string | undefined;
    if (writeAnalysisReport) {
      analysisReportPath = await writeRenameCleanupAnalysisCsv(runtime, {
        evidence,
        suggestion: result.suggestion,
      });
      printLine(
        runtime.stdout,
        `Wrote cleanup analysis report: ${displayPath(runtime, analysisReportPath)}`,
      );
      printLine(runtime.stdout);
    }

    const useSuggestion = await confirm({
      message: "Use these suggested cleanup settings?",
      default: true,
    });
    if (!useSuggestion) {
      return undefined;
    }

    return {
      hints: result.suggestion.recommendedHints,
      style: result.suggestion.recommendedStyle,
      timestampAction: result.suggestion.recommendedTimestampAction,
      analysisReportPath,
    };
  } catch (error) {
    status.stop();
    const message = error instanceof Error ? error.message : String(error);
    printLine(runtime.stdout, `Codex cleanup suggestion unavailable: ${message}`);
    printLine(runtime.stdout, "Falling back to manual cleanup settings.");
    printLine(runtime.stdout);
    return undefined;
  }
}

async function promptCleanupConflictStrategy(): Promise<RenameCleanupConflictStrategy> {
  return select<RenameCleanupConflictStrategy>({
    message: "Cleanup conflict strategy",
    choices: [
      {
        name: "skip",
        value: "skip",
        description: "Keep the clean target when free and skip only the conflicted rows",
      },
      {
        name: "number",
        value: "number",
        description: "Append -1, -2, -3 only when the cleaned target conflicts",
      },
      {
        name: "uid-suffix",
        value: "uid-suffix",
        description: "Append -uid-<token> only when the cleaned target conflicts",
      },
    ],
    default: "skip",
  });
}

export async function runInteractiveRenameCleanup(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  const path = await promptRequiredPathWithConfig("Target path", {
    kind: "path",
    ...pathPromptContext,
  });
  const target = await resolveRenameCleanupTarget(runtime, path);
  const scope = await promptCleanupScopeOptions(target.kind);

  const suggestWithCodex = await confirm({
    message: "Suggest cleanup hints with Codex?",
    default: false,
  });
  const suggestedSettings = suggestWithCodex
    ? await promptCleanupSettingsFromSuggestion(runtime, { path, scope })
    : undefined;
  const cleanupSettings = suggestedSettings ?? (await promptManualCleanupSettings());
  const cleanupActionSettings = {
    hints: cleanupSettings.hints,
    style: cleanupSettings.style,
    timestampAction: cleanupSettings.timestampAction,
  };
  const analysisReportPath = suggestedSettings?.analysisReportPath;

  const conflictStrategy = await promptCleanupConflictStrategy();
  const dryRun = await confirm({ message: "Dry run only?", default: true });
  const previewSkips =
    target.kind === "directory" && dryRun
      ? await select<"summary" | "detailed">({
          message: "Skipped-item preview mode",
          choices: [
            {
              name: "summary",
              value: "summary",
              description: "Compact skipped summary grouped by reason",
            },
            {
              name: "detailed",
              value: "detailed",
              description: "Show skipped summary plus bounded per-item skipped rows",
            },
          ],
          default: "summary",
        })
      : undefined;

  const result = await actionRenameCleanup(runtime, {
    path,
    ...cleanupActionSettings,
    conflictStrategy,
    ...scope,
    dryRun,
    previewSkips,
  });

  const hasChanges = result.kind === "file" ? result.changed : result.changedCount > 0;
  if (!dryRun || !hasChanges || !result.planCsvPath) {
    return;
  }

  const applyNow = await confirm({ message: "Apply these renames now?", default: false });
  if (applyNow) {
    const autoClean = await confirm({
      message: analysisReportPath
        ? "Auto-clean plan/report CSV after apply?"
        : "Auto-clean plan CSV after apply?",
      default: true,
    });
    await actionRenameApply(runtime, { csv: result.planCsvPath, autoClean });
    if (autoClean && analysisReportPath) {
      await rm(analysisReportPath, { force: true });
      printLine(
        runtime.stdout,
        `Cleanup analysis report auto-cleaned: ${displayPath(runtime, analysisReportPath)}`,
      );
    }
  }
}
