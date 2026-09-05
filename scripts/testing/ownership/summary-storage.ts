import { lstat, type FileHandle } from "node:fs/promises";

import { assertRunPath, runPath, type RunContext } from "./run-context.ts";
import type { InvocationSummary } from "../terminal/summary.ts";

export interface SummaryIdentity {
  readonly dev: number;
  readonly ino: number;
  readonly birthtimeMs: number;
}
export interface OwnedSummaryFile extends SummaryIdentity {
  readonly handle: FileHandle;
}

export async function assertSummaryPath(
  context: RunContext,
  owned: SummaryIdentity,
): Promise<void> {
  assertRunPath(context, "results/summary.json");
  const current = await lstat(runPath(context, "results/summary.json"));
  if (
    !current.isFile() ||
    current.nlink !== 1 ||
    current.dev !== owned.dev ||
    current.ino !== owned.ino ||
    current.birthtimeMs !== owned.birthtimeMs
  )
    throw new Error("Summary ownership changed; refusing to access it.");
}

export async function assertSummaryFile(
  context: RunContext,
  owned: OwnedSummaryFile,
): Promise<void> {
  await assertSummaryPath(context, owned);
  const opened = await owned.handle.stat();
  if (
    !opened.isFile() ||
    opened.nlink !== 1 ||
    opened.dev !== owned.dev ||
    opened.ino !== owned.ino ||
    opened.birthtimeMs !== owned.birthtimeMs
  )
    throw new Error("Summary ownership changed; refusing to access it.");
}

export async function writeSummary(
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
