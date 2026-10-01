import assert from "node:assert/strict";
import { ProcessOperation } from "../../../../src/cli/process/streaming";
import { LineRecords } from "../../../../src/cli/process/records";
import { setTimeout as delay } from "node:timers/promises";
const mode = process.argv[2]!,
  subject = process.argv[3]!;
async function main() {
  const operation = new ProcessOperation();
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
      let ready = 0;
      let resolveReady!: () => void;
      const readiness = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });
      const calls = ["cooperative", "resistant"].map((name) => {
        const reader = new LineRecords((line) => {
          assert.equal(line, "ready");
          if (++ready === 2) resolveReady();
        });
        const task = operation.run("node", [subject, name], {
          consume: (chunk) => reader.chunk(chunk),
        });
        void task.catch(() => {});
        return task;
      });
      await readiness;
      const started = performance.now();
      operation.cancel();
      const outcomes = await Promise.allSettled(calls);
      const elapsed = performance.now() - started;
      assert.ok(outcomes.every((value) => value.status === "rejected"));
      assert.ok(elapsed >= 1900 && elapsed < 6500);
      assert.equal(operation.closureUnconfirmed, false);
      return { cancelled: 2, elapsed, closureConfirmed: true };
    }
    throw new Error("Unknown fixture case");
  } finally {
    await operation.dispose();
  }
}
main().then(
  (value) => console.log(JSON.stringify(value)),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
