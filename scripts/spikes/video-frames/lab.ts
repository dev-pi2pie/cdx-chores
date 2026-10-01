import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SMOKE_LIMITS, checkSmokeProgress } from "./smoke-budget";
import { createSyntheticSmokeRun } from "./smoke-workspace";
import { runTool, scratchBytes, type ToolResult } from "./tools";

export interface Experiment {
  path: string;
  signal: AbortSignal;
  tool(
    command: string,
    args: string[],
    options?: Parameters<typeof runTool>[2],
  ): Promise<ToolResult>;
  images(count: number): void;
}

export async function createLab() {
  const run = await createSyntheticSmokeRun(2);
  let activeMs = 0;
  let images = 0;
  const results: object[] = [];
  const interruption = new AbortController();
  const interrupt = () => interruption.abort();
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  return {
    path: run.path,
    async check(
      name: string,
      expectedImages: number,
      estimatedExtraBytes: number,
      body: (experiment: Experiment) => Promise<object>,
    ): Promise<void> {
      interruption.signal.throwIfAborted();
      const existing = await scratchBytes(dirname(run.path));
      if (
        expectedImages > SMOKE_LIMITS.imagesPerCase ||
        expectedImages + images > SMOKE_LIMITS.imagesPerRun ||
        existing + estimatedExtraBytes >= SMOKE_LIMITS.scratchBytes
      )
        throw new Error("Smoke preflight budget exceeded; verification is incomplete.");
      const path = join(run.path, name);
      await mkdir(path);
      const started = performance.now();
      const control = new AbortController();
      const abort = () => control.abort(interruption.signal.reason);
      interruption.signal.addEventListener("abort", abort, { once: true });
      let violation: Error | undefined;
      let checking = false;
      const observe = async () => {
        if (checking) return;
        checking = true;
        try {
          checkSmokeProgress({
            caseElapsedMs: Math.floor(performance.now() - started),
            runElapsedMs: Math.floor(activeMs + performance.now() - started),
            scratchBytes: await scratchBytes(dirname(run.path)),
          });
        } catch (error) {
          violation = error instanceof Error ? error : new Error(String(error));
          control.abort(violation);
        } finally {
          checking = false;
        }
      };
      const monitoring = setInterval(() => {
        void observe();
      }, 250);
      const calls: object[] = [];
      let caseImages = 0;
      try {
        const details = await body({
          path,
          signal: control.signal,
          async tool(command, args, options) {
            const remaining = Math.min(
              SMOKE_LIMITS.caseMs - (performance.now() - started),
              SMOKE_LIMITS.runMs - activeMs - (performance.now() - started),
            );
            if (remaining <= 0) throw new Error("Smoke processing budget exceeded.");
            const result = await runTool(command, args, {
              ...options,
              signal: control.signal,
              timeoutMs: remaining,
            });
            calls.push({
              command,
              args,
              code: result.code,
              signal: result.signal,
              milliseconds: result.milliseconds,
              childPeakRssKiB: result.childPeakRssKiB,
              parentPeakRssBytes: result.parentPeakRssBytes,
            });
            return result;
          },
          images(count) {
            if (
              !Number.isSafeInteger(count) ||
              count < 0 ||
              caseImages + count > SMOKE_LIMITS.imagesPerCase ||
              images + count > SMOKE_LIMITS.imagesPerRun
            )
              throw new Error("Smoke image budget exceeded.");
            caseImages += count;
            images += count;
          },
        });
        await observe();
        if (violation) throw violation;
        control.signal.throwIfAborted();
        results.push({ name, outcome: "passed", images: caseImages, ...details, calls });
        console.log(`${name}: passed`);
      } catch (error) {
        results.push({ name, outcome: "failed", error: String(violation ?? error), calls });
        throw violation ?? error;
      } finally {
        clearInterval(monitoring);
        interruption.signal.removeEventListener("abort", abort);
        activeMs += performance.now() - started;
        await writeFile(
          join(run.path, "evidence.json"),
          JSON.stringify({ phase: 2, activeMs, images, results }, null, 2),
        );
      }
    },
    finish() {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
      console.log(`Retained synthetic review artifacts: ${run.path}`);
    },
  };
}
