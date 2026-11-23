import {
  createKeypressParser,
  startRawSession,
  type ParsedKeypressEvent,
  type RawSession,
} from "../tui";

interface InlinePromptSessionOptions {
  message: string;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WritableStream;
  signal?: AbortSignal;
}

interface InlinePromptSessionHandlers {
  beforeStart?: () => void;
  onClose: (rejected: boolean) => void;
  clear: () => void;
  onKey: (
    key: Exclude<ParsedKeypressEvent, { kind: "incomplete" }>,
    submit: (value: string) => void,
  ) => Promise<void>;
}

export function runInlinePromptSession(
  { message, stdin, stdout, signal }: InlinePromptSessionOptions,
  handlers: InlinePromptSessionHandlers,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let session: RawSession | undefined;

    const finish = (outcome: { value: string } | { error: unknown }): void => {
      if (settled) return;
      settled = true;
      const rejected = "error" in outcome;
      try {
        try {
          handlers.onClose(rejected);
        } finally {
          signal?.removeEventListener("abort", abort);
          parser.dispose();
          session?.close();
          handlers.clear();
        }
        if (rejected) {
          stdout.write("\n");
          reject(outcome.error);
        } else {
          stdout.write(`${message} ${outcome.value}\n`);
          resolve(outcome.value);
        }
      } catch (error) {
        reject(rejected ? outcome.error : error);
      }
    };
    const submit = (value: string): void => finish({ value });
    const fail = (error: unknown): void => finish({ error });
    const abort = (): void => {
      const error = new Error("User aborted prompt");
      error.name = "ExitPromptError";
      fail(error);
    };
    const parser = createKeypressParser({ onEscapeAbort: abort });

    try {
      signal?.throwIfAborted();
      handlers.beforeStart?.();
      session = startRawSession({ stdin, stdout });
      session.addKeypressListener((str, key) => {
        if (settled) return;
        try {
          const parsed = parser.handle(str, key);
          if (parsed.kind === "incomplete") return;
          if (parsed.kind === "keypress" && parsed.key.ctrl && parsed.key.name === "c") {
            abort();
            return;
          }
          void handlers.onKey(parsed, submit).catch(fail);
        } catch (error) {
          fail(error);
        }
      });
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    } catch (error) {
      fail(error);
    }
  });
}
