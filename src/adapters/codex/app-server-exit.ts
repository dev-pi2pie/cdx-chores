import type { ChildProcessWithoutNullStreams } from "node:child_process";

const stdoutDrainMs = 100;

export class CodexAppServerTransportClosedError extends Error {}

/** A descendant can keep stdout open after the process that owns the protocol exits. */
export function observeAppServerExit(
  child: ChildProcessWithoutNullStreams,
  signal: AbortSignal,
  stop: (error: Error) => void,
  stdoutEndMessage = "Codex app-server stdout ended unexpectedly.",
) {
  const stdoutEnded = new CodexAppServerTransportClosedError(stdoutEndMessage);
  let exitError: CodexAppServerTransportClosedError | undefined;
  let drain: ReturnType<typeof setTimeout> | undefined;

  const finish = () => {
    if (!signal.aborted) stop(exitError ?? stdoutEnded);
  };
  child.once("exit", (code, exitSignal) => {
    exitError = new CodexAppServerTransportClosedError(
      `Codex app-server stopped with ${exitSignal ?? `exit code ${code}`}.`,
    );
    // Let final protocol frames arrive before rejecting pending requests.
    if (!signal.aborted) drain = setTimeout(finish, stdoutDrainMs);
  });
  child.stdout.once("end", finish);
  signal.addEventListener("abort", () => clearTimeout(drain), { once: true });

  return {
    get error() {
      return exitError;
    },
    get reason(): unknown {
      const reason = signal.reason;
      // The exit status may become available shortly after stdout EOF.
      return exitError && (reason === undefined || reason === stdoutEnded) ? exitError : reason;
    },
    throwIfStopped() {
      if (exitError) throw exitError;
      signal.throwIfAborted();
    },
  };
}
