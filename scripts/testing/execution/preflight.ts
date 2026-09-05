import { startOwnedProcess, type OwnedProcessOptions, type OwnedProcessResult } from "./process.ts";

export interface PreflightSequence {
  preflight: Omit<OwnedProcessOptions, "signal">;
  execution: Omit<OwnedProcessOptions, "signal">;
  signal?: AbortSignal;
}

/** One prerequisite probe gates one command; reporting and suite selection live above this layer. */
export async function runAfterPreflight(options: PreflightSequence): Promise<{
  preflight: OwnedProcessResult;
  execution: OwnedProcessResult | null;
}> {
  const preflight = await startOwnedProcess({ ...options.preflight, signal: options.signal })
    .completion;
  if (!preflight.ok || options.signal?.aborted) return { preflight, execution: null };
  const execution = await startOwnedProcess({ ...options.execution, signal: options.signal })
    .completion;
  return { preflight, execution };
}
