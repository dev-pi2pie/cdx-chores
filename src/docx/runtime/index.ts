import { spawn, type ChildProcessByStdio } from "node:child_process";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { checkDocxLimit, resolveDocxLimits, type DocxLimits } from "../limits";
import type { DocxReadResult } from "../types";
import { runtimeAsset, runtimeModuleUrl, runtimeWorkingDirectory } from "./assets";
import { limitDiagnostic, minimalDocxEnvironment, requestMetadata } from "./policy";
import { encodeRequestHeader, ResultFrameDecoder } from "./protocol";

type ExtractionChild = ChildProcessByStdio<Writable, Readable, null>;
const chunkBytes = 64 * 1024;

export interface DocxReadOptions {
  signal?: AbortSignal;
  limits?: Partial<DocxLimits>;
}

export interface DocxSupervisor {
  read(path: string, options?: DocxReadOptions): Promise<DocxReadResult>;
}

interface SupervisorAssets {
  childPath: string;
  cwd: string;
  execPath: string;
  openInput: (path: string, flags: number) => Promise<DocxInputHandle>;
}

/** Minimal owned-file interface used by fixed source regression fixtures. */
export interface DocxInputHandle {
  stat(): Promise<{ isFile(): boolean }>;
  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position: null,
  ): Promise<{ bytesRead: number }>;
  close(): Promise<void>;
}

function failure(diagnostic: string): DocxReadResult {
  return { ok: false, diagnostic };
}

async function readBoundedInput(
  path: string,
  limits: DocxLimits,
  assertRunning: () => void,
  openInput: SupervisorAssets["openInput"],
  opened: (file: DocxInputHandle) => void,
  closed: () => void,
): Promise<Buffer> {
  assertRunning();
  // Nonblocking open rejects special-file surprises without waiting for a FIFO writer.
  const flags = constants.O_RDONLY | (process.platform === "win32" ? 0 : constants.O_NONBLOCK);
  const file = await openInput(path, flags);
  opened(file);
  try {
    assertRunning();
    if (!(await file.stat()).isFile()) throw new Error("docx_input_error");
    assertRunning();
    const chunks: Buffer[] = [];
    let length = 0;
    for (;;) {
      assertRunning();
      const next = Buffer.allocUnsafe(
        Math.min(chunkBytes, limits.compressedInputBytes - length + 1),
      );
      const { bytesRead } = await file.read(next, 0, next.byteLength, null);
      assertRunning();
      if (bytesRead === 0) return Buffer.concat(chunks, length);
      length += bytesRead;
      checkDocxLimit(length, "compressedInputBytes", limits);
      chunks.push(next.subarray(0, bytesRead));
    }
  } finally {
    await file.close();
    closed();
  }
}

function createSupervisor(assets: SupervisorAssets): DocxSupervisor {
  let active = false;
  // Keep an acquired handle owned even if close itself rejects or never settles.
  let retainedInputHandle: DocxInputHandle | undefined;
  return {
    async read(path, options = {}) {
      if (active) return failure("docx_supervisor_busy");
      active = true;
      let limits: DocxLimits;
      try {
        limits = resolveDocxLimits(options.limits);
      } catch {
        active = false;
        return failure("docx_limits_invalid");
      }
      const deadlineAt = performance.now() + limits.elapsedMilliseconds;
      let child: ExtractionChild | undefined;
      let inputSettled = true;
      let candidate: DocxReadResult | undefined;
      let closed = false;
      let unconfirmed = false;
      let cleanupStarted = false;
      let released = false;
      let processingTimer: NodeJS.Timeout | undefined;
      let termTimer: NodeJS.Timeout | undefined;
      let cleanupTimer: NodeJS.Timeout | undefined;
      let resolveSettled!: () => void;
      const settled = new Promise<void>((resolve) => {
        resolveSettled = resolve;
      });
      let resolveStopped!: () => void;
      const stopped = new Promise<void>((resolve) => {
        resolveStopped = resolve;
      });
      function ownershipSettled(): boolean {
        return inputSettled && !retainedInputHandle && (!child || closed);
      }
      function release(): void {
        if (released) return;
        released = true;
        active = false;
      }
      function dispose(): void {
        clearTimeout(processingTimer);
        clearTimeout(termTimer);
        clearTimeout(cleanupTimer);
        options.signal?.removeEventListener("abort", onAbort);
        if (closed && child) {
          child.stdin.removeAllListeners("error");
          child.stdout.removeAllListeners("data");
          child.stdout.removeAllListeners("end");
          child.stdout.removeAllListeners("error");
          child.removeAllListeners("error");
          child.removeAllListeners("close");
        }
      }
      function terminate(): void {
        if (!child || closed) return;
        child.stdin.destroy();
        try {
          child.kill("SIGTERM");
        } catch {
          // Cleanup is established by close, never by kill's return value.
        }
        termTimer ??= setTimeout(() => {
          if (closed) return;
          try {
            child?.kill("SIGKILL");
          } catch {
            // The cleanup deadline below reports an unconfirmed process.
          }
        }, limits.termGraceMilliseconds);
      }
      function finishCleanup(): void {
        if (!cleanupStarted || !ownershipSettled()) return;
        dispose();
        release();
        resolveSettled();
      }
      function startCleanup(terminateChild: boolean): void {
        if (!cleanupStarted) {
          cleanupStarted = true;
          clearTimeout(processingTimer);
          cleanupTimer = setTimeout(() => {
            if (ownershipSettled()) return finishCleanup();
            unconfirmed = true;
            candidate = failure("docx_cleanup_unconfirmed");
            terminate();
            // Keep input/process ownership and admission until settlement is confirmed.
            resolveSettled();
          }, limits.cleanupMilliseconds);
        }
        if (terminateChild) terminate();
        finishCleanup();
      }
      function fail(diagnostic: string): void {
        if (candidate) return;
        candidate = failure(diagnostic);
        resolveStopped();
        startCleanup(true);
      }
      function onAbort(): void {
        fail("docx_cancelled");
      }
      function assertRunning(): void {
        if (!candidate && performance.now() >= deadlineAt) fail("docx_limit:elapsedMilliseconds");
        if (candidate) throw new Error("docx_request_stopped");
      }
      processingTimer = setTimeout(
        () => fail("docx_limit:elapsedMilliseconds"),
        limits.elapsedMilliseconds,
      );
      options.signal?.addEventListener("abort", onAbort, { once: true });
      if (options.signal?.aborted) onAbort();

      try {
        assertRunning();
        inputSettled = false;
        // Own both fulfillment and rejection after a deadline returns to its caller.
        const input = readBoundedInput(
          path,
          limits,
          assertRunning,
          assets.openInput,
          (file) => {
            retainedInputHandle = file;
          },
          () => {
            retainedInputHandle = undefined;
          },
        )
          .then(
            (bytes) => ({ bytes }),
            (error: unknown) => ({ error }),
          )
          .then((outcome) => {
            inputSettled = true;
            finishCleanup();
            return outcome;
          });
        const inputOutcome = await Promise.race([input, stopped.then(() => undefined)]);
        if (!inputOutcome) {
          await settled;
          return candidate ?? failure("docx_cleanup_unconfirmed");
        }
        if ("error" in inputOutcome) throw inputOutcome.error;
        const bytes = inputOutcome.bytes;
        assertRunning();
        const metadata = requestMetadata(limits);
        checkDocxLimit(metadata.byteLength, "requestMetadataBytes", limits);
        const requestHeader = encodeRequestHeader(metadata.byteLength, bytes.byteLength);
        try {
          child = spawn(assets.execPath, [assets.childPath], {
            cwd: assets.cwd,
            env: minimalDocxEnvironment(process.env),
            shell: false,
            detached: false,
            windowsHide: true,
            stdio: ["pipe", "pipe", "ignore"],
          });
        } catch {
          fail("docx_startup_error");
        }
        if (child) {
          const decoder = new ResultFrameDecoder(limits);
          let stdoutEnded = false;
          let receivedResultBytes = 0;
          child.once("error", () => fail("docx_startup_error"));
          child.stdin.on("error", () => {
            if (!candidate) fail("docx_protocol_error");
          });
          child.stdout.on("data", (chunk: Buffer) => {
            if (candidate) return;
            try {
              assertRunning();
              receivedResultBytes += chunk.byteLength;
              decoder.push(chunk);
              assertRunning();
            } catch (error) {
              if (!candidate) fail(limitDiagnostic(error));
            }
          });
          child.stdout.once("error", () => fail("docx_protocol_error"));
          child.stdout.once("end", () => {
            stdoutEnded = true;
            if (candidate) return;
            if (receivedResultBytes === 0) return fail("docx_child_exit");
            try {
              assertRunning();
              const result = decoder.finish();
              assertRunning();
              candidate = result;
              startCleanup(false);
            } catch (error) {
              if (!candidate) fail(limitDiagnostic(error));
            }
          });
          child.once("close", (code, signal) => {
            closed = true;
            if (!candidate) candidate = failure("docx_child_exit");
            if (candidate.ok && (code !== 0 || signal !== null || !stdoutEnded))
              candidate = failure("docx_child_exit");
            startCleanup(false);
          });

          async function write(chunk: Buffer): Promise<void> {
            assertRunning();
            if (!child!.stdin.write(chunk)) {
              await new Promise<void>((resolve, reject) => {
                const stream = child!.stdin;
                const cleanup = () => {
                  stream.removeListener("drain", drained);
                  stream.removeListener("error", stopped);
                  stream.removeListener("close", stopped);
                };
                function drained() {
                  cleanup();
                  resolve();
                }
                function stopped() {
                  cleanup();
                  reject(new Error("docx_protocol_error"));
                }
                stream.once("drain", drained);
                stream.once("error", stopped);
                stream.once("close", stopped);
              });
            }
            assertRunning();
          }
          try {
            await write(requestHeader);
            await write(metadata);
            for (let offset = 0; offset < bytes.byteLength; offset += chunkBytes)
              await write(bytes.subarray(offset, offset + chunkBytes));
            // Keep stdin open as the parent-liveness signal until child completion.
          } catch (error) {
            if (!candidate) fail(limitDiagnostic(error));
          }
          await settled;
        }
      } catch (error) {
        if (!candidate) fail(limitDiagnostic(error, "docx_input_error"));
        await settled;
      } finally {
        if (ownershipSettled()) {
          dispose();
          release();
        } else if (unconfirmed) {
          // Late input/close handlers remain owned; no subsequent request is admitted.
          clearTimeout(processingTimer);
          options.signal?.removeEventListener("abort", onAbort);
        }
      }
      return candidate ?? failure("docx_child_exit");
    },
  };
}

/** One active request per factory owner; separately loaded owners have separate budgets. */
export function createDocxSupervisor(): DocxSupervisor {
  const moduleUrl = runtimeModuleUrl(
    import.meta.url,
    typeof __filename === "string" ? __filename : undefined,
  );
  return createSupervisor({
    childPath: fileURLToPath(runtimeAsset("docx-child", moduleUrl)),
    cwd: runtimeWorkingDirectory(moduleUrl),
    execPath: process.execPath,
    openInput: open,
  });
}

/** Only source test drivers inject fixture assets; the production factory accepts no paths. */
export function createDocxSupervisorForTesting(
  assets: Pick<SupervisorAssets, "childPath"> & Partial<Omit<SupervisorAssets, "childPath">>,
): DocxSupervisor {
  const moduleUrl = runtimeModuleUrl(
    import.meta.url,
    typeof __filename === "string" ? __filename : undefined,
  );
  return createSupervisor({
    childPath: assets.childPath,
    cwd: assets.cwd ?? runtimeWorkingDirectory(moduleUrl),
    execPath: assets.execPath ?? process.execPath,
    openInput: assets.openInput ?? open,
  });
}
