import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";

import { assertRunParent, assertRunPath, runPath, type RunContext } from "./run-context.ts";
import { validateJUnitReport, type JUnitSummary } from "./report-validation.ts";
import type { Suite } from "./selection.ts";

export interface ReportTicket {
  readonly path: string;
  readonly relativePath: string;
  readonly earliestMtimeMs: number;
}

/** A report must be absent immediately before its test process is launched. */
export async function prepareReport(context: RunContext, suite: Suite): Promise<ReportTicket> {
  if (!context.suites.includes(suite)) throw new Error("Report suite does not belong to this run.");
  const relativePath = "results/" + suite + ".junit.xml";
  const path = runPath(context, relativePath);
  assertRunParent(context, path);
  try {
    await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return Object.freeze({ path, relativePath, earliestMtimeMs: Date.now() });
  }
  throw new Error("Refusing a pre-existing test report: " + relativePath);
}

/** Consume one bounded, fresh, stable regular file without following symbolic links. */
export async function readReport(
  context: RunContext,
  ticket: ReportTicket,
  selected: readonly string[],
): Promise<JUnitSummary> {
  if (ticket.path !== runPath(context, ticket.relativePath))
    throw new Error("Invalid report owner.");
  assertRunPath(context, ticket.relativePath);
  const file = await open(ticket.path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    if (
      !before.isFile() ||
      before.nlink !== 1 ||
      before.size <= 0 ||
      before.size > 64 * 1024 * 1024
    ) {
      throw new Error("Test report must be a nonempty, bounded independent regular file.");
    }
    // Allow only sub-millisecond timestamp rounding, not an older invocation's report.
    if (before.mtimeMs < ticket.earliestMtimeMs - 1) throw new Error("Test report is stale.");
    const xml = await file.readFile("utf8");
    const after = await file.stat();
    assertRunPath(context, ticket.relativePath);
    const current = await lstat(ticket.path);
    if (
      before.dev !== current.dev ||
      before.ino !== current.ino ||
      after.nlink !== 1 ||
      current.nlink !== 1 ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      after.size !== current.size ||
      after.mtimeMs !== current.mtimeMs
    ) {
      throw new Error("Test report changed while being consumed.");
    }
    return validateJUnitReport(xml, selected);
  } finally {
    await file.close();
  }
}
