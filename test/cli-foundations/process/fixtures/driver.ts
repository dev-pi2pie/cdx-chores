import assert from "node:assert/strict";
import { PROCESS_LIMITS, ProcessOperation } from "../../../../src/cli/process/streaming";
import { LineRecords } from "../../../../src/cli/process/records";
import { setImmediate as nextTurn, setTimeout as delay } from "node:timers/promises";
import { cancellationObserver } from "./cancellation-observer";
const mode = process.argv[2]!,
  subject = process.argv[3]!;
async function main() {
  const observer =
    mode === "cancel" || mode === "input-cancel" ? cancellationObserver() : undefined;
  const inputGraceMs = 250;
  const operation = new ProcessOperation({
    ...(observer ? { launch: observer.launch } : {}),
    ...(mode === "input-cancel" ? { graceMs: inputGraceMs } : {}),
  });
  try {
    if (mode === "records") {
      let count = 0;
      const reader = new LineRecords(async (line) => {
        assert.match(line, /^\d+:x+$/);
        count++;
        if (count % 1000 === 0) await delay(2);
      });
      const result = await operation.run("node", [subject, "records"], {
        consume: (chunk) => reader.chunk(chunk),
      });
      reader.finish();
      assert.equal(count, 20000);
      assert.equal(result.code, 0);
      assert.equal(result.stdout.length, 0);
      return { count, streamed: true };
    }
    if (mode === "input") {
      const result = await operation.run("node", [subject, mode], {
        input: async (write, signal) => {
          for (let i = 0; i < 100; i++) {
            signal.throwIfAborted();
            await write(Buffer.alloc(32768, 7));
          }
        },
      });
      assert.equal(result.code, 0);
      assert.deepEqual(JSON.parse(result.stdout.toString()), { bytes: 3276800, sum: 22937600 });
      return { inputBytes: 3276800, backpressure: true };
    }
    if (mode === "input-failure") {
      await assert.rejects(() =>
        operation.run("node", [subject, mode], {
          input: async (write) => {
            for (let i = 0; i < 1000; i++) await write(Buffer.alloc(65536));
          },
        }),
      );
      assert.equal(operation.closureUnconfirmed, false);
      return { inputFailure: true, closureConfirmed: true };
    }
    if (mode === "input-cancel") {
      let resolveReady!: () => void;
      const readiness = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });
      const reader = new LineRecords((line) => {
        assert.equal(line, "ready");
        resolveReady();
      });
      let pendingWrite: Promise<void> | undefined;
      let writesStarted = 0,
        writesSettled = 0;
      let inputAbortedAt: number | undefined, producerSettledAt: number | undefined;
      const task = operation.run("node", [subject, mode], {
        input: async (write, signal) => {
          signal.addEventListener(
            "abort",
            () => {
              inputAbortedAt = performance.now();
            },
            { once: true },
          );
          try {
            for (;;) {
              signal.throwIfAborted();
              writesStarted++;
              pendingWrite = write(Buffer.alloc(65536));
              try {
                await pendingWrite;
              } finally {
                writesSettled++;
                pendingWrite = undefined;
              }
            }
          } finally {
            producerSettledAt = performance.now();
          }
        },
        consume: (chunk) => reader.chunk(chunk),
      });
      const prematureEnd = task.then(() => {
        throw new Error("Input ended before cancellation.");
      });
      await Promise.race([readiness, prematureEnd]);
      // Observe a real write spanning an event-loop turn, not merely producer entry.
      for (;;) {
        const writing = pendingWrite;
        await Promise.race([nextTurn(), prematureEnd]);
        if (writing && writing === pendingWrite) break;
      }
      assert.equal(writesStarted - writesSettled, 1);
      assert.equal(producerSettledAt, undefined);
      const started = performance.now();
      operation.cancel();
      await assert.rejects(task, { code: "PROCESS_CANCELLED", exitCode: 130 });
      reader.finish();
      assert.ok(inputAbortedAt !== undefined && inputAbortedAt >= started);
      assert.ok(producerSettledAt !== undefined && producerSettledAt >= inputAbortedAt);
      assert.equal(pendingWrite, undefined);
      assert.equal(writesStarted, writesSettled);
      assert.equal(operation.closureUnconfirmed, false);
      const child = await observer!.confirm(mode, started, inputGraceMs);
      return {
        inputCancelled: true,
        pendingWriteAtCancel: true,
        inputAborted: true,
        producerSettled: true,
        graceMs: inputGraceMs,
        child,
        closureConfirmed: true,
      };
    }
    if (mode === "prefix") {
      let count = 0;
      const reader = new LineRecords(() => ++count < 3);
      const result = await operation.run("node", [subject, "prefix"], {
        consume: (chunk) => reader.chunk(chunk),
      });
      reader.finish();
      assert.equal(count, 3);
      assert.equal(result.earlyStop, true);
      return { count, earlyStop: true };
    }
    if (mode === "metadata") {
      await assert.rejects(() => operation.run("node", [subject, mode]), /metadata exceeds/);
      return { limited: true };
    }
    if (mode === "stderr") {
      const result = await operation.run("node", [subject, mode]);
      assert.equal(result.code, 0);
      assert.equal(result.stderrTruncated, true);
      assert.ok(result.stderr.endsWith("TAIL!"));
      assert.ok(Buffer.byteLength(result.stderr) < 65600);
      return { tail: true };
    }
    if (mode === "progress") {
      const progress: object[] = [];
      const result = await operation.run("node", [subject, mode], {
        progress: (value) => {
          progress.push({ ...value });
        },
      });
      assert.equal(result.stdout.toString(), "ok");
      assert.deepEqual(progress, [{ frame: "1", out_time_us: "40000", progress: "end" }]);
      return { progress: true };
    }
    if (mode === "args") {
      const literal = "a path ; $(echo injection) `echo other`";
      const result = await operation.run("node", [subject, mode, literal]);
      assert.deepEqual(JSON.parse(result.stdout.toString()), [literal]);
      return { literal: true };
    }
    if (mode === "missing") {
      await assert.rejects(() => operation.run("cdx_process_missing_executable", []), /ENOENT/);
      return { missing: true };
    }
    if (mode === "cancel") {
      const ready = new Set<string>();
      const readers: LineRecords[] = [];
      let resolveReady!: () => void;
      const readiness = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });
      const calls = ["cooperative", "resistant"].map((name) => {
        const reader = new LineRecords((line) => {
          assert.equal(line, "ready");
          assert.equal(ready.has(name), false);
          ready.add(name);
          if (ready.size === 2) resolveReady();
        });
        readers.push(reader);
        const task = operation.run("node", [subject, name], {
          consume: (chunk) => reader.chunk(chunk),
        });
        void task.catch(() => {});
        return task;
      });
      await Promise.race([readiness, Promise.all(calls)]);
      assert.equal(ready.size, 2);
      const started = performance.now();
      operation.cancel();
      const outcomes = await Promise.allSettled(calls);
      const elapsed = performance.now() - started;
      assert.ok(outcomes.every((value) => value.status === "rejected"));
      for (const outcome of outcomes) {
        assert.ok(outcome.status === "rejected");
        assert.equal(outcome.reason.code, "PROCESS_CANCELLED");
        assert.equal(outcome.reason.exitCode, 130);
      }
      for (const reader of readers) reader.finish();
      assert.ok(elapsed >= 1900 && elapsed < 6500);
      assert.equal(operation.closureUnconfirmed, false);
      const cooperative = await observer!.confirm("cooperative", started, PROCESS_LIMITS.graceMs);
      const resistant = await observer!.confirm("resistant", started, PROCESS_LIMITS.graceMs);
      return {
        cancelled: 2,
        elapsed,
        graceMs: PROCESS_LIMITS.graceMs,
        cooperative,
        resistant,
        closureConfirmed: true,
      };
    }
    throw new Error("Unknown fixture case");
  } finally {
    await operation.dispose();
    await observer?.settle();
  }
}
main().then(
  (value) => console.log(JSON.stringify({ ...value, disposed: true })),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
