import { CodexRequestTimeoutError } from "./app-server";
import { CodexAppServerTransportClosedError } from "./app-server-exit";
import { isRecord } from "./discovery/transport";

function isMissingTurnStartReply(error: unknown): boolean {
  return (
    error instanceof CodexAppServerTransportClosedError ||
    (error instanceof CodexRequestTimeoutError && error.method === "turn/start")
  );
}

export function isAppServerId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function claimThreadId(id: unknown, owned: Set<string>): asserts id is string {
  if (!isAppServerId(id) || owned.has(id)) {
    throw new Error("Codex app-server did not return a new thread ID.");
  }
  owned.add(id);
}

export class TurnStartEvidence {
  private knownId?: string;
  private reply?: Promise<string>;
  private replyPending = false;
  private readonly ambiguity = new AbortController();
  // Other same-thread events rule out a pre-submission refusal without supplying a start ID.
  observed = false;

  get signal(): AbortSignal {
    return this.ambiguity.signal;
  }

  get conflicting(): boolean {
    return this.signal.aborted;
  }

  get turnId(): string | undefined {
    return this.conflicting ? undefined : this.knownId;
  }

  recordStart(id: unknown): void {
    this.observed = true;
    if (!isAppServerId(id)) return;
    if (this.knownId !== undefined && this.knownId !== id) {
      this.ambiguity.abort(new Error("Codex app-server returned conflicting turn IDs."));
    } else {
      this.knownId = id;
    }
  }

  recordReply(result: unknown): string {
    const turn = isRecord(result) ? result.turn : undefined;
    const id = isRecord(turn) ? turn.id : undefined;
    if (!isAppServerId(id)) {
      throw new Error("Codex app-server did not return a valid turn ID.");
    }
    this.recordStart(id);
    this.assertUnambiguous();
    return id;
  }

  trackReply(response: Promise<unknown>): Promise<string> {
    this.replyPending = true;
    this.reply = response
      .then((result) => this.recordReply(result))
      .finally(() => {
        this.replyPending = false;
      });
    return this.reply;
  }

  recoverCompletedTurn(error: unknown, hasCompletion: (turnId: string) => boolean): string {
    this.assertUnambiguous();
    const id = this.turnId;
    if (id && isMissingTurnStartReply(error) && hasCompletion(id)) return id;
    throw error;
  }

  /** A matching terminal notification can replace a reply that never arrives. */
  async reconcileReply(signal?: AbortSignal): Promise<void> {
    this.assertUnambiguous();
    const waiting = this.replyPending
      ? AbortSignal.any([this.signal, ...(signal ? [signal] : [])])
      : undefined;
    waiting?.throwIfAborted();
    const cancelled = Promise.withResolvers<never>();
    const onAbort = () => cancelled.reject(waiting?.reason);
    waiting?.addEventListener("abort", onAbort, { once: true });
    try {
      if (waiting) await Promise.race([this.reply, cancelled.promise]);
      else await this.reply;
    } catch (error) {
      if (!isMissingTurnStartReply(error)) throw error;
    } finally {
      waiting?.removeEventListener("abort", onAbort);
    }
    this.assertUnambiguous();
  }

  assertUnambiguous(): void {
    this.signal.throwIfAborted();
  }
}
