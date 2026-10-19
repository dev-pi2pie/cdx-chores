import { Worker } from "node:worker_threads";

import { DEFAULT_DOCX_LIMITS, type DocxLimits } from "../limits";
import type { DocxReadResult } from "../types";
import { runtimeAsset, runtimeModuleUrl } from "./assets";
import { limitDiagnostic, minimalDocxEnvironment, rssExceeded } from "./policy";
import { encodeResultFrame, RequestFrameDecoder, validateDocxReadResult } from "./protocol";

/** Test fixtures may supply fixed source assets and controlled RSS observations. */
export interface DocxChildOptions {
  workerUrl?: URL;
  sampleRss?: () => number;
}

export async function runDocxChild(options: DocxChildOptions = {}): Promise<void> {
  const decoder = new RequestFrameDecoder();
  const started = performance.now();
  const readRss = options.sampleRss ?? (() => process.memoryUsage.rss());
  let limits: DocxLimits = { ...DEFAULT_DOCX_LIMITS };
  let worker: Worker | undefined;
  let frozen = false;
  let sampling: NodeJS.Timeout | undefined;
  let deadline: NodeJS.Timeout | undefined;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  async function finish(result: DocxReadResult, publish = true): Promise<void> {
    if (frozen) return;
    frozen = true;
    clearInterval(sampling);
    clearTimeout(deadline);
    process.stdin.pause();
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        result = { ok: false, diagnostic: "docx_worker_error" };
      }
    }
    if (publish && result.ok && rssExceeded(readRss(), limits.peakRssBytes))
      result = { ok: false, diagnostic: "docx_limit:peakRssBytes" };
    if (publish) {
      let frame: Buffer;
      try {
        frame = encodeResultFrame(result, limits);
      } catch (error) {
        const diagnostic = limitDiagnostic(error);
        // A fixed failure remains small even when a deliberately tiny cap cannot carry it.
        frame = encodeResultFrame({ ok: false, diagnostic }, { ...limits, resultBytes: 1024 });
      }
      const beforePublishRss = readRss();
      if (result.ok && rssExceeded(beforePublishRss, limits.peakRssBytes)) {
        frame = encodeResultFrame(
          { ok: false, diagnostic: "docx_limit:peakRssBytes" },
          { ...limits, resultBytes: 1024 },
        );
      }
      await new Promise<void>((resolve) => {
        process.stdout.once("error", resolve);
        process.stdout.end(frame, () => {
          process.stdout.removeListener("error", resolve);
          resolve();
        });
      });
    }
    process.stdin.destroy();
    resolveDone();
  }

  function fail(diagnostic: string, publish = true): void {
    void finish({ ok: false, diagnostic }, publish);
  }

  function sample(): void {
    try {
      if (rssExceeded(readRss(), limits.peakRssBytes)) fail("docx_limit:peakRssBytes");
    } catch {
      fail("docx_worker_error");
    }
  }

  function start(): void {
    const request = decoder.request;
    limits = request.limits;
    clearTimeout(deadline);
    const remaining = limits.elapsedMilliseconds - (performance.now() - started);
    if (remaining <= 0) return fail("docx_limit:elapsedMilliseconds");
    deadline = setTimeout(() => fail("docx_limit:elapsedMilliseconds"), remaining);
    sample();
    if (frozen) return;
    sampling = setInterval(sample, limits.rssSampleMilliseconds);
    try {
      const moduleUrl = runtimeModuleUrl(
        import.meta.url,
        typeof __filename === "string" ? __filename : undefined,
      );
      worker = new Worker(options.workerUrl ?? runtimeAsset("docx-worker", moduleUrl), {
        eval: false,
        execArgv: [],
        env: minimalDocxEnvironment(process.env),
        trackUnmanagedFds: true,
        workerData: { bytes: request.bytes.buffer, limits },
        transferList: [request.bytes.buffer as ArrayBuffer],
      });
    } catch {
      return fail("docx_worker_error");
    }
    let received = false;
    worker.on("message", (message: unknown) => {
      if (frozen) return;
      if (received) return fail("docx_protocol_error");
      received = true;
      sample();
      if (frozen) return;
      try {
        void finish(validateDocxReadResult(message, limits));
      } catch {
        fail("docx_protocol_error");
      }
    });
    worker.once("error", () => fail("docx_worker_error"));
    worker.once("exit", () => {
      if (!frozen) fail("docx_worker_error");
    });
  }

  deadline = setTimeout(() => fail("docx_limit:elapsedMilliseconds"), limits.elapsedMilliseconds);
  process.stdin.on("data", (chunk: Buffer) => {
    if (frozen) return;
    try {
      const completedBefore = decoder.complete;
      decoder.push(chunk);
      if (!completedBefore && decoder.complete) start();
    } catch (error) {
      fail(limitDiagnostic(error));
    }
  });
  process.stdin.once("end", () => {
    if (!frozen) fail("docx_cancelled", false);
  });
  process.stdin.once("error", () => {
    if (!frozen) fail("docx_cancelled", false);
  });
  process.stdout.on("error", () => {
    if (!frozen) fail("docx_cancelled", false);
  });
  process.stdin.resume();
  await done;
}
