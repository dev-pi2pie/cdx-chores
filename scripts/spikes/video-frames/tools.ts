// Explicit synthetic smoke support. No tools run merely by importing this module.
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { lstat, readdir } from "node:fs/promises";
import { join } from "node:path";

export const FFMPEG = process.env.VIDEO_FRAMES_FFMPEG ?? "ffmpeg";
export const FFPROBE = process.env.VIDEO_FRAMES_FFPROBE ?? "ffprobe";
export const DECODER_PIXELS = 16_777_216;
export const FRAME_FIELDS =
  "frame=stream_index,best_effort_timestamp,pts,duration,pict_type:frame_side_data=";

export interface ToolResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: string;
  milliseconds: number;
  childPeakRssKiB: number | null;
  parentPeakRssBytes: number;
  earlyStop: boolean;
}

export async function runTool(
  command: string,
  args: string[],
  options: {
    input?: AsyncIterable<Buffer>;
    consume?: (chunk: Buffer) => Promise<void | boolean> | void | boolean;
    outputLimit?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
    allowFailure?: boolean;
  } = {},
): Promise<ToolResult> {
  options.signal?.throwIfAborted();
  const started = performance.now();
  const child = spawn(command, args, {
    shell: false,
    stdio: [options.input ? "pipe" : "ignore", "pipe", "pipe"],
  });
  let launchError: Error | undefined;
  child.on("error", (error) => {
    launchError = error;
  });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  let stopReason: Error | undefined;
  let earlyStop = false;
  let stoppedAt = 0;
  let force: ReturnType<typeof setTimeout> | undefined;
  const stop = (reason: Error) => {
    if (stopReason) return;
    stopReason = reason;
    stoppedAt = performance.now();
    child.kill("SIGTERM");
    force = setTimeout(() => child.kill("SIGKILL"), 2_000);
  };
  const abort = () => stop(new Error("Synthetic smoke interrupted."));
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timeout = setTimeout(
    () => stop(new Error("Smoke budget exceeded; verification is incomplete.")),
    options.timeoutMs ?? 300_000,
  );
  let stderr = Buffer.alloc(0);
  let stderrTruncated = false;
  child.stderr!.on("data", (chunk: Buffer) => {
    stderrTruncated ||= stderr.length + chunk.length > 65_536;
    stderr = Buffer.concat([stderr, chunk]).subarray(-65_536);
  });
  let childPeakRssKiB: number | null = null;
  let parentPeakRssBytes = process.memoryUsage().rss;
  const observe = () => {
    parentPeakRssBytes = Math.max(parentPeakRssBytes, process.memoryUsage().rss);
    if (!child.pid) return;
    try {
      const rss = Number(
        execFileSync("/bin/ps", ["-o", "rss=", "-p", String(child.pid)], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 1_000,
        }).trim(),
      );
      if (rss > 0) childPeakRssKiB = Math.max(childPeakRssKiB ?? 0, rss);
    } catch {
      /* A fast child may close between observations. Null means unmeasured. */
    }
  };
  // Let exec finish before sampling; pre-exec RSS is not decoder memory.
  const firstObservation = setTimeout(observe, 10);
  const observation = setInterval(observe, 100);
  const buffers: Buffer[] = [];
  let bytes = 0;
  const output = (async () => {
    try {
      for await (const value of child.stdout!) {
        parentPeakRssBytes = Math.max(parentPeakRssBytes, process.memoryUsage().rss);
        const chunk = value as Buffer;
        if (stopReason) continue;
        if (options.consume) {
          if ((await options.consume(chunk)) === false) {
            earlyStop = true;
            stop(new Error("Verified prefix reached; stop and confirm child closure."));
          }
        } else {
          bytes += chunk.length;
          if (bytes > (options.outputLimit ?? 1_048_576))
            throw new Error("Synthetic tool output limit exceeded.");
          buffers.push(chunk);
        }
      }
    } catch (error) {
      stop(error instanceof Error ? error : new Error(String(error)));
    }
  })();
  const input = (async () => {
    if (!options.input) return;
    // Always observe pipe errors, including errors between writes.
    const stream = child.stdin!;
    let pipeError: Error | undefined;
    stream.on("error", (error) => {
      pipeError = error;
    });
    try {
      for await (const chunk of options.input) {
        parentPeakRssBytes = Math.max(parentPeakRssBytes, process.memoryUsage().rss);
        if (stopReason || pipeError) throw stopReason ?? pipeError;
        if (!stream.write(chunk)) await once(stream, "drain");
      }
      stream.end();
    } catch (error) {
      stop(error instanceof Error ? error : new Error(String(error)));
    }
  })();
  try {
    // The deadline stops work; shutdown confirmation has its own allowance.
    const result = await Promise.race([
      closed,
      new Promise<never>((_, reject) => {
        const check = setInterval(() => {
          if (stopReason && performance.now() - stoppedAt > 7_000) {
            clearInterval(check);
            reject(new Error("Child closure unconfirmed; retain synthetic scratch."));
          }
        }, 50);
        void closed.finally(() => clearInterval(check));
      }),
    ]);
    await Promise.all([input, output]);
    if (launchError) throw launchError;
    const value = {
      ...result,
      stdout: Buffer.concat(buffers),
      stderr: (stderrTruncated ? "[diagnostics truncated]\n" : "") + stderr.toString("utf8"),
      milliseconds: performance.now() - started,
      childPeakRssKiB,
      parentPeakRssBytes,
      earlyStop,
    };
    if (stopReason && !earlyStop) throw stopReason;
    if (!options.allowFailure && ((!earlyStop && result.code !== 0) || value.stderr.trim()))
      throw new Error(`${command} failed (${result.code ?? result.signal}): ${value.stderr}`);
    return value;
  } finally {
    clearTimeout(timeout);
    clearTimeout(force);
    clearInterval(observation);
    clearTimeout(firstObservation);
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function scratchBytes(path: string): Promise<number> {
  let bytes = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    try {
      const stat = await lstat(child);
      if (stat.isSymbolicLink())
        throw new Error("Synthetic scratch contains an alias; ownership requires inspection.");
      bytes += stat.isDirectory() ? await scratchBytes(child) : stat.size;
    } catch (error) {
      // Publication can remove a completed staging entry between enumeration and inspection.
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
  }
  return bytes;
}

export function lineConsumer(consume: (line: string) => void): {
  chunk(value: Buffer): void;
  finish(): void;
} {
  let pending = Buffer.alloc(0);
  return {
    chunk(value) {
      let rest = value;
      for (;;) {
        const newline = rest.indexOf(10);
        if (newline < 0) break;
        if (pending.length + newline > 65_536) throw new Error("Frame record exceeds 64 KiB.");
        consume(Buffer.concat([pending, rest.subarray(0, newline)]).toString("utf8"));
        pending = Buffer.alloc(0);
        rest = rest.subarray(newline + 1);
      }
      if (pending.length + rest.length > 65_536) throw new Error("Frame record exceeds 64 KiB.");
      pending = Buffer.concat([pending, rest]);
    },
    finish() {
      if (pending.length) throw new Error("Incomplete frame record at EOF.");
    },
  };
}
