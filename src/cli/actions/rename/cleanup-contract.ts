import type { CleanupHint } from "./cleanup-matchers";

export type RenameCleanupStyle = "preserve" | "slug";
export type RenameCleanupTimestampAction = "keep" | "remove";
export type RenameCleanupConflictStrategy = "skip" | "number" | "uid-suffix";
export type RenameCleanupHint = CleanupHint;

export interface RenameCleanupOptions {
  path: string;
  hints: string[];
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
}

export type RenameCleanupResult =
  | {
      kind: "file";
      changed: boolean;
      filePath: string;
      directoryPath: string;
      planCsvPath?: string;
    }
  | {
      kind: "directory";
      changedCount: number;
      totalCount: number;
      directoryPath: string;
      planCsvPath?: string;
    };
