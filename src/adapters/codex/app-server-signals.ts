const cancellationSignals = ["SIGHUP", "SIGINT", "SIGTERM"] as const;
type CancellationSignal = (typeof cancellationSignals)[number];
type CloseAppServer = () => Promise<void>;

const ownedServers = new Set<CloseAppServer>();
let cancelling = false;

const listeners = cancellationSignals.map((signal) => ({
  signal,
  handle: () => cancel(signal),
}));

function removeListeners(): void {
  for (const { signal, handle } of listeners) process.off(signal, handle);
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
    for (const { signal, handle } of listeners) process.prependListener(signal, handle);
  }
  ownedServers.add(close);
  return () => {
    ownedServers.delete(close);
    if (ownedServers.size === 0 && !cancelling) removeListeners();
  };
}
