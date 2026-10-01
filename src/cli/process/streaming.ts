import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import type { Readable } from "node:stream";
import { CliError } from "../errors";
import { progressRecords, type ToolProgress } from "./records";

export const PROCESS_LIMITS = {
  metadataBytes: 1_048_576,
  stderrBytes: 65_536,
  queuedBytes: 262_144,
  graceMs: 2_000,
  forceMs: 5_000,
} as const;

type Launcher = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
export interface StreamingResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: string;
  stderrTruncated: boolean;
  earlyStop: boolean;
}

/** One logical operation owns every direct child and remains unusable after cancellation. */
export class ProcessOperation {
  private control = new AbortController();
  private children = new Map<ChildProcess, () => void>();
  private tasks = new Set<Promise<StreamingResult>>();
  private reason: unknown;
  private unsafe = false;
  private disposed = false;
  private abort = () =>
    this.cancel(new CliError("Operation cancelled.", { code: "PROCESS_CANCELLED", exitCode: 130 }));
  constructor(
    private options: {
      signal?: AbortSignal;
      launch?: Launcher;
      platform?: NodeJS.Platform;
      graceMs?: number;
      forceMs?: number;
    } = {},
  ) {
    options.signal?.addEventListener("abort", this.abort, { once: true });
    if (options.signal?.aborted) this.abort();
  }
  get closureUnconfirmed() {
    return this.unsafe;
  }
  get signal() {
    return this.control.signal;
  }
  cancel(
    reason: unknown = new CliError("Operation cancelled.", {
      code: "PROCESS_CANCELLED",
      exitCode: 130,
    }),
  ) {
    this.reason ??= reason instanceof Error ? reason : new Error(String(reason));
    if (!this.control.signal.aborted) this.control.abort(this.reason);
    for (const stop of this.children.values()) stop();
  }
  async dispose() {
    if (this.tasks.size) this.cancel();
    await Promise.allSettled(this.tasks);
    this.options.signal?.removeEventListener("abort", this.abort);
    this.disposed = true;
    if (this.unsafe || this.children.size)
      throw new CliError("Child/stream closure unconfirmed; retain scratch and stop the flow.", {
        code: "PROCESS_STOP_FAILED",
        exitCode: 2,
      });
  }
  run(
    command: string,
    args: readonly string[],
    options: {
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      consume?: (chunk: Buffer, signal: AbortSignal) => void | boolean | Promise<void | boolean>;
      progress?: (progress: ToolProgress) => void | Promise<void>;
      outputLimit?: number;
    } = {},
  ): Promise<StreamingResult> {
    if (this.disposed || this.unsafe || this.control.signal.aborted)
      return Promise.reject(
        this.reason ??
          new CliError("Operation is no longer usable.", { code: "PROCESS_STOP_FAILED" }),
      );
    const task = this.execute(command, args, options);
    this.tasks.add(task);
    void task.then(
      () => this.tasks.delete(task),
      (error) => {
        this.tasks.delete(task);
        this.cancel(error);
      },
    );
    return task;
  }
  private async execute(
    command: string,
    args: readonly string[],
    options: Parameters<ProcessOperation["run"]>[2] = {},
  ): Promise<StreamingResult> {
    const outputLimit = options.outputLimit ?? PROCESS_LIMITS.metadataBytes;
    if (!Number.isSafeInteger(outputLimit) || outputLimit < 1)
      throw new Error("Invalid buffered output limit.");
    const child = (this.options.launch ?? spawn)(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: options.progress ? ["ignore", "pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
    });
    let code: number | null = null,
      signal: NodeJS.Signals | null = null,
      launchError: Error | undefined;
    let closed = false,
      stopping = false,
      earlyStop = false;
    let forceTimer: ReturnType<typeof setTimeout> | undefined,
      confirmationTimer: ReturnType<typeof setTimeout> | undefined;
    let rejectConfirmation!: (error: Error) => void;
    const confirmation = new Promise<never>((_, reject) => {
      rejectConfirmation = reject;
    });
    const close = new Promise<void>((resolve) => {
      child.once("close", (exitCode, exitSignal) => {
        code = exitCode;
        signal = exitSignal;
        closed = true;
        resolve();
      });
    });
    child.on("error", (error) => {
      launchError = error;
      this.cancel(error);
    });
    const send = (value: NodeJS.Signals) => {
      try {
        child.kill(value);
      } catch (error) {
        this.reason ??= error;
      }
    };
    const force = () => {
      if (!closed) send("SIGKILL");
      // Includes final asynchronous consumers, even if the child has already closed.
      confirmationTimer = setTimeout(() => {
        this.unsafe = true;
        rejectConfirmation(
          new CliError("Child/stream closure unconfirmed; retain scratch and stop the flow.", {
            code: "PROCESS_STOP_FAILED",
            exitCode: 2,
          }),
        );
      }, this.options.forceMs ?? PROCESS_LIMITS.forceMs);
    };
    const stop = () => {
      if (stopping) return;
      stopping = true;
      if ((this.options.platform ?? process.platform) === "win32") force();
      else {
        if (!closed) send("SIGTERM");
        forceTimer = setTimeout(force, this.options.graceMs ?? PROCESS_LIMITS.graceMs);
      }
    };
    this.children.set(child, stop);
    if (this.control.signal.aborted) stop();
    let stderr = Buffer.alloc(0),
      stderrTruncated = false;
    const buffers: Buffer[] = [];
    let bytes = 0;
    const pump = async (stream: Readable, consume: (chunk: Buffer) => Promise<void>) => {
      try {
        for await (const value of stream) {
          const chunk = value as Buffer;
          if (chunk.length + stream.readableLength > PROCESS_LIMITS.queuedBytes)
            throw new CliError("Queued tool output exceeds 256 KiB.", {
              code: "PROCESS_QUEUE_LIMIT",
            });
          await consume(chunk);
        }
      } catch (error) {
        this.cancel(error);
      }
    };
    const stdoutTask = pump(child.stdout!, async (chunk) => {
      if (stopping) return;
      if (options.consume) {
        if ((await options.consume(chunk, this.control.signal)) === false) {
          earlyStop = true;
          stop();
        }
      } else {
        bytes += chunk.length;
        if (bytes > outputLimit)
          throw new CliError(`Selected metadata exceeds ${outputLimit} bytes.`, {
            code: "PROCESS_METADATA_LIMIT",
          });
        buffers.push(chunk);
      }
    });
    const stderrTask = pump(child.stderr!, async (chunk) => {
      stderrTruncated ||= stderr.length + chunk.length > PROCESS_LIMITS.stderrBytes;
      stderr = Buffer.from(Buffer.concat([stderr, chunk]).subarray(-PROCESS_LIMITS.stderrBytes));
    });
    const progress = options.progress ? progressRecords(options.progress) : undefined;
    const progressTask = progress
      ? pump(child.stdio[3] as Readable, async (chunk) => {
          if (!stopping) await progress.chunk(chunk);
        })
      : Promise.resolve();
    try {
      await Promise.race([
        Promise.all([close, stdoutTask, stderrTask, progressTask]).then(() => {
          this.children.delete(child);
        }),
        confirmation,
      ]);
      if (launchError) throw launchError;
      if (this.reason) throw this.reason;
      if (!earlyStop) progress?.finish();
      return {
        code,
        signal,
        stdout: Buffer.concat(buffers),
        stderr: (stderrTruncated ? "[diagnostics truncated]\n" : "") + stderr.toString("utf8"),
        stderrTruncated,
        earlyStop,
      };
    } finally {
      clearTimeout(forceTimer);
      clearTimeout(confirmationTimer);
    }
  }
}
