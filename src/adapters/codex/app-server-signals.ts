type CancellationSignal = "SIGINT" | "SIGTERM";
type CloseAppServer = () => Promise<void>;

const ownedServers = new Set<CloseAppServer>();
let cancelling = false;

const interrupt = () => cancel("SIGINT");
const terminate = () => cancel("SIGTERM");

function removeListeners(): void {
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", terminate);
}

function cancel(signal: CancellationSignal): void {
  if (cancelling) return;
  const restoreDefault = process.listenerCount(signal) === 1;
  cancelling = true;
  void Promise.allSettled([...ownedServers].map((close) => close())).then(() => {
    removeListeners();
    // Preserve default termination after cleanup. Existing caller handlers own their outcome.
    if (restoreDefault && process.listenerCount(signal) === 0) {
      process.kill(process.pid, signal);
    } else {
      cancelling = false;
    }
  });
}

export function checkAppServerLaunchDuringCancellation(): void {
  if (cancelling) throw new Error("Codex app-server launch cancelled during shutdown.");
}

/** Keep isolated groups reachable while the caller handles a foreground signal. */
export function stopAppServerOnSignal(close: CloseAppServer): () => void {
  if (ownedServers.size === 0) {
    process.prependListener("SIGINT", interrupt);
    process.prependListener("SIGTERM", terminate);
  }
  ownedServers.add(close);
  return () => {
    ownedServers.delete(close);
    if (ownedServers.size === 0 && !cancelling) removeListeners();
  };
}
