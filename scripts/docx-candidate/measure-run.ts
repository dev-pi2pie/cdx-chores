import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildDocumentPrompt } from "../../src/adapters/codex/document-rename/prompt";
import { DEFAULT_DOCX_LIMITS } from "../../src/docx/limits";
import { createDocxSupervisorForTesting, type DocxSupervisor } from "../../src/docx/runtime/index";
import type { DocxReadResult } from "../../src/docx/types";
import { normalizeDocxProvenance } from "../../test/document-rename/fixtures/docx-baseline/assertions";
import { createDocxMeasureCases } from "../../test/document-rename/fixtures/docx-measure-cases";
import { createCandidateEvidenceExtractor } from "./adapter";
import { emitProgress } from "./harness/protocol.mjs";
import { measurementWithinTime } from "./measurement-fit.mjs";
import type {
  CandidateMeasurement,
  ChildMeasurement,
  FrozenMeasurement,
  MeasurementReport,
} from "./measure-types";

const [workspace, load] = process.argv.slice(2);
assert(workspace);
const repetitions = 3;
const now = () => performance.timeOrigin + performance.now();
const shutdown = new AbortController();
process.once("SIGTERM", () => {
  shutdown.abort();
});

interface ReaderModule {
  readCandidateDocx: DocxSupervisor["read"];
  createCandidateEvidenceExtractor: typeof createCandidateEvidenceExtractor;
}

function assertFrozenEvidence(
  expected: FrozenMeasurement,
  evidence: Awaited<ReturnType<ReturnType<typeof createCandidateEvidenceExtractor>>>,
  path: string,
): void {
  assert.deepEqual(
    JSON.parse(JSON.stringify(evidence)),
    expected.result,
    `${expected.id}: evidence`,
  );
  assert(!("reason" in evidence), `${expected.id}: supported evidence`);
  assert.equal(
    buildDocumentPrompt({
      evidences: [{ path, evidence }],
      workingDirectory: dirname(path),
    }),
    expected.prompt,
    `${expected.id}: prompt`,
  );
}

async function ordinary(module: ReaderModule, path: string) {
  let result: DocxReadResult | undefined;
  const extract = module.createCandidateEvidenceExtractor(async (input) => {
    result = await module.readCandidateDocx(input, { signal: shutdown.signal });
    return result;
  });
  const started = now();
  const evidence = await extract(path);
  const milliseconds = now() - started;
  assert(result);
  return { result, evidence, milliseconds };
}

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

async function transitions(path: string, completed: number): Promise<void> {
  for (const transition of ["postparse", "postencode"]) {
    for (const position of ["below", "at", "above"]) {
      const id = `rss-${transition}-${position}`;
      await emitProgress({ event: "start", id });
      await rm(join(workspace!, "child-transition.json"), { force: true });
      const supervisor = createDocxSupervisorForTesting({
        childPath: join(workspace!, `measure-${transition}-${position}.mjs`),
      });
      const result = await supervisor.read(path, {
        signal: shutdown.signal,
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
      await emitProgress({ event: "complete", id, completed: ++completed });
    }
  }
}

async function candidate(): Promise<MeasurementReport> {
  assert(load === "idle" || load === "loaded");
  const cases = await materialize();
  const frozen = (
    JSON.parse(
      await readFile(join(workspace!, "measurement-expected.json"), "utf8"),
    ) as FrozenMeasurement[]
  ).map((capture) => normalizeDocxProvenance(capture, capture.id));
  assert.equal(frozen.length, 10, "Supported measurement expectations changed");
  assert.equal(new Set(frozen.map((capture) => capture.id)).size, frozen.length);
  assert.deepEqual(
    frozen.map((capture) => capture.id),
    cases.filter((item) => item.kind === "supported").map((item) => item.id),
    "Frozen measurement IDs or order changed",
  );
  for (const item of cases.filter((value) => value.kind === "supported")) {
    const expected = frozen.find((capture) => capture.id === item.id);
    assert(expected, `${item.id}: missing frozen measurement`);
    assert.equal(
      createHash("sha256").update(item.bytes).digest("hex"),
      expected.inputSha256,
      item.id,
    );
  }
  await emitProgress({ event: "scope", total: cases.length + (load === "idle" ? 6 : 0) });
  let completed = 0;
  // A fresh caller per lane avoids relying on GC to remove the high-memory lane.
  const retained = load === "loaded" ? Buffer.alloc(384 * 1024 * 1024, 0xa5) : undefined;
  if (retained) assert(process.memoryUsage.rss() > DEFAULT_DOCX_LIMITS.peakRssBytes);
  const samples: CandidateMeasurement[] = [];
  const esm = (await import(pathToFileURL(join(workspace!, "reader.mjs")).href)) as ReaderModule;
  const cjs = createRequire(import.meta.url)(join(workspace!, "reader.cjs")) as ReaderModule;
  for (const item of cases) {
    shutdown.signal.throwIfAborted();
    await emitProgress({ event: "start", id: item.id });
    const esmRun = await ordinary(esm, item.path);
    const cjsRun = await ordinary(cjs, item.path);
    const ordinaryResult = esmRun.result;
    const ordinaryEsmApiMilliseconds = esmRun.milliseconds;
    const ordinaryCjsApiMilliseconds = cjsRun.milliseconds;
    assert.deepEqual(cjsRun.result, ordinaryResult, `${item.id}: ordinary built formats differ`);
    assert.deepEqual(cjsRun.evidence, esmRun.evidence, `${item.id}: ordinary evidence differs`);
    const frozenExpected = frozen.find((capture) => capture.id === item.id);
    if (item.kind === "supported") {
      assert(frozenExpected);
      assertFrozenEvidence(frozenExpected, esmRun.evidence, item.path);
      assertFrozenEvidence(frozenExpected, cjsRun.evidence, item.path);
    } else {
      assert.deepEqual(ordinaryResult, { ok: false, diagnostic: item.diagnostic }, item.id);
      assert.deepEqual(esmRun.evidence, { reason: "docx_extract_error" }, item.id);
    }
    for (let repetition = 0; repetition < repetitions; repetition++) {
      const childPath = join(workspace!, "measure-child.mjs");
      const measurementPath = join(workspace!, "child-measurement.json");
      await rm(measurementPath, { force: true });
      let inputClosedAt = 0;
      let processingMilliseconds: number | null = null;
      let result: DocxReadResult | undefined;
      const supervisor = createDocxSupervisorForTesting({
        childPath,
        onProcessingFinished(elapsedMilliseconds) {
          processingMilliseconds = elapsedMilliseconds;
        },
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
      if (frozenExpected) assertFrozenEvidence(frozenExpected, evidence, item.path);
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
      const underTime = measurementWithinTime(
        processingMilliseconds,
        [finished - started, ordinaryCjsApiMilliseconds, ordinaryEsmApiMilliseconds],
        DEFAULT_DOCX_LIMITS.elapsedMilliseconds,
      );
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
        processingMilliseconds,
        ordinaryCjsApiMilliseconds,
        ordinaryEsmApiMilliseconds,
        inputMilliseconds: inputClosedAt - started,
        bootToFirstPolicySampleMilliseconds:
          child?.firstPolicySampleMs === null || !child
            ? null
            : child.firstPolicySampleMs - child.bootMs,
        policySamplingSpanMilliseconds:
          child?.firstPolicySampleMs === null || child?.lastPolicySampleMs === null || !child
            ? null
            : child.lastPolicySampleMs - child.firstPolicySampleMs,
        lastPolicySampleToApiCompletionMilliseconds:
          child?.lastPolicySampleMs === null || !child ? null : finished - child.lastPolicySampleMs,
        child,
        outcome: result.ok ? "evidence" : result.diagnostic,
        evidence,
        inputClosed,
        childExited,
        admissionReleased,
        fit,
      });
      if (!fit) await emitProgress({ event: "failure", id: item.id });
      // Touch again so the retained allocation cannot become dead before the final request.
      if (retained) retained[(repetition * 4096) % retained.length]! ^= 1;
    }
    await emitProgress({ event: "complete", id: item.id, completed: ++completed });
  }
  if (load === "idle") await transitions(cases[0]!.path, completed);
  assert.equal(samples.length, cases.length * repetitions);
  return { candidate: samples, passed: samples.every((sample) => sample.fit) };
}

const report = await candidate();
process.stdout.write(JSON.stringify(report));
