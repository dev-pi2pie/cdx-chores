import { emitKeypressEvents } from "node:readline";
import { hideCursor, showCursor } from "./screen";

export interface RawSessionKeypressInfo {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  sequence?: string;
}

export type RawSessionKeypressHandler = (str: string, key: RawSessionKeypressInfo) => void;

type RawModeReadStream = NodeJS.ReadStream & {
  setRawMode(flag: boolean): void;
  on(event: "keypress", listener: RawSessionKeypressHandler): NodeJS.ReadStream;
  off(event: "keypress", listener: RawSessionKeypressHandler): NodeJS.ReadStream;
};

export interface RawSession {
  addKeypressListener(handler: RawSessionKeypressHandler): void;
  close(): void;
}

export interface StartRawSessionOptions {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WritableStream;
  onTeardown?: () => void;
}

export function supportsRawSessionIO(
  stdin: NodeJS.ReadStream,
  stdout: NodeJS.WritableStream,
): stdin is RawModeReadStream {
  const stdoutWithTTY = stdout as NodeJS.WritableStream & { isTTY?: boolean };
  return Boolean(
    stdin.isTTY &&
      stdoutWithTTY.isTTY &&
      typeof (stdin as Partial<RawModeReadStream>).setRawMode === "function",
  );
}

export function startRawSession(options: StartRawSessionOptions): RawSession {
  if (!supportsRawSessionIO(options.stdin, options.stdout)) {
    throw new Error("Raw session requires TTY stdin/stdout with raw mode support");
  }

  const stdin = options.stdin;
  const stdout = options.stdout;
  const handlers = new Set<RawSessionKeypressHandler>();
  let closed = false;

  emitKeypressEvents(stdin);
  if (typeof stdin.resume === "function") {
    stdin.resume();
  }
  stdin.setRawMode(true);
  hideCursor(stdout);

  return {
    addKeypressListener(handler): void {
      if (closed) {
        throw new Error("Cannot add keypress listener to a closed raw session");
      }
      handlers.add(handler);
      stdin.on("keypress", handler);
    },
    close(): void {
      if (closed) {
        return;
      }
      closed = true;

      try {
        options.onTeardown?.();
      } catch {
        // Ignore teardown failures so terminal restoration still runs.
      }

      for (const handler of handlers) {
        stdin.off("keypress", handler);
      }
      handlers.clear();

      stdin.setRawMode(false);
      if (typeof stdin.pause === "function") {
        stdin.pause();
      }
      showCursor(stdout);
    },
  };
}
