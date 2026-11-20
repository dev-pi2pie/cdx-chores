import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { setTimeout as delay } from "node:timers/promises";

import { isRecord } from "./discovery/transport";

const maxLineBytes = 8 * 1024 * 1024;
const requestTimeoutMs = 15_000;
const groupShutdownTimeoutMs = 1_000;

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
  constructor(
    method: string,
    readonly code: number | undefined,
    detail: string,
  ) {
    super(`${method}: ${detail}`);
  }
}

export class CodexAppServer {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly closed: Promise<void>;
  private readonly stopped = new AbortController();
  private readonly pending = new Map<number, PendingRequest>();
  private readonly listeners = new Set<NotificationListener>();
  private nextId = 0;
  private exited = false;
  private unexpectedStdoutEnd = false;
  private readonly separateGroup: boolean;

  constructor(
    executable: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    { isolateSignals = false }: { isolateSignals?: boolean } = {},
  ) {
    // Keep a benchmark's app-server available for turn/interrupt after foreground Ctrl-C.
    this.separateGroup = isolateSignals && process.platform !== "win32";
    this.child = spawn(executable, ["app-server"], {
      cwd,
      env,
      stdio: "pipe",
      windowsHide: true,
      detached: this.separateGroup,
    });
    this.child.on("error", (error) => this.fail(error));
    this.child.stdin.on("error", (error) => this.fail(error));
    this.child.stdout.on("error", (error) => this.fail(error));
    this.child.stderr.on("error", (error) => this.fail(error));
    this.child.stderr.resume();
    this.child.on("exit", () => {
      this.exited = true;
    });
    this.closed = new Promise((resolve) => {
      this.child.once("close", (code, signal) => {
        this.exited = true;
        this.fail(appServerExitError(code, signal));
        resolve();
      });
    });
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

  private send(message: object): void {
    this.signal.throwIfAborted();
    if (!this.child.stdin.writable) throw new Error("Codex app-server stdin is not writable.");
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
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
        const error = isRecord(message.error) ? message.error : {};
        pending.reject(
          new CodexAppServerError(
            pending.method,
            typeof error.code === "number" ? error.code : undefined,
            typeof error.message === "string" ? error.message : "Codex app-server request failed.",
          ),
        );
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
        pending.reject(new Error(`${method}: Codex app-server request timed out.`));
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
        this.send({ id, method, params });
        onQueued?.();
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

  private kill(signal: NodeJS.Signals): void {
    if (this.separateGroup && this.child.pid) {
      try {
        process.kill(-this.child.pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    } else if (!this.exited) {
      this.child.kill(signal);
    }
  }

  private async waitForGroupExit(groupId: number): Promise<void> {
    const deadline = performance.now() + groupShutdownTimeoutMs;
    while (true) {
      try {
        process.kill(-groupId, 0);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ESRCH") return;
        if (code !== "EPERM") throw error;
      }
      if (performance.now() >= deadline)
        throw new Error(
          "Codex app-server process group did not stop before its shutdown deadline.",
        );
      await delay(20);
    }
  }

  async close(): Promise<void> {
    this.fail(new Error("Codex app-server was closed."));
    this.child.stdin.destroy();
    this.child.stdout.destroy();
    this.child.stderr.destroy();
    this.kill("SIGTERM");
    const forceKill = setTimeout(() => this.kill("SIGKILL"), 1_000);
    try {
      await this.closed;
      // The group can still contain workers after its leader has exited.
      if (this.separateGroup && this.child.pid) {
        this.kill("SIGKILL");
        await this.waitForGroupExit(this.child.pid);
      }
    } finally {
      clearTimeout(forceKill);
    }
  }
}
