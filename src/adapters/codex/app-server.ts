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
  deadline: ReturnType<typeof setTimeout>;
  resolve(value: unknown): void;
  reject(error: Error): void;
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
      this.child.once("close", () => {
        this.exited = true;
        this.fail(new Error("Codex app-server stopped."));
        resolve();
      });
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

  private fail(error: Error): void {
    this.stopped.abort(error);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.deadline);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private send(message: object): void {
    this.signal.throwIfAborted();
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
      if (!pending) return; // A response may arrive after its request deadline.
      this.pending.delete(message.id);
      clearTimeout(pending.deadline);
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
    timeoutMs = requestTimeoutMs,
  ): Promise<T> {
    this.signal.throwIfAborted();
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      const deadline = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: Codex app-server request timed out.`));
      }, timeoutMs);
      this.pending.set(id, { method, deadline, resolve: (value) => resolve(value as T), reject });
      try {
        this.send({ id, method, params });
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(deadline);
        reject(error);
      }
    });
  }

  async initialize(): Promise<{ userAgent?: string; codexHome?: string }> {
    const result = await this.request<{ userAgent?: string; codexHome?: string }>("initialize", {
      clientInfo: { name: "cdx_chores", title: "cdx-chores", version: "1" },
    });
    this.notify("initialized");
    return result;
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
