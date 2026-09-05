import { describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import {
  createOutputDelivery,
  type OutputDelivery,
} from "../../scripts/testing/execution/output.ts";
import { observeProcessGroup } from "../../scripts/testing/execution/process-table.ts";
import {
  type OwnedProcess,
  type OwnedProcessOptions,
} from "../../scripts/testing/execution/process.ts";
import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process.ts";
import { REPO_ROOT } from "../helpers/cli-test-utils";

const limits = { timeoutMs: 2500, graceMs: 250, cleanupMs: 1500 };

function immediate() {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  return { stream, chunks };
}

function held() {
  const chunks: Buffer[] = [];
  const callbacks: Array<() => void> = [];
  const stream = new Writable({
    highWaterMark: 1,
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callbacks.push(() => callback());
    },
  });
  return {
    stream,
    chunks,
    release() {
      callbacks.shift()?.();
    },
  };
}

function failing() {
  const stream = new Writable({
    write(_chunk, _encoding, callback) {
      callback(new Error("synthetic destination failure"));
    },
  });
  return stream;
}

function launch(program: string, overrides: Partial<OwnedProcessOptions> = {}): OwnedProcess {
  return startFixtureProcess({
    executable: process.execPath,
    args: ["-e", program],
    cwd: REPO_ROOT,
    env: { PATH: process.env.PATH },
    ...limits,
    ...overrides,
  });
}

async function waitFor(check: () => boolean, message: string): Promise<void> {
  const deadline = performance.now() + 1000;
  while (!check() && performance.now() < deadline) await delay(10);
  expect(check(), message).toBe(true);
}

async function assertStopped(owned: OwnedProcess): Promise<void> {
  const result = await owned.completion;
  expect(result.stopped).toBe(true);
  const remaining = await observeProcessGroup(result.groupId!, 500);
  expect(remaining.filter((member) => !member.state.startsWith("Z"))).toEqual([]);
}

function delivery(
  stdout: Writable,
  stderr: Writable,
  limits?: Parameters<typeof createOutputDelivery>[1],
) {
  return createOutputDelivery({ stdout, stderr }, limits);
}

describe("owned process output delivery", () => {
  test("delivers bytes before producer acknowledgement without replaying captured output", async () => {
    const stdout = immediate();
    const stderr = immediate();
    const output = delivery(stdout.stream, stderr.stream);
    const owned = launch(
      [
        "process.stdout.write(Buffer.from([0xf0, 0x9f]));",
        "setTimeout(() => {",
        "  process.stdout.write(Buffer.from([0x98, 0x80]));",
        '  process.stderr.write("first\\n");',
        '  process.stderr.write("second\\n");',
        "  process.stdin.once('data', () => process.exit(0));",
        "}, 30);",
        "setInterval(() => {}, 1000);",
      ].join("\n"),
      { output },
    );
    let completed = false;
    void owned.completion.then(() => {
      completed = true;
    });
    try {
      await waitFor(() => Buffer.concat(stdout.chunks).length === 4, "stdout was not delivered");
      await waitFor(
        () => Buffer.concat(stderr.chunks).toString("utf8") === "first\nsecond\n",
        "stderr was not delivered",
      );
      expect(completed).toBe(false);
      expect(Buffer.concat(stdout.chunks)).toEqual(Buffer.from([0xf0, 0x9f, 0x98, 0x80]));
      expect(Buffer.concat(stderr.chunks).toString("utf8")).toBe("first\nsecond\n");
      owned.child.stdin.end("ack\n");
      const result = await owned.completion;
      expect(result.ok).toBe(true);
      expect(result.stdout).toBe("😀");
      expect(result.stderr).toBe("first\nsecond\n");
      expect(Buffer.concat(stdout.chunks).toString("utf8")).toBe(result.stdout);
      await assertStopped(owned);
    } finally {
      owned.shutdown();
      await assertStopped(owned);
      output.dispose();
    }
  });

  test("waits for a slow terminal write after producer exit", async () => {
    const stdout = held();
    const stderr = immediate();
    const output = delivery(stdout.stream, stderr.stream, { stallMs: 1000, drainMs: 1000 });
    const owned = launch('process.stdout.write("draining\\n");', { output });
    let completed = false;
    void owned.completion.then(() => {
      completed = true;
    });
    try {
      await waitFor(() => stdout.chunks.length === 1, "terminal write was not attempted");
      await delay(300);
      expect(completed).toBe(false);
      stdout.release();
      const result = await owned.completion;
      expect(result.ok).toBe(true);
      expect(result.reason).toBe("completed");
      expect(result.stdout).toBe("draining\n");
      await assertStopped(owned);
    } finally {
      stdout.release();
      owned.shutdown();
      await assertStopped(owned);
      output.dispose();
    }
  });

  test("preserves a timeout when cancellation resumes a paused output source", async () => {
    const stdout = held();
    const stderr = immediate();
    const output = delivery(stdout.stream, stderr.stream, { stallMs: 1000, drainMs: 1000 });
    const owned = launch(
      'process.stdout.write("timeout-paused\\n"); setInterval(() => {}, 1000);',
      {
        output,
        timeoutMs: 100,
      },
    );
    const releaseTimer = setTimeout(() => stdout.release(), 150);
    try {
      await waitFor(() => stdout.chunks.length === 1, "terminal write was not backpressured");
      const result = await owned.completion;
      expect(result.reason).toBe("timeout");
      expect(result.stopped).toBe(true);
      expect(result.signals.map((entry) => entry.signal)).toEqual(["SIGTERM"]);
      await assertStopped(owned);
    } finally {
      clearTimeout(releaseTimer);
      stdout.release();
      owned.shutdown();
      await assertStopped(owned);
      output.dispose();
    }
  });

  test("fails final terminal draining after an exited producer", async () => {
    const stdout = held();
    const stderr = immediate();
    const output = delivery(stdout.stream, stderr.stream, { stallMs: 1000, drainMs: 40 });
    const owned = launch('process.stdout.write("final-drain\\n");', { output });
    try {
      const result = await owned.completion;
      expect(result.reason).toBe("output-failed");
      expect(result.stopped).toBe(true);
      expect(result.issues).toContain("Output delivery failed; stopping owned process.");
      await assertStopped(owned);
    } finally {
      stdout.release();
      owned.shutdown();
      await assertStopped(owned);
      output.dispose();
    }
  });

  test("bounds capture while delivering an eight-mebibyte flood", async () => {
    const cap = 8 * 1024 * 1024;
    const stdout = immediate();
    const stderr = immediate();
    const output = delivery(stdout.stream, stderr.stream, { maxPendingBytes: cap });
    const owned = launch(
      `process.stdout.write(Buffer.alloc(${cap + 1}, 120)); setInterval(() => {}, 1000);`,
      {
        output,
        maxOutputBytes: cap,
      },
    );
    try {
      const result = await owned.completion;
      expect(result.reason).toBe("output-limit");
      expect(Buffer.byteLength(result.stdout)).toBe(cap);
      expect(Buffer.concat(stdout.chunks).byteLength).toBe(cap);
      await assertStopped(owned);
    } finally {
      owned.shutdown();
      await assertStopped(owned);
      output.dispose();
    }
  });

  test("stops a producer when terminal delivery stalls", async () => {
    const stdout = held();
    const stderr = immediate();
    const output = delivery(stdout.stream, stderr.stream, { stallMs: 40, drainMs: 100 });
    const owned = launch('process.stdout.write("blocked\\n"); setInterval(() => {}, 1000);', {
      output,
    });
    try {
      const result = await owned.completion;
      expect(result.reason).toBe("output-failed");
      expect(result.ok).toBe(false);
      expect(result.stopped).toBe(true);
      expect(result.issues).toContain("Output delivery failed; stopping owned process.");
      await assertStopped(owned);
    } finally {
      stdout.release();
      owned.shutdown();
      await assertStopped(owned);
      output.dispose();
    }
  });

  test("cancellation resumes a backpressured producer and leaves an unrelated group alive", async () => {
    const stdout = held();
    const stderr = immediate();
    const output = delivery(stdout.stream, stderr.stream, { stallMs: 1000, drainMs: 1000 });
    const abort = new AbortController();
    const owned = launch('process.stdout.write("paused\\n"); setInterval(() => {}, 1000);', {
      output,
      signal: abort.signal,
    });
    const unrelated = launch("setInterval(() => {}, 1000);");
    try {
      await waitFor(() => stdout.chunks.length === 1, "backpressure was not reached");
      abort.abort();
      stdout.release();
      const result = await owned.completion;
      expect(result.reason).toBe("cancelled");
      expect(result.stopped).toBe(true);
      expect(
        (await observeProcessGroup(unrelated.child.pid!, 500)).some(
          (member) => member.pid === unrelated.child.pid,
        ),
      ).toBe(true);
      await assertStopped(owned);
    } finally {
      abort.abort();
      stdout.release();
      owned.shutdown();
      await assertStopped(owned);
      output.dispose();
      unrelated.shutdown();
      await assertStopped(unrelated);
    }
  });

  test("fails delivery without affecting an unrelated owned group", async () => {
    const stderr = immediate();
    const output = delivery(failing(), stderr.stream);
    const unrelated = launch("setInterval(() => {}, 1000);");
    const owned = launch('process.stdout.write("broken\\n"); setInterval(() => {}, 1000);', {
      output,
    });
    try {
      const result = await owned.completion;
      expect(result.reason).toBe("output-failed");
      expect(result.stopped).toBe(true);
      expect(
        (await observeProcessGroup(unrelated.child.pid!, 500)).some(
          (member) => member.pid === unrelated.child.pid,
        ),
      ).toBe(true);
      await assertStopped(owned);
    } finally {
      owned.shutdown();
      await assertStopped(owned);
      output.dispose();
      unrelated.shutdown();
      await assertStopped(unrelated);
    }
  });

  test("rejects a delivery that failed before process allocation", async () => {
    const stdout = immediate();
    const stderr = immediate();
    const output: OutputDelivery = delivery(stdout.stream, stderr.stream);
    stdout.stream.emit("error", new Error("synthetic destination failure"));
    try {
      expect(() => launch("process.exit(0);", { output })).toThrow("output delivery");
    } finally {
      output.dispose();
    }
  });
});
