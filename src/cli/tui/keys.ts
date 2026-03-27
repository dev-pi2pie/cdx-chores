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
  handle(str: string | undefined, key?: RawSessionKeypressInfo): ParsedKeypressEvent;
  dispose(): void;
}

const DEFAULT_ESCAPE_ABORT_DELAY_MS = 120;
const POTENTIAL_ESCAPE_SEQUENCE_BUFFER_PATTERN = new RegExp(
  String.raw`^\u001B(?:\[[0-9;?]*|O[0-9;?]*)$`,
);

function normalizeKeypressChunk(str: string | undefined, key: RawSessionKeypressInfo): string {
  if (typeof str === "string") {
    return str;
  }
  if (typeof key.sequence === "string") {
    return key.sequence;
  }
  return "";
}

function isPotentialEscapeSequenceBuffer(value: string): boolean {
  return POTENTIAL_ESCAPE_SEQUENCE_BUFFER_PATTERN.test(value);
}

function parseSpecialEscapeSequence(value: string): ParsedKeypressEvent | undefined {
  if (value === "\x1b[C") {
    return { kind: "arrow", direction: "right" };
  }
  if (value === "\x1b[D") {
    return { kind: "arrow", direction: "left" };
  }
  if (value === "\x1b[A") {
    return { kind: "arrow", direction: "up" };
  }
  if (value === "\x1b[B") {
    return { kind: "arrow", direction: "down" };
  }
  if (value === "\x1b[27;2;13~" || value === "\x1b[13;2u") {
    return {
      kind: "keypress",
      str: "",
      key: {
        name: "return",
        sequence: value,
        shift: true,
      },
    };
  }
  return undefined;
}

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
      const chunk = normalizeKeypressChunk(str, key);

      if (key.name !== "escape") {
        clearPendingEscapeAbort();
      }

      if (escapeSequenceBuffer.length > 0 && key.name !== "escape") {
        escapeSequenceBuffer += chunk;

        if (
          key.name === "right" ||
          key.name === "left" ||
          key.name === "up" ||
          key.name === "down"
        ) {
          resetEscapeState();
          return {
            kind: "arrow",
            direction: key.name,
          };
        }

        const parsedEscape = parseSpecialEscapeSequence(escapeSequenceBuffer);
        if (parsedEscape) {
          resetEscapeState();
          return parsedEscape;
        }

        if (isPotentialEscapeSequenceBuffer(escapeSequenceBuffer)) {
          return { kind: "incomplete" };
        }

        const completedSequence = escapeSequenceBuffer;
        escapeSequenceBuffer = "";
        return {
          kind: "keypress",
          str: chunk,
          key: {
            ...key,
            sequence: completedSequence,
          },
        };
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
        str: chunk,
        key,
      };
    },
    dispose(): void {
      resetEscapeState();
    },
  };
}
