import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { StringDecoder } from "node:string_decoder";

type RpcResponse = { id?: number; result?: unknown; error?: unknown };

/** An isolated evidence probe, intentionally independent from the production adapter. */
export class LiveProtocolClient {
  readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private sequence = 0;
  private buffer = "";
  private readonly closeOwned?: () => Promise<void>;

  constructor(
    executable: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    owned?: { child: ChildProcessWithoutNullStreams; close: () => Promise<void> },
  ) {
    // The default inherits the caller's process group for the Phase 1 outer-owner probe.
    this.child = owned?.child ?? spawn(executable, ["app-server"], { cwd, env, stdio: "pipe" });
    this.closeOwned = owned?.close;
    this.child.stderr.resume();
    const decoder = new StringDecoder("utf8");
    this.child.stdout.on("data", (chunk: Buffer) => {
      this.buffer += decoder.write(chunk);
      let newline: number;
      while ((newline = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, newline);
        this.buffer = this.buffer.slice(newline + 1);
        try {
          const response = JSON.parse(line) as RpcResponse;
          if (response.id === undefined) continue;
          const waiter = this.pending.get(response.id);
          if (!waiter) continue;
          this.pending.delete(response.id);
          if (response.error) waiter.reject(new Error(JSON.stringify(response.error)));
          else waiter.resolve(response.result);
        } catch (error) {
          this.rejectAll(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
    this.child.on("error", (error) => this.rejectAll(error));
    this.child.on("exit", (code, signal) => {
      this.rejectAll(new Error(`Probe exited: ${code ?? signal}`));
    });
  }

  private rejectAll(error: Error): void {
    for (const waiter of this.pending.values()) waiter.reject(error);
    this.pending.clear();
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Probe request timed out: ${method}`));
      }, 10_000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }

  notify(method: string): void {
    this.child.stdin.write(JSON.stringify({ method }) + "\n");
  }

  async close(): Promise<void> {
    if (this.closeOwned) return this.closeOwned();
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    const exited = once(this.child, "exit");
    this.child.kill("SIGTERM");
    const timer = setTimeout(() => this.child.kill("SIGKILL"), 1_000);
    try {
      await exited;
    } finally {
      clearTimeout(timer);
    }
  }
}
