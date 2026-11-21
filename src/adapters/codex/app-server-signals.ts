type CloseAppServer = () => Promise<void>;
type CancellationSignal = "SIGHUP" | "SIGINT" | "SIGTERM";

const hangupOwners = new Set<CloseAppServer>();
const interruptOwners = new Set<CloseAppServer>();
const closing = new Set<CloseAppServer>();
let defaultSignal: CancellationSignal | undefined;

function listener(signal: CancellationSignal, owners: Set<CloseAppServer>) {
  return { signal, owners, handle: () => cancel(signal, owners) };
}

const listeners = [
  listener("SIGHUP", hangupOwners),
  listener("SIGINT", interruptOwners),
  listener("SIGTERM", interruptOwners),
];

function updateListeners(): void {
  for (const { signal, owners, handle } of listeners) {
    if (!owners.size) process.off(signal, handle);
    else if (!process.listeners(signal).includes(handle)) process.prependListener(signal, handle);
  }
}

function cancel(signal: CancellationSignal, owners: Set<CloseAppServer>): void {
  const targets = [...owners].filter((close) => !closing.has(close));
  if (!targets.length) return;
  // The first signal owns the exit policy, even if another arrives during escalation.
  if (!closing.size && process.listenerCount(signal) === 1) defaultSignal = signal;
  for (const close of targets) closing.add(close);
  void Promise.allSettled(targets.map((close) => close())).then(() => {
    for (const close of targets) closing.delete(close);
    if (closing.size) return;
    updateListeners();
    if (defaultSignal && process.listenerCount(defaultSignal) === 0) {
      process.kill(process.pid, defaultSignal);
    } else {
      defaultSignal = undefined;
    }
  });
}

export function checkAppServerLaunchDuringCancellation(): void {
  if (closing.size || defaultSignal)
    throw new Error("Codex app-server launch cancelled during shutdown.");
}

/** Benchmark callers handle INT and TERM themselves so they can interrupt an active turn. */
export function stopAppServerOnSignal(
  close: CloseAppServer,
  signals: "all" | "hangup" = "all",
): () => void {
  hangupOwners.add(close);
  if (signals === "all") interruptOwners.add(close);
  updateListeners();
  return () => {
    hangupOwners.delete(close);
    interruptOwners.delete(close);
    if (!closing.size) updateListeners();
  };
}
