import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

const MAX_LINE_BYTES = 1024 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** One owned app-server; requests are intentionally sequential. */
export class DiscoveryTransport {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly exited: Promise<void>;
  private readonly deadline: ReturnType<typeof setTimeout>;
  private readonly signal?: AbortSignal;
  private readonly onAbort = () => this.fail(new Error("Codex discovery was cancelled."));
  private pending?: {
    id: number;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  };
  private failure?: Error;
  private nextId = 1;
  private stopping = false;
  private hasExited = false;

  constructor(
    executable: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    timeoutMs: number,
    signal?: AbortSignal,
  ) {
    try {
      this.child = spawn(executable, ["app-server"], {
        cwd,
        env,
        stdio: "pipe",
        windowsHide: true,
      });
    } catch {
      throw new Error("Unable to start the Codex discovery process.");
    }
    this.signal = signal;
    this.deadline = setTimeout(() => this.fail(new Error("Codex discovery timed out.")), timeoutMs);
    this.exited = new Promise((resolve) => {
      const ended = () => {
        this.hasExited = true;
        if (!this.stopping) this.fail(new Error("Codex discovery process ended unexpectedly."));
        resolve();
      };
      this.child.once("exit", ended);
      this.child.once("error", () => {
        this.fail(new Error("Unable to start the Codex discovery process."));
        ended();
      });
    });
    signal?.addEventListener("abort", this.onAbort, { once: true });
    if (signal?.aborted) this.onAbort();
    this.child.stdin.on("error", () => this.fail(new Error("Codex discovery input failed.")));
    this.child.stdout.on("error", () => this.fail(new Error("Codex discovery output failed.")));
    this.child.stderr.on("error", () => this.fail(new Error("Codex discovery output failed.")));
    let stderrBytes = 0;
    this.child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > MAX_OUTPUT_BYTES)
        this.fail(new Error("Codex discovery exceeded its output limit."));
    });
    const decoder = new StringDecoder("utf8");
    let buffer = "";
    let totalBytes = 0;
    this.child.stdout.on("data", (chunk: Buffer) => {
      if (this.failure || this.stopping) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_OUTPUT_BYTES) {
        this.fail(new Error("Codex discovery exceeded its output limit."));
        return;
      }
      buffer += decoder.write(chunk);
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (Buffer.byteLength(line) > MAX_LINE_BYTES) {
          this.fail(new Error("Codex discovery exceeded its response limit."));
          return;
        }
        this.receive(line);
        if (this.failure) return;
      }
      if (Buffer.byteLength(buffer) > MAX_LINE_BYTES) {
        this.fail(new Error("Codex discovery exceeded its response limit."));
      }
    });
    this.child.stdout.on("end", () => {
      if (!this.stopping) this.fail(new Error("Codex discovery output ended unexpectedly."));
    });
  }

  private fail(error: Error): void {
    if (this.failure || this.stopping) return;
    this.failure = error;
    this.pending?.reject(error);
    this.pending = undefined;
  }

  private receive(line: string): void {
    if (!line.trim()) return;
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      this.fail(new Error("Codex discovery returned malformed JSON."));
      return;
    }
    if (!isRecord(message)) {
      this.fail(new Error("Codex discovery returned an invalid protocol message."));
      return;
    }
    if (!("id" in message) && typeof message.method === "string") return;
    const pending = this.pending;
    if (!pending || message.id !== pending.id || "result" in message === "error" in message) {
      this.fail(new Error("Codex discovery returned an invalid response."));
      return;
    }
    if ("error" in message) {
      this.fail(new Error("Codex discovery request failed."));
      return;
    }
    this.pending = undefined;
    pending.resolve(message.result);
  }

  request(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.pending)
      return Promise.reject(new Error("Codex discovery already has an active request."));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending = { id, resolve, reject };
      this.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  initialized(): void {
    if (this.failure) throw this.failure;
    this.child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
  }

  assertHealthy(): void {
    if (this.failure) throw this.failure;
  }

  async close(): Promise<void> {
    this.stopping = true;
    clearTimeout(this.deadline);
    this.signal?.removeEventListener("abort", this.onAbort);
    this.child.stdin.destroy();
    this.child.stdout.destroy();
    this.child.stderr.destroy();
    if (!this.hasExited) this.child.kill("SIGTERM");
    const forceKill = setTimeout(() => {
      if (!this.hasExited) this.child.kill("SIGKILL");
    }, 250);
    try {
      await this.exited;
    } finally {
      clearTimeout(forceKill);
    }
  }
}
