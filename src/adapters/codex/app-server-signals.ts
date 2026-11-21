type Owner = { close: () => Promise<void>; acceptHangup?: () => boolean };
type CancellationSignal = "SIGHUP" | "SIGINT" | "SIGTERM";

const hangupOwners = new Set<Owner>();
const interruptOwners = new Set<Owner>();
const closing = new Set<Owner>();
let defaultSignal: CancellationSignal | undefined;

function listener(signal: CancellationSignal, owners: Set<Owner>) {
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

function cancel(signal: CancellationSignal, owners: Set<Owner>): void {
  const wouldTerminate = !closing.size && process.listenerCount(signal) === 1;
  // Default termination ends ownership of every group in this process.
  const candidates = [...(wouldTerminate ? hangupOwners : owners)].filter(
    (owner) => !closing.has(owner),
  );
  const targets = candidates.filter(
    (owner) => signal !== "SIGHUP" || owner.acceptHangup?.() !== false,
  );
  if (!targets.length) return;
  // A caller already handling INT/TERM keeps its initiating disposition.
  if (wouldTerminate && targets.length === candidates.length) defaultSignal = signal;
  for (const owner of targets) closing.add(owner);
  void Promise.allSettled(targets.map((owner) => owner.close())).then(() => {
    for (const owner of targets) closing.delete(owner);
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
  close: () => Promise<void>,
  acceptHangup?: () => boolean,
): () => void {
  const owner = { close, acceptHangup };
  hangupOwners.add(owner);
  if (!acceptHangup) interruptOwners.add(owner);
  updateListeners();
  return () => {
    hangupOwners.delete(owner);
    interruptOwners.delete(owner);
    if (!closing.size) updateListeners();
  };
}
