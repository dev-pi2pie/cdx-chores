import { isRecord } from "./discovery/transport";

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

  assertUnambiguous(): void {
    this.signal.throwIfAborted();
  }
}
