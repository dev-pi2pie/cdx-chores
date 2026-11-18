import { EventEmitter, once } from "node:events";

import type { CodexAppServer } from "../app-server";
import { isRecord } from "../discovery/transport";

export interface Turn {
  id: string;
  status: "completed" | "interrupted" | "failed" | "inProgress";
  error?: { message?: string } | null;
  items?: unknown[];
}

interface TurnEvidence {
  items: Map<string, Record<string, unknown>>;
  rerouted: boolean;
  hasText: boolean;
  completion?: { turn: Turn; receivedAt: number };
}

const nonToolItems = new Set(["userMessage", "agentMessage", "reasoning"]);
const cancelledStartGraceMs = 1_000;

export class TrialObserver {
  private readonly turns = new Map<string, TurnEvidence>();
  private readonly events = new EventEmitter();
  readonly close: () => void;
  startedTurnId?: string;
  private observedTextTurnId?: string;

  constructor(
    server: CodexAppServer,
    threadId: string,
    private readonly onFirstText?: () => void,
  ) {
    this.close = server.onNotification((method, params) => {
      if (!isRecord(params) || params.threadId !== threadId) return;
      if (method === "turn/started" || method === "turn/completed") {
        const turn = params.turn;
        if (!isRecord(turn) || typeof turn.id !== "string") return;
        if (method === "turn/started") {
          this.startedTurnId = turn.id;
          this.events.emit("turnEvidence");
        } else if (
          turn.status === "completed" ||
          turn.status === "failed" ||
          turn.status === "interrupted"
        ) {
          const evidence = this.evidence(turn.id);
          if (Array.isArray(turn.items))
            for (const item of turn.items) this.recordItem(evidence, item);
          evidence.completion = { turn: turn as unknown as Turn, receivedAt: performance.now() };
          this.events.emit(`turn:${turn.id}`);
          this.events.emit("turnEvidence");
        }
      } else if (typeof params.turnId === "string") {
        if (method === "item/started" || method === "item/completed") {
          this.recordItem(this.evidence(params.turnId), params.item);
        } else if (method === "model/rerouted") {
          this.evidence(params.turnId).rerouted = true;
        } else if (
          method === "item/agentMessage/delta" &&
          this.onFirstText &&
          typeof params.delta === "string" &&
          params.delta.length > 0
        ) {
          const evidence = this.evidence(params.turnId);
          if (evidence.hasText) return;
          evidence.hasText = true;
          if (params.turnId === this.observedTextTurnId) this.onFirstText();
        }
      }
    });
  }

  private evidence(turnId: string): TurnEvidence {
    let evidence = this.turns.get(turnId);
    if (!evidence) {
      evidence = { items: new Map(), rerouted: false, hasText: false };
      this.turns.set(turnId, evidence);
    }
    return evidence;
  }

  watchFirstText(turnId: string): void {
    this.observedTextTurnId = turnId;
    if (this.onFirstText && this.evidence(turnId).hasText) this.onFirstText();
  }

  private recordItem(evidence: TurnEvidence, item: unknown): void {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.type !== "string") return;
    evidence.items.set(item.id, { ...evidence.items.get(item.id), ...item });
  }

  async waitForStart(response: Promise<{ turn: Turn }>, signal?: AbortSignal): Promise<string> {
    const rpcTurn = response.then(({ turn }) => turn.id);
    let checkEvidence = () => {};
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const observedTurn = new Promise<string>((resolve, reject) => {
      checkEvidence = () => {
        const id = this.startedTurnId;
        // Cancellation needs a target immediately. Normal progress requires a
        // matching terminal notification to stand in for the missing RPC reply.
        if (id && (signal?.aborted || this.turns.get(id)?.completion)) resolve(id);
        else if (signal?.aborted)
          graceTimer ??= setTimeout(
            () => reject(new Error("Turn ID was unavailable after cancellation.")),
            cancelledStartGraceMs,
          );
      };
      signal?.addEventListener("abort", checkEvidence, { once: true });
      this.events.on("turnEvidence", checkEvidence);
      checkEvidence();
    });
    try {
      return await Promise.race([rpcTurn, observedTurn]);
    } finally {
      clearTimeout(graceTimer);
      signal?.removeEventListener("abort", checkEvidence);
      this.events.off("turnEvidence", checkEvidence);
    }
  }

  async waitForCompletion(turnId: string, signal: AbortSignal) {
    const evidence = this.evidence(turnId);
    if (!evidence.completion) await once(this.events, `turn:${turnId}`, { signal });
    if (!evidence.completion) throw new Error("Matching turn completion was unavailable.");
    return evidence.completion;
  }

  isEligible(turnId: string): boolean {
    const evidence = this.evidence(turnId);
    if (evidence.rerouted || evidence.completion?.turn.status !== "completed") return false;
    const messages = [];
    for (const item of evidence.items.values()) {
      if (!nonToolItems.has(String(item.type))) return false;
      if (item.type === "agentMessage") messages.push(item);
    }
    const message = messages[0];
    return (
      messages.length === 1 &&
      typeof message?.text === "string" &&
      message.text.trim().length > 0 &&
      (message.phase == null || message.phase === "final_answer")
    );
  }
}
