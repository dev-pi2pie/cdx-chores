import type { RawSessionKeypressInfo } from "./raw-session";

export type ParsedKeypressEvent =
  | { kind: "keypress"; str: string; key: RawSessionKeypressInfo }
  | { kind: "arrow"; direction: "left" | "right" | "up" | "down" }
  | { kind: "incomplete" };

export interface CreateKeypressParserOptions {
  onEscapeAbort?: () => void;
  escapeAbortDelayMs?: number;
}

export interface KeypressParser {
  handle(str: string, key?: RawSessionKeypressInfo): ParsedKeypressEvent;
  dispose(): void;
}

const DEFAULT_ESCAPE_ABORT_DELAY_MS = 120;

export function createKeypressParser(options: CreateKeypressParserOptions = {}): KeypressParser {
  let escapeSequenceBuffer = "";
  let pendingEscapeAbortTimer: ReturnType<typeof setTimeout> | undefined;
  const escapeAbortDelayMs = options.escapeAbortDelayMs ?? DEFAULT_ESCAPE_ABORT_DELAY_MS;

  const clearPendingEscapeAbort = (): void => {
    if (!pendingEscapeAbortTimer) {
      return;
    }
    clearTimeout(pendingEscapeAbortTimer);
    pendingEscapeAbortTimer = undefined;
  };

  const resetEscapeState = (): void => {
    clearPendingEscapeAbort();
    escapeSequenceBuffer = "";
  };

  const scheduleEscapeAbort = (): void => {
    clearPendingEscapeAbort();
    pendingEscapeAbortTimer = setTimeout(() => {
      pendingEscapeAbortTimer = undefined;
      escapeSequenceBuffer = "";
      options.onEscapeAbort?.();
    }, escapeAbortDelayMs);
  };

  return {
    handle(str, key = {}): ParsedKeypressEvent {
      if (key.name !== "escape") {
        clearPendingEscapeAbort();
      }

      if (escapeSequenceBuffer.length > 0 && key.name !== "escape") {
        escapeSequenceBuffer += str;

        if (key.name === "right" || escapeSequenceBuffer === "\x1b[C") {
          resetEscapeState();
          return { kind: "arrow", direction: "right" };
        }

        if (key.name === "left" || escapeSequenceBuffer === "\x1b[D") {
          resetEscapeState();
          return { kind: "arrow", direction: "left" };
        }

        if (key.name === "up" || escapeSequenceBuffer === "\x1b[A") {
          resetEscapeState();
          return { kind: "arrow", direction: "up" };
        }

        if (key.name === "down" || escapeSequenceBuffer === "\x1b[B") {
          resetEscapeState();
          return { kind: "arrow", direction: "down" };
        }

        if (
          escapeSequenceBuffer === "\x1b[" ||
          escapeSequenceBuffer === "\x1bO" ||
          escapeSequenceBuffer === "\x1b[1;" ||
          escapeSequenceBuffer === "\x1b[1;2"
        ) {
          return { kind: "incomplete" };
        }

        escapeSequenceBuffer = "";
      }

      if (key.name === "escape") {
        escapeSequenceBuffer = "\x1b";
        scheduleEscapeAbort();
        return { kind: "incomplete" };
      }

      if (key.name === "right") {
        return { kind: "arrow", direction: "right" };
      }

      if (key.name === "left") {
        return { kind: "arrow", direction: "left" };
      }

      if (key.name === "up") {
        return { kind: "arrow", direction: "up" };
      }

      if (key.name === "down") {
        return { kind: "arrow", direction: "down" };
      }

      return {
        kind: "keypress",
        str,
        key,
      };
    },
    dispose(): void {
      resetEscapeState();
    },
  };
}
