import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { DEFAULT_DOCX_LIMITS } from "../../src/docx/limits";
import { createDocxSupervisor, createDocxSupervisorForTesting } from "../../src/docx/runtime/index";
import type { DocxReadResult } from "../../src/docx/types";
import { createDocxMeasureCases } from "../../test/document-rename/fixtures/docx-measure-cases";
import { createCandidateEvidenceExtractor } from "./adapter";
import type {
  BaselineMeasurement,
  CandidateMeasurement,
  ChildMeasurement,
  MeasurementReport,
} from "./measure-types";

const [mode, workspace, load] = process.argv.slice(2);
assert(workspace);
const repetitions = 3;
const now = () => performance.timeOrigin + performance.now();
const shutdown = new AbortController();
const ownedBaselineChildren = new Set<ChildProcess>();
process.once("SIGTERM", () => {
  shutdown.abort();
  for (const child of ownedBaselineChildren) child.kill("SIGKILL");
});

function exited(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}

async function materialize() {
  const inputs = join(workspace!, "measure-inputs");
  await mkdir(inputs, { recursive: true });
  const cases = createDocxMeasureCases();
  return Promise.all(
    cases.map(async (item) => {
      const path = join(inputs, `${item.id}.docx`);
      await writeFile(path, item.bytes);
      return { ...item, path };
    }),
  );
}

async function transitions(path: string): Promise<void> {
  for (const transition of ["postparse", "postencode"]) {
    for (const position of ["below", "at", "above"]) {
      await rm(join(workspace!, "child-transition.json"), { force: true });
      const supervisor = createDocxSupervisorForTesting({
        childPath: join(workspace!, `measure-${transition}-${position}.mjs`),
      });
      const result = await supervisor.read(path, {
        // No interval can interleave with the fixed transition observations.
        limits: { peakRssBytes: 5, rssSampleMilliseconds: 1_000_000 },
      });
      if (position === "above")
        assert.deepEqual(result, { ok: false, diagnostic: "docx_limit:peakRssBytes" });
      else assert(result.ok);
      const observation = JSON.parse(
        await readFile(join(workspace!, "child-transition.json"), "utf8"),
      ) as { pid: number; samples: number };
      assert(exited(observation.pid));
      assert.equal(observation.samples, 4);
    }
  }
}

async function candidate(): Promise<MeasurementReport> {
  assert(load === "idle" || load === "loaded");
  const cases = await materialize();
  // A fresh caller per lane avoids relying on GC to remove the high-memory lane.
  const retained = load === "loaded" ? Buffer.alloc(384 * 1024 * 1024, 0xa5) : undefined;
  if (retained) assert(process.memoryUsage.rss() > DEFAULT_DOCX_LIMITS.peakRssBytes);
  const samples: CandidateMeasurement[] = [];
  const ordinary = createDocxSupervisor();
  const cjs = (await import(pathToFileURL(join(workspace!, "reader.cjs")).href)) as {
    readCandidateDocx: (path: string, options: { signal: AbortSignal }) => Promise<DocxReadResult>;
  };
  for (const item of cases) {
    shutdown.signal.throwIfAborted();
    const esmStarted = now();
    const ordinaryResult = await ordinary.read(item.path, { signal: shutdown.signal });
    const ordinaryEsmApiMilliseconds = now() - esmStarted;
    const cjsStarted = now();
    const cjsResult = await cjs.readCandidateDocx(item.path, { signal: shutdown.signal });
    const ordinaryCjsApiMilliseconds = now() - cjsStarted;
    assert.deepEqual(cjsResult, ordinaryResult, `${item.id}: ordinary built formats differ`);
    for (let repetition = 0; repetition < repetitions; repetition++) {
      const childPath = join(workspace!, "measure-child.mjs");
      const measurementPath = join(workspace!, "child-measurement.json");
      await rm(measurementPath, { force: true });
      let inputClosedAt = 0;
      let result: DocxReadResult | undefined;
      const supervisor = createDocxSupervisorForTesting({
        childPath,
        async openInput(path, flags) {
          const file = await open(path, flags);
          return {
            stat: () => file.stat(),
            read: (buffer, offset, length, position) => file.read(buffer, offset, length, position),
            async close() {
              await file.close();
              inputClosedAt = now();
            },
          };
        },
      });
      const extract = createCandidateEvidenceExtractor(async (path) => {
        const pending = supervisor.read(path, { signal: shutdown.signal });
        assert.deepEqual(await supervisor.read(path), {
          ok: false,
          diagnostic: "docx_supervisor_busy",
        });
        result = await pending;
        return result;
      });
      const callerRssBytes = process.memoryUsage.rss();
      const started = now();
      const evidence = await extract(item.path);
      const finished = now();
      assert(result);
      assert.deepEqual(result, ordinaryResult, `${item.id}: observed wrapper changed results`);
      const released = await supervisor.read(item.path, { signal: AbortSignal.abort() });
      const admissionReleased = !released.ok && released.diagnostic === "docx_cancelled";
      let child: ChildMeasurement | null = null;
      try {
        child = JSON.parse(await readFile(measurementPath, "utf8")) as ChildMeasurement;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const expected =
        item.kind === "supported"
          ? result.ok && !("reason" in evidence)
          : !result.ok && result.diagnostic === item.diagnostic && "reason" in evidence;
      const inputClosed = inputClosedAt >= started && inputClosedAt <= finished;
      const childExited =
        child === null ? item.diagnostic === "docx_limit:compressedInputBytes" : exited(child.pid);
      const underTime =
        finished - started <= 6_000 &&
        ordinaryCjsApiMilliseconds <= 6_000 &&
        ordinaryEsmApiMilliseconds <= 6_000;
      const underRss =
        child === null || child.observedPeakRssBytes <= DEFAULT_DOCX_LIMITS.peakRssBytes;
      const validSamples =
        child === null || (child.policySamples > 0 && child.policyPeakRssBytes > 0);
      const fit = Boolean(
        expected &&
        inputClosed &&
        childExited &&
        admissionReleased &&
        underTime &&
        underRss &&
        validSamples,
      );
      samples.push({
        id: item.id,
        kind: item.kind,
        repetition,
        callerLoad: load,
        callerRssBytes,
        apiMilliseconds: finished - started,
        processingMilliseconds:
          child?.lastPolicySampleMs === null || !child ? null : child.lastPolicySampleMs - started,
        ordinaryCjsApiMilliseconds,
        ordinaryEsmApiMilliseconds,
        inputMilliseconds: inputClosedAt - started,
        bootToFirstPolicySampleMilliseconds:
          child?.firstPolicySampleMs === null || !child
            ? null
            : child.firstPolicySampleMs - child.bootMs,
        supervisedProcessingMilliseconds:
          child?.firstPolicySampleMs === null || child?.lastPolicySampleMs === null || !child
            ? null
            : child.lastPolicySampleMs - child.firstPolicySampleMs,
        publicationValidationAndCleanupMilliseconds:
          child?.lastPolicySampleMs === null || !child ? null : finished - child.lastPolicySampleMs,
        child,
        outcome: result.ok ? "evidence" : result.diagnostic,
        evidence,
        inputClosed,
        childExited,
        admissionReleased,
        fit,
      });
      if (!fit) process.stderr.write(`measurement ${item.id}: failed\n`);
      // Touch again so the retained allocation cannot become dead before the final request.
      if (retained) retained[(repetition * 4096) % retained.length]! ^= 1;
    }
  }
  if (load === "idle") await transitions(cases[0]!.path);
  assert.equal(samples.length, cases.length * repetitions);
  return { kind: "candidate", candidate: samples, passed: samples.every((sample) => sample.fit) };
}

async function baseline(): Promise<MeasurementReport> {
  const cases = await materialize();
  const expected = JSON.parse(
    await readFile(join(workspace!, "candidate-idle.json"), "utf8"),
  ) as MeasurementReport;
  const samples: BaselineMeasurement[] = [];
  for (const item of cases) {
    for (let repetition = 0; repetition < repetitions; repetition++) {
      shutdown.signal.throwIfAborted();
      const started = performance.now();
      const run = await new Promise<{
        output: string;
        timedOut: boolean;
        code: number | null;
        signal: NodeJS.Signals | null;
      }>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ["--max-old-space-size=512", join(workspace!, "measure-baseline.mjs"), item.path],
          {
            cwd: workspace,
            detached: false,
            shell: false,
            stdio: ["ignore", "pipe", "ignore"],
            env: {
              NO_COLOR: "1",
              TMPDIR: workspace,
              TMP: workspace,
              TEMP: workspace,
              SystemRoot: process.env.SystemRoot ?? process.env.SYSTEMROOT,
            },
          },
        );
        ownedBaselineChildren.add(child);
        let output = "";
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, 15_000);
        child.once("error", (error) => {
          clearTimeout(timer);
          ownedBaselineChildren.delete(child);
          reject(error);
        });
        child.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString("utf8");
          if (Buffer.byteLength(output) > 1024 * 1024) {
            timedOut = true;
            child.kill("SIGKILL");
          }
        });
        child.once("close", (code, signal) => {
          clearTimeout(timer);
          ownedBaselineChildren.delete(child);
          resolve({ output, timedOut, code, signal });
        });
      });
      const apiMilliseconds = performance.now() - started;
      let measurement:
        | { extractionMilliseconds: number; peakRssBytes: number; outcome: string; result: unknown }
        | undefined;
      if (!run.timedOut && run.code === 0 && run.signal === null)
        measurement = JSON.parse(run.output) as typeof measurement;
      let matched = measurement !== undefined;
      if (measurement && item.kind === "supported") {
        const normalized = structuredClone(measurement.result) as {
          metadata?: { extractor?: string };
        };
        if (normalized.metadata?.extractor)
          normalized.metadata.extractor = normalized.metadata.extractor.replace(
            /^mammoth/,
            "docx-reader",
          );
        try {
          assert.deepEqual(
            normalized,
            expected.candidate!.find((sample) => sample.id === item.id)!.evidence,
          );
        } catch {
          matched = false;
        }
      }
      if (!matched) process.stderr.write(`baseline measurement ${item.id}: failed\n`);
      samples.push({
        id: item.id,
        repetition,
        apiMilliseconds,
        extractionMilliseconds: measurement?.extractionMilliseconds ?? 0,
        peakRssBytes: measurement?.peakRssBytes ?? 0,
        outcome: run.timedOut ? "timeout" : (measurement?.outcome ?? "process-failure"),
        confirmedClose: true,
        matched,
      });
    }
  }
  return { kind: "baseline", baseline: samples, passed: samples.every((sample) => sample.matched) };
}

const report =
  mode === "candidate" ? await candidate() : mode === "baseline" ? await baseline() : undefined;
assert(report, "Expected candidate or baseline measurement mode");
process.stdout.write(JSON.stringify(report));
