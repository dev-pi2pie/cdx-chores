import { constants } from "node:fs";
import { lstat, open, unlink, type FileHandle } from "node:fs/promises";

import {
  assertRunPath,
  assertRunRoot,
  removeRun,
  removeRunScratch,
  runPath,
  type RunContext,
} from "./run-context.ts";
import { refreshSummaryState, type InvocationSummary } from "./summary.ts";

export interface FinalizationHooks {
  /** Bounded failure seams for internal tests; these are never CLI options. */
  before?: (
    stage:
      | "initial-summary"
      | "scratch-cleanup"
      | "root-cleanup"
      | "final-summary"
      | "summary-close",
  ) => Promise<void>;
}
interface OwnedSummaryFile {
  handle: FileHandle;
  dev: number;
  ino: number;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function record(summary: InvocationSummary, stage: string, error: unknown): void {
  summary.errors.push(stage + ": " + message(error));
  refreshSummaryState(summary);
}

async function assertSummaryPath(context: RunContext, owned: OwnedSummaryFile): Promise<void> {
  assertRunPath(context, "results/summary.json");
  const current = await lstat(runPath(context, "results/summary.json"));
  if (
    !current.isFile() ||
    current.nlink !== 1 ||
    current.dev !== owned.dev ||
    current.ino !== owned.ino
  )
    throw new Error("Summary ownership changed; refusing to access it.");
}

async function assertSummaryFile(context: RunContext, owned: OwnedSummaryFile): Promise<void> {
  await assertSummaryPath(context, owned);
  const opened = await owned.handle.stat();
  if (
    !opened.isFile() ||
    opened.nlink !== 1 ||
    opened.dev !== owned.dev ||
    opened.ino !== owned.ino
  )
    throw new Error("Summary ownership changed; refusing to access it.");
}

async function writeSummary(
  context: RunContext,
  owned: OwnedSummaryFile,
  summary: InvocationSummary,
): Promise<void> {
  await assertSummaryFile(context, owned);
  const bytes = Buffer.from(JSON.stringify(summary, null, 2) + "\n");
  if (bytes.length > 8 * 1024 * 1024)
    throw new Error("Invocation summary exceeds its storage limit.");
  let offset = 0;
  while (offset < bytes.length) {
    await assertSummaryFile(context, owned);
    const { bytesWritten } = await owned.handle.write(bytes, offset, bytes.length - offset, offset);
    if (!bytesWritten) throw new Error("Summary write made no progress.");
    offset += bytesWritten;
  }
  await assertSummaryFile(context, owned);
  await owned.handle.truncate(bytes.length);
  await owned.handle.sync();
  await assertSummaryFile(context, owned);
}

/** All allocated namespaces must still be ours before any recursive removal. */
function assertNamespaces(context: RunContext, scratch: boolean): void {
  assertRunRoot(context);
  for (const path of Object.keys(context.directories)) {
    if (!path || (!scratch && (path === "scratch" || path.startsWith("scratch/")))) continue;
    assertRunPath(context, path);
  }
}

async function observeRemaining(
  context: RunContext,
  summary: InvocationSummary,
  safeToClean: boolean,
): Promise<boolean> {
  delete summary.remainingOwnedPath;
  delete summary.retainedResultsPath;
  try {
    await lstat(context.root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    record(summary, "Remaining run inspection failed", error);
    return false;
  }
  summary.remainingOwnedPath = context.root;
  try {
    assertRunRoot(context);
  } catch (error) {
    record(summary, "Remaining run ownership is unverified", error);
    return false;
  }
  let scratch = false;
  let scratchVerified = true;
  try {
    assertRunPath(context, "scratch");
    scratch = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      scratchVerified = false;
      record(summary, "Remaining scratch ownership is unverified", error);
    }
  }
  if (!scratch && scratchVerified && context.keepResults && safeToClean)
    delete summary.remainingOwnedPath;
  try {
    assertRunPath(context, "results");
    summary.retainedResultsPath = runPath(context, "results");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      record(summary, "Remaining results ownership is unverified", error);
  }
  return true;
}

/** Preserve every failure and only delete an owner whose work is verified stopped. */
export async function finalizeRun(
  context: RunContext,
  summary: InvocationSummary,
  safeToClean: boolean,
  hooks: FinalizationHooks = {},
): Promise<void> {
  let owned: OwnedSummaryFile | undefined;
  let stored = false;
  let scratchRemoved = false;
  let rootRemoved = false;
  delete summary.remainingOwnedPath;
  delete summary.retainedResultsPath;
  if (!safeToClean)
    record(
      summary,
      "Cleanup withheld",
      "Owned work or cleanup ownership remains unverified; scratch was retained.",
    );
  if (summary.keepResults !== context.keepResults) {
    record(
      summary,
      "Invalid finalization context",
      "Retention choice does not match its immutable run owner.",
    );
    summary.keepResults = context.keepResults;
  }
  refreshSummaryState(summary);
  try {
    try {
      assertRunPath(context, "results");
      const handle = await open(
        runPath(context, "results/summary.json"),
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
      let stat;
      try {
        stat = await handle.stat();
      } catch (error) {
        try {
          await handle.close();
        } catch (closeError) {
          throw new AggregateError([error, closeError], "Summary allocation and close failed.");
        }
        throw error;
      }
      owned = { handle, dev: stat.dev, ino: stat.ino };
      await hooks.before?.("initial-summary");
      // A crash before finalization finishes must not leave a passing summary behind.
      await writeSummary(context, owned, {
        ...summary,
        state: "failed",
        errors: [...summary.errors, "Finalization has not completed."],
      });
      stored = true;
    } catch (error) {
      record(summary, "Summary storage failed", error);
      if (owned) {
        try {
          await assertSummaryFile(context, owned);
          await unlink(runPath(context, "results/summary.json"));
        } catch (cleanupError) {
          record(summary, "Incomplete summary cleanup failed", cleanupError);
        }
      }
    }
    if (safeToClean) {
      try {
        await hooks.before?.("scratch-cleanup");
        assertNamespaces(context, true);
        await removeRunScratch(context);
        scratchRemoved = true;
      } catch (error) {
        record(summary, "Scratch cleanup failed", error);
      }
      if (!context.keepResults && scratchRemoved && stored) {
        try {
          await hooks.before?.("root-cleanup");
          assertNamespaces(context, false);
          await assertSummaryFile(context, owned!);
          await removeRun(context);
          rootRemoved = true;
        } catch (error) {
          record(summary, "Run cleanup failed", error);
        }
      }
    }
    await observeRemaining(context, summary, safeToClean);
    refreshSummaryState(summary);
    if (stored && !rootRemoved && summary.retainedResultsPath) {
      try {
        await hooks.before?.("final-summary");
        await writeSummary(context, owned!, summary);
      } catch (error) {
        record(summary, "Final summary update failed", error);
        // A partial final write must not survive as misleading or malformed output.
        try {
          await assertSummaryFile(context, owned!);
          await unlink(runPath(context, "results/summary.json"));
        } catch (cleanupError) {
          record(summary, "Incomplete summary cleanup failed", cleanupError);
        }
        await observeRemaining(context, summary, safeToClean);
      }
    }
  } catch (error) {
    record(summary, "Finalization failed", error);
  } finally {
    if (owned) {
      let closeFailed = false;
      try {
        await hooks.before?.("summary-close");
      } catch (error) {
        closeFailed = true;
        record(summary, "Summary storage close failed", error);
      }
      try {
        await owned.handle.close();
      } catch (error) {
        closeFailed = true;
        record(summary, "Summary storage close failed", error);
      }
      if (closeFailed && stored && summary.retainedResultsPath) {
        try {
          // The handle may already be closed: use fresh path identity, never reopen a replacement.
          await assertSummaryPath(context, owned);
          await unlink(runPath(context, "results/summary.json"));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            record(summary, "Summary removal after close failure failed", error);
            record(
              summary,
              "Persisted summary may be stale",
              "Its ownership or cleanup could not be verified.",
            );
          }
        }
        await observeRemaining(context, summary, safeToClean);
      }
    }
    refreshSummaryState(summary);
  }
}
