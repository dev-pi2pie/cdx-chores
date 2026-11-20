import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

import { createAppServerShutdown } from "./app-server-shutdown";
import { writeAppServerTurn } from "./app-server-write";
import { isRecord } from "./discovery/transport";

const maxLineBytes = 8 * 1024 * 1024;
const requestTimeoutMs = 15_000;

type NotificationListener = (method: string, params: unknown) => void;

interface PendingRequest {
  method: string;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  onQueued?: () => void;
}

function appServerExitError(code: number | null, signal: NodeJS.Signals | null): Error {
  return new Error(`Codex app-server stopped with ${signal ?? `exit code ${code}`}.`);
}

export class CodexAppServerError extends Error {
  readonly code: number | undefined;
  readonly data: unknown;

  constructor(
    readonly method: string,
    responseError: unknown,
  ) {
    const error = isRecord(responseError) ? responseError : {};
    const detail =
      typeof error.message === "string" ? error.message : "Codex app-server request failed.";
    super(`${method}: ${detail}`);
    this.code = typeof error.code === "number" ? error.code : undefined;
    this.data = error.data;
  }
}

export function isTurnInputTooLarge(error: unknown): boolean {
  return (
    error instanceof CodexAppServerError &&
    error.method === "turn/start" &&
    error.code === -32602 &&
    isRecord(error.data) &&
    error.data.input_error_code === "input_too_large"
  );
}

export class CodexRequestTimeoutError extends Error {
  constructor(readonly method: string) {
    super(`${method}: Codex app-server request timed out.`);
  }
}

export class CodexAppServer {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly shutdown: () => Promise<void>;
  private readonly stopped = new AbortController();
  private readonly pending = new Map<number, PendingRequest>();
  private readonly listeners = new Set<NotificationListener>();
  private nextId = 0;
  private unexpectedStdoutEnd = false;

  constructor(
    executable: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    { isolateSignals = false }: { isolateSignals?: boolean } = {},
  ) {
    // Keep a benchmark's app-server available for turn/interrupt after foreground Ctrl-C.
    const separateGroup = isolateSignals && process.platform !== "win32";
    this.child = spawn(executable, ["app-server"], {
      cwd,
      env,
      stdio: "pipe",
      windowsHide: true,
      detached: separateGroup,
    });
    this.child.on("error", (error) => this.fail(error));
    this.child.stdin.on("error", (error) => this.fail(error));
    this.child.stdout.on("error", (error) => this.fail(error));
    this.child.stderr.on("error", (error) => this.fail(error));
    this.child.stderr.resume();
    this.shutdown = createAppServerShutdown(this.child, separateGroup);
    this.child.once("close", (code, signal) => this.fail(appServerExitError(code, signal)));
    this.child.stdout.once("end", () => {
      if (this.signal.aborted) return;
      this.unexpectedStdoutEnd = true;
      this.fail(new Error("Codex app-server stdout ended unexpectedly."));
    });
    const decoder = new StringDecoder("utf8");
    let buffer = "";
    this.child.stdout.on("data", (chunk: Buffer) => {
      if (this.signal.aborted) return;
      buffer += decoder.write(chunk);
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (Buffer.byteLength(line) > maxLineBytes) {
          this.fail(new Error("Codex app-server exceeded its protocol line limit."));
          return;
        }
        this.receive(line);
        if (this.signal.aborted) return;
      }
      if (Buffer.byteLength(buffer) > maxLineBytes) {
        this.fail(new Error("Codex app-server exceeded its protocol line limit."));
      }
    });
  }

  get signal(): AbortSignal {
    return this.stopped.signal;
  }

  get stopReason(): unknown {
    const { exitCode, signalCode } = this.child;
    // The child's exit status can arrive after EOF while the caller recovers saved results.
    if (this.unexpectedStdoutEnd && (exitCode !== null || signalCode !== null)) {
      return appServerExitError(exitCode, signalCode);
    }
    return this.signal.reason;
  }

  private fail(error: Error): void {
    this.stopped.abort(error);
    for (const pending of this.pending.values()) pending.reject(error);
  }

  private send(message: object, onQueued?: () => void): void {
    this.signal.throwIfAborted();
    const line = `${JSON.stringify(message)}\n`;
    if (onQueued) {
      writeAppServerTurn(this.child.stdin, line, (error) => this.fail(error));
      onQueued();
    } else {
      this.child.stdin.write(line);
    }
  }

  private receive(line: string): void {
    if (!line.trim()) return;
    try {
      const message: unknown = JSON.parse(line);
      if (!isRecord(message)) throw new Error("Codex app-server returned an invalid message.");
      if (!("id" in message) && typeof message.method === "string") {
        for (const listener of this.listeners) listener(message.method, message.params);
        return;
      }
      if ("id" in message && typeof message.method === "string") {
        this.send({
          id: message.id,
          error: { code: -32601, message: "This client supports prompt-only turns." },
        });
        return;
      }
      if (typeof message.id !== "number" || "result" in message === "error" in message) {
        throw new Error("Codex app-server returned an invalid response.");
      }
      const pending = this.pending.get(message.id);
      if (!pending) return; // A response may arrive after its request times out or is cancelled.
      if ("error" in message) {
        pending.reject(new CodexAppServerError(pending.method, message.error));
      } else {
        pending.resolve(message.result);
      }
    } catch (error) {
      this.fail(
        error instanceof Error ? error : new Error("Codex app-server returned malformed JSON."),
      );
    }
  }

  onNotification(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(method: string): void {
    this.send({ method });
  }

  async request<T = unknown>(
    method: string,
    params: object,
    { timeoutMs = requestTimeoutMs, signal, onQueued }: RequestOptions = {},
  ): Promise<T> {
    signal?.throwIfAborted();
    this.signal.throwIfAborted();
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      const cleanup = () => {
        this.pending.delete(id);
        clearTimeout(deadline);
        signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = () => pending.reject(signal?.reason);
      const deadline = setTimeout(() => {
        pending.reject(new CodexRequestTimeoutError(method));
      }, timeoutMs);
      const pending: PendingRequest = {
        method,
        resolve(value) {
          cleanup();
          resolve(value as T);
        },
        reject(error) {
          cleanup();
          reject(error);
        },
      };
      this.pending.set(id, pending);
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        this.send({ id, method, params }, onQueued);
      } catch (error) {
        pending.reject(error);
      }
    });
  }

  async initialize(
    timeoutMs?: number,
    signal?: AbortSignal,
  ): Promise<{ userAgent?: string; codexHome?: string }> {
    signal?.throwIfAborted();
    const cancel = () => this.fail(signal!.reason);
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      const result = await this.request<{ userAgent?: string; codexHome?: string }>(
        "initialize",
        { clientInfo: { name: "cdx_chores", title: "cdx-chores", version: "1" } },
        { timeoutMs },
      );
      this.notify("initialized");
      return result;
    } finally {
      signal?.removeEventListener("abort", cancel);
    }
  }

  close(): Promise<void> {
    this.fail(new Error("Codex app-server was closed."));
    return this.shutdown();
  }
}
