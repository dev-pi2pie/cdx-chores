import { constants } from "node:fs";
import { lstat, open, unlink } from "node:fs/promises";

import {
  assertRunPath,
  assertRunRoot,
  removeRun,
  removeRunScratch,
  runPath,
  type RunContext,
} from "./run-context.ts";
import { refreshSummaryState, type InvocationSummary } from "../terminal/summary.ts";
import {
  assertSummaryFile,
  assertSummaryPath,
  writeSummary,
  type OwnedSummaryFile,
  type SummaryIdentity,
} from "./summary-storage.ts";

export interface FinalizationHooks {
  /** Bounded failure seams for internal tests; these are never CLI options. */
  before?: (
    stage:
      | "initial-summary"
      | "scratch-cleanup"
      | "root-cleanup"
      | "final-summary"
      | "summary-close"
      | "recovery-open"
      | "recovery-write"
      | "recovery-close",
  ) => Promise<void>;
}

function message(error: unknown): string {
  if (error instanceof AggregateError)
    return [error.message, ...error.errors.map(message)].join("; ");
  return error instanceof Error ? error.message : String(error);
}
function record(summary: InvocationSummary, stage: string, error: unknown): void {
  summary.errors.push(stage + ": " + message(error));
  refreshSummaryState(summary);
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
): Promise<FinalizationReceipt | undefined> {
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
      owned = { handle, dev: stat.dev, ino: stat.ino, birthtimeMs: stat.birthtimeMs };
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
  if (!owned || !stored || !summary.retainedResultsPath) return undefined;
  try {
    await assertSummaryPath(context, owned);
    return failureReceipt(
      context,
      summary,
      { dev: owned.dev, ino: owned.ino, birthtimeMs: owned.birthtimeMs },
      safeToClean,
      hooks,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      record(summary, "Summary recovery ownership is unavailable", error);
      record(
        summary,
        "Persisted summary may be stale",
        "Its ownership could not be verified after finalization.",
      );
      await observeRemaining(context, summary, safeToClean);
    }
    return undefined;
  }
}

/** No open handle survives finalization; this receipt can only update the file we created. */
export interface FinalizationReceipt {
  persistFailure(): Promise<void>;
}

function failureReceipt(
  context: RunContext,
  summary: InvocationSummary,
  identity: SummaryIdentity,
  safeToClean: boolean,
  hooks: FinalizationHooks,
): FinalizationReceipt {
  let pending = Promise.resolve();
  return Object.freeze({
    persistFailure: () => {
      pending = pending.then(() => persistFailure(context, summary, identity, safeToClean, hooks));
      return pending;
    },
  });
}

async function persistFailure(
  context: RunContext,
  summary: InvocationSummary,
  identity: SummaryIdentity,
  safeToClean: boolean,
  hooks: FinalizationHooks,
): Promise<void> {
  let opened: OwnedSummaryFile | undefined;
  let failed = false;
  refreshSummaryState(summary);
  if (summary.state !== "failed")
    record(summary, "Failure persistence", "Recovery requires an existing invocation failure.");
  try {
    await observeRemaining(context, summary, safeToClean);
    await hooks.before?.("recovery-open");
    await assertSummaryPath(context, identity);
    const handle = await open(
      runPath(context, "results/summary.json"),
      constants.O_WRONLY | constants.O_NOFOLLOW,
    );
    opened = { ...identity, handle };
    await assertSummaryFile(context, opened);
    await hooks.before?.("recovery-write");
    await writeSummary(context, opened, summary);
  } catch (error) {
    // A removed file or run stays removed; failure recovery never allocates output.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      failed = true;
      record(summary, "Failure summary persistence failed", error);
    }
  } finally {
    if (opened) {
      try {
        await hooks.before?.("recovery-close");
      } catch (error) {
        failed = true;
        record(summary, "Failure summary close failed", error);
      }
      try {
        await opened.handle.close();
      } catch (error) {
        failed = true;
        record(summary, "Failure summary close failed", error);
      }
    }
    if (failed) {
      try {
        await assertSummaryPath(context, identity);
        await unlink(runPath(context, "results/summary.json"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          record(summary, "Failure summary removal failed", error);
          record(
            summary,
            "Persisted summary may be stale",
            "Its ownership or cleanup could not be verified.",
          );
        }
      }
    }
    await observeRemaining(context, summary, safeToClean);
    refreshSummaryState(summary);
  }
}
