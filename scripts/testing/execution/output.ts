import type { Readable, Writable } from "node:stream";

export type OutputChannel = "stdout" | "stderr";

export interface OutputDestinations {
  stdout: Writable;
  stderr: Writable;
}

/** Internal seams for deterministic failure tests; these are not CLI flags. */
export interface OutputLimits {
  maxPendingBytes?: number;
  stallMs?: number;
  drainMs?: number;
}

export interface OutputSnapshot {
  failed: boolean;
  incomplete: boolean;
  observedBytes: number;
  writtenBytes: number;
  pendingBytes: number;
  peakPendingBytes: number;
  fallbackAttempted: boolean;
}

export interface OutputDelivery {
  readonly signal: AbortSignal;
  readonly failed: boolean;
  readonly issues: readonly string[];
  write(channel: OutputChannel, chunk: Buffer | string, source?: Readable): void;
  flush(sources?: readonly Readable[]): Promise<boolean>;
  snapshot(): OutputSnapshot;
  fallback(text: string): Promise<void>;
  dispose(): void;
}

interface DestinationState {
  destination: Writable;
  label: string;
  pendingBytes: number;
  blocked: boolean;
  broken: boolean;
  sources: Set<Readable>;
  timer?: ReturnType<typeof setTimeout>;
  onDrain: () => void;
  onError: (error: unknown) => void;
  onClose: () => void;
}

/**
 * Deliver original bytes through caller-owned streams. The pending budget includes
 * writes already handed to Writable until their callbacks acknowledge delivery.
 * This module never ends or destroys destinations and never stores output bytes.
 */
export function createOutputDelivery(
  destinations: OutputDestinations,
  limits: OutputLimits = {},
): OutputDelivery {
  const maximum = limits.maxPendingBytes ?? 1024 * 1024;
  const stallMs = limits.stallMs ?? 4000;
  const drainMs = limits.drainMs ?? 4000;
  for (const value of [maximum, stallMs, drainMs]) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error("Invalid output delivery limit.");
  }
  const controller = new AbortController();
  const issues: string[] = [];
  const states = new Map<Writable, DestinationState>();
  const waiters = new Set<() => void>();
  const fallbackWaiters = new Set<() => void>();
  let failed = false;
  let disposed = false;
  let observedBytes = 0;
  let writtenBytes = 0;
  let pendingBytes = 0;
  let peakPendingBytes = 0;
  let fallbackAttempted = false;

  const releaseSources = (state: DestinationState) => {
    for (const source of state.sources) {
      try {
        source.resume();
      } catch {
        // A destroyed producer must not prevent cleanup of the remaining pipes.
      }
    }
    state.sources.clear();
  };
  const notify = () => {
    for (const waiter of waiters) waiter();
  };
  const fail = (state: DestinationState | undefined, reason: string, error?: unknown) => {
    // Never include destination messages, which may contain raw/private output.
    let code = "";
    try {
      const candidate = (error as NodeJS.ErrnoException | undefined)?.code;
      if (
        typeof candidate === "string" &&
        [
          "EPIPE",
          "EIO",
          "EBADF",
          "ENOSPC",
          "EINVAL",
          "ERR_STREAM_DESTROYED",
          "ERR_STREAM_WRITE_AFTER_END",
        ].includes(candidate)
      ) {
        code = ` (${candidate})`;
      }
    } catch {
      // Untrusted error objects may have throwing accessors.
    }
    const issue = `Output ${state?.label ?? "delivery"}: ${reason}${code}; pending=${pendingBytes}, observed=${observedBytes}, written=${writtenBytes}; delivery incomplete.`;
    if (issues.length < 16 && !issues.includes(issue)) issues.push(issue);
    failed = true;
    for (const entry of states.values()) {
      clearTimeout(entry.timer);
      releaseSources(entry);
    }
    if (!controller.signal.aborted) controller.abort();
    notify();
  };
  const scheduleStall = (state: DestinationState, progressed = false) => {
    if (progressed || state.pendingBytes === 0) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }
    // Accepting another write or emitting drain does not acknowledge bytes.
    // Only callback progress renews the deadline for outstanding delivery.
    if (!failed && !disposed && state.pendingBytes > 0 && state.timer === undefined) {
      state.timer = setTimeout(() => fail(state, "destination stalled"), stallMs);
    }
  };
  const removeListeners = (state: DestinationState) => {
    state.destination.removeListener("drain", state.onDrain);
    state.destination.removeListener("error", state.onError);
    state.destination.removeListener("close", state.onClose);
  };
  const retireIfSafe = (state: DestinationState) => {
    if (disposed && state.pendingBytes === 0) {
      // Writable may emit error after invoking its write callback. Keep the
      // observer through that turn; outstanding callbacks keep it until settled.
      setImmediate(() => {
        if (state.pendingBytes === 0) removeListeners(state);
      });
    }
  };
  for (const channel of ["stdout", "stderr"] as const) {
    const destination = destinations[channel];
    const previous = states.get(destination);
    if (previous) {
      previous.label += `/${channel}`;
      continue;
    }
    const state: DestinationState = {
      destination,
      label: channel,
      pendingBytes: 0,
      blocked: false,
      broken: false,
      sources: new Set(),
      onDrain: () => {
        state.blocked = false;
        scheduleStall(state);
        releaseSources(state);
        notify();
      },
      onError: (error) => {
        state.broken = true;
        fail(state, "destination failed", error);
        retireIfSafe(state);
      },
      onClose: () => {
        state.broken = true;
        if (!disposed) fail(state, "destination closed");
        if (disposed) removeListeners(state);
      },
    };
    states.set(destination, state);
    destination.on("drain", state.onDrain);
    destination.on("error", state.onError);
    destination.on("close", state.onClose);
  }

  const deliver = (
    state: DestinationState,
    chunk: Buffer,
    source?: Readable,
    completed?: () => void,
  ) => {
    if (state.broken || state.destination.destroyed || !state.destination.writable) {
      state.broken = true;
      fail(state, "destination unavailable");
      completed?.();
      return;
    }
    if (chunk.length > maximum - pendingBytes) {
      fail(state, "pending byte limit exceeded");
      completed?.();
      return;
    }
    pendingBytes += chunk.length;
    state.pendingBytes += chunk.length;
    peakPendingBytes = Math.max(peakPendingBytes, pendingBytes);
    let settled = false;
    const acknowledge = (error?: Error | null) => {
      if (settled) return;
      settled = true;
      pendingBytes -= chunk.length;
      state.pendingBytes -= chunk.length;
      if (error) {
        state.broken = true;
        fail(state, "write failed", error);
      } else {
        writtenBytes += chunk.length;
        scheduleStall(state, true);
      }
      completed?.();
      notify();
      retireIfSafe(state);
    };
    try {
      const ready = state.destination.write(chunk, acknowledge);
      if (!ready && !failed && !settled) {
        state.blocked = true;
        if (source) {
          state.sources.add(source);
          source.pause();
        }
      }
      scheduleStall(state);
    } catch (error) {
      state.broken = true;
      // A nonstandard Writable can throw after calling its callback.
      if (settled) fail(state, "write threw", error);
      else acknowledge(error instanceof Error ? error : new Error("Write threw."));
    }
  };

  return {
    signal: controller.signal,
    get failed() {
      return failed;
    },
    get issues() {
      return [...issues];
    },
    write(channel, value, source) {
      const chunk = typeof value === "string" ? Buffer.from(value) : value;
      observedBytes += chunk.length;
      if (failed) return;
      if (disposed) {
        fail(states.get(destinations[channel]), "write after disposal");
        return;
      }
      if (chunk.length > 0) deliver(states.get(destinations[channel])!, chunk, source);
    },
    flush(sources = []) {
      const inputs = [...new Set(sources)];
      const drained = () =>
        pendingBytes === 0 &&
        [...states.values()].every((state) => !state.blocked) &&
        inputs.every((source) => source.readableEnded || source.destroyed || source.closed);
      if (failed || drained()) return Promise.resolve(!failed);
      return new Promise<boolean>((resolve) => {
        const finish = () => {
          if (!failed && !drained()) return;
          clearTimeout(timer);
          waiters.delete(finish);
          for (const source of inputs) {
            source.removeListener("end", finish);
            source.removeListener("close", finish);
          }
          resolve(!failed);
        };
        const timer = setTimeout(() => fail(undefined, "final drain timed out"), drainMs);
        waiters.add(finish);
        for (const source of inputs) {
          source.on("end", finish);
          source.on("close", finish);
        }
        finish();
      });
    },
    snapshot() {
      return {
        failed,
        incomplete: failed || pendingBytes > 0,
        observedBytes,
        writtenBytes,
        pendingBytes,
        peakPendingBytes,
        fallbackAttempted,
      };
    },
    async fallback(value) {
      if (fallbackAttempted || disposed) return;
      fallbackAttempted = true;
      const chunk = Buffer.from(value);
      observedBytes += chunk.length;
      const state = [...states.values()].find(
        (entry) =>
          !entry.broken &&
          !entry.blocked &&
          entry.pendingBytes === 0 &&
          !entry.destination.destroyed &&
          entry.destination.writable,
      );
      if (!state) {
        fail(undefined, "no fallback destination available");
        return;
      }
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          fallbackWaiters.delete(finish);
          resolve();
        };
        const timer = setTimeout(() => {
          fail(state, "fallback drain timed out");
          finish();
        }, drainMs);
        fallbackWaiters.add(finish);
        deliver(state, chunk, undefined, finish);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if ((pendingBytes > 0 || waiters.size > 0) && !failed) {
        fail(undefined, "disposed before output drained");
      }
      for (const finish of fallbackWaiters) finish();
      for (const state of states.values()) {
        clearTimeout(state.timer);
        releaseSources(state);
        state.destination.removeListener("drain", state.onDrain);
        retireIfSafe(state);
      }
    },
  };
}
