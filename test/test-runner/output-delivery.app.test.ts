import { describe, expect, test } from "bun:test";
import { Readable, Writable } from "node:stream";
import { setImmediate as nextTurn, setTimeout as delay } from "node:timers/promises";

import { createOutputDelivery } from "../../scripts/testing/execution/output.ts";

function controlled(highWaterMark = 1) {
  const chunks: Buffer[] = [];
  const callbacks: Array<(error?: Error | null) => void> = [];
  const stream = new Writable({
    highWaterMark,
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callbacks.push(callback);
    },
  });
  return { stream, chunks, callbacks };
}

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

const limits = { maxPendingBytes: 16, stallMs: 80, drainMs: 40 };

describe("bounded terminal output delivery", () => {
  test("shows bytes before producer completion and preserves partial UTF-8 and stream order", async () => {
    const stdout = immediate();
    const stderr = immediate();
    const delivery = createOutputDelivery({ stdout: stdout.stream, stderr: stderr.stream });
    const bytes = Buffer.from("first: 🐈\nsecond\n");
    delivery.write("stdout", bytes.subarray(0, 9));
    expect(Buffer.concat(stdout.chunks)).toEqual(bytes.subarray(0, 9));
    delivery.write("stderr", "error one\n");
    delivery.write("stdout", bytes.subarray(9, 10));
    delivery.write("stderr", "error two\n");
    delivery.write("stdout", bytes.subarray(10));
    expect(await delivery.flush()).toBe(true);
    expect(Buffer.concat(stdout.chunks)).toEqual(bytes);
    expect(Buffer.concat(stderr.chunks).toString()).toBe("error one\nerror two\n");
    expect(delivery.snapshot().pendingBytes).toBe(0);
    delivery.dispose();
    await nextTurn();
    expect(stdout.stream.listenerCount("error")).toBe(0);
    expect(stdout.stream.writableEnded).toBe(false);
    expect(stderr.stream.destroyed).toBe(false);
  });

  test("accounts in-flight callbacks and resumes a paused source only on drain", async () => {
    const target = controlled();
    const source = new Readable({ read() {} });
    source.resume();
    const delivery = createOutputDelivery({ stdout: target.stream, stderr: target.stream }, limits);
    expect(target.stream.listenerCount("drain")).toBe(1);
    expect(target.stream.listenerCount("error")).toBe(1);
    delivery.write("stdout", "abc", source);
    expect(source.isPaused()).toBe(true);
    expect(delivery.snapshot()).toMatchObject({ pendingBytes: 3, writtenBytes: 0 });
    const flushed = delivery.flush();
    target.callbacks.shift()!();
    expect(await flushed).toBe(true);
    await nextTurn();
    expect(source.isPaused()).toBe(false);
    expect(delivery.snapshot()).toMatchObject({
      pendingBytes: 0,
      writtenBytes: 3,
      peakPendingBytes: 3,
    });
    delivery.dispose();
    source.destroy();
  });

  test("keeps shared destinations ordered and releases every paused producer", async () => {
    const target = controlled();
    const first = new Readable({ read() {} });
    const second = new Readable({ read() {} });
    const delivery = createOutputDelivery({ stdout: target.stream, stderr: target.stream }, limits);
    delivery.write("stdout", "one", first);
    delivery.write("stderr", "two", second);
    expect(first.isPaused()).toBe(true);
    expect(second.isPaused()).toBe(true);
    expect(delivery.snapshot().pendingBytes).toBe(6);
    target.callbacks.shift()!();
    target.callbacks.shift()!();
    expect(await delivery.flush()).toBe(true);
    expect(Buffer.concat(target.chunks).toString()).toBe("onetwo");
    expect(first.isPaused()).toBe(false);
    expect(second.isPaused()).toBe(false);
    delivery.dispose();
    first.destroy();
    second.destroy();
  });

  test("combined cap rejects overflow before Writable takes it and aborts once", async () => {
    const stdout = controlled();
    const stderr = controlled();
    const source = new Readable({ read() {} });
    const delivery = createOutputDelivery({ stdout: stdout.stream, stderr: stderr.stream }, limits);
    let aborts = 0;
    delivery.signal.addEventListener("abort", () => aborts++);
    delivery.write("stdout", "1234567890", source);
    delivery.write("stderr", "1234567");
    delivery.write("stdout", "ignored after failure");
    expect(delivery.failed).toBe(true);
    expect(aborts).toBe(1);
    expect(source.isPaused()).toBe(false);
    expect(stderr.chunks).toHaveLength(0);
    expect(delivery.snapshot()).toMatchObject({
      pendingBytes: 10,
      peakPendingBytes: 10,
      incomplete: true,
    });
    expect(delivery.issues.join()).toContain("pending byte limit exceeded");
    expect(await delivery.flush()).toBe(false);
    stdout.callbacks.shift()!();
    delivery.dispose();
    source.destroy();
  });

  test("the default combined pending budget admits exactly 1 MiB and rejects the next byte", () => {
    const target = controlled(2 * 1024 * 1024);
    const delivery = createOutputDelivery({ stdout: target.stream, stderr: target.stream });
    delivery.write("stdout", Buffer.alloc(1024 * 1024));
    expect(delivery.failed).toBe(false);
    expect(delivery.snapshot().pendingBytes).toBe(1024 * 1024);
    delivery.write("stderr", Buffer.from("x"));
    expect(delivery.failed).toBe(true);
    expect(delivery.snapshot().peakPendingBytes).toBe(1024 * 1024);
    expect(target.chunks).toHaveLength(1);
    target.callbacks.shift()!();
    delivery.dispose();
  });

  test("a stalled callback fails within the no-progress allowance and unpauses the producer", async () => {
    const target = controlled();
    const source = new Readable({ read() {} });
    const delivery = createOutputDelivery(
      { stdout: target.stream, stderr: target.stream },
      { ...limits, stallMs: 20 },
    );
    delivery.write("stdout", "stuck", source);
    await delay(50);
    expect(delivery.signal.aborted).toBe(true);
    expect(source.isPaused()).toBe(false);
    expect(delivery.issues.join()).toContain("stalled");
    target.callbacks.shift()!();
    delivery.dispose();
    source.destroy();
  });

  test("unacknowledged writes below the high water mark still hit the stall deadline", async () => {
    const target = controlled(1024);
    const source = new Readable({ read() {} });
    source.resume();
    const delivery = createOutputDelivery(
      { stdout: target.stream, stderr: target.stream },
      { ...limits, stallMs: 20 },
    );
    delivery.write("stdout", "stuck", source);
    expect(source.isPaused()).toBe(false);
    // A drain event is not callback progress and must not cancel the deadline.
    target.stream.emit("drain");
    await delay(50);
    expect(delivery.signal.aborted).toBe(true);
    expect(delivery.snapshot().pendingBytes).toBe(5);
    expect(delivery.issues.join()).toContain("stalled");
    target.callbacks.shift()!();
    delivery.dispose();
    source.destroy();
  });

  test("new writes do not renew a stalled destination's callback deadline", async () => {
    const target = controlled(1024);
    const delivery = createOutputDelivery(
      { stdout: target.stream, stderr: target.stream },
      { ...limits, stallMs: 100 },
    );
    delivery.write("stdout", "one");
    await delay(60);
    delivery.write("stdout", "two");
    await delay(60);
    expect(delivery.failed).toBe(true);
    expect(delivery.snapshot().pendingBytes).toBe(6);
    target.callbacks.shift()!();
    target.callbacks.shift()!();
    delivery.dispose();
  });

  test("a synchronous callback followed by write false cannot leave delivery blocked", async () => {
    const target = immediate();
    const source = new Readable({ read() {} });
    source.resume();
    target.stream.write = ((_chunk: Buffer, callback: (error?: Error | null) => void) => {
      callback();
      return false;
    }) as Writable["write"];
    const delivery = createOutputDelivery({ stdout: target.stream, stderr: target.stream }, limits);
    delivery.write("stdout", "done", source);
    expect(await delivery.flush()).toBe(true);
    expect(source.isPaused()).toBe(false);
    expect(delivery.snapshot()).toMatchObject({ pendingBytes: 0, writtenBytes: 4 });
    delivery.dispose();
    source.destroy();
  });

  test("progress renews the stall allowance during sustained backpressure", async () => {
    const target = controlled();
    const delivery = createOutputDelivery(
      { stdout: target.stream, stderr: target.stream },
      { ...limits, stallMs: 100 },
    );
    delivery.write("stdout", "one");
    delivery.write("stdout", "two");
    await delay(30);
    target.callbacks.shift()!();
    expect(delivery.snapshot().pendingBytes).toBe(3);
    await delay(30);
    expect(delivery.failed).toBe(false);
    target.callbacks.shift()!();
    expect(await delivery.flush()).toBe(true);
    delivery.dispose();
  });

  test("final drain has its own finite deadline even without backpressure", async () => {
    const target = controlled(1024);
    const delivery = createOutputDelivery({ stdout: target.stream, stderr: target.stream }, limits);
    delivery.write("stdout", "hung");
    expect(await delivery.flush()).toBe(false);
    expect(delivery.issues.join()).toContain("final drain timed out");
    target.callbacks.shift()!();
    delivery.dispose();
  });

  test("producer flush waits for buffered source bytes and EOF after backpressure", async () => {
    const target = controlled();
    const source = new Readable({ read() {} });
    const delivery = createOutputDelivery(
      { stdout: target.stream, stderr: target.stream },
      { ...limits, drainMs: 500 },
    );
    source.on("data", (chunk: Buffer) => delivery.write("stdout", chunk, source));
    source.push(Buffer.from("one"));
    source.push(Buffer.from("two"));
    source.push(null);
    await nextTurn();
    expect(source.isPaused()).toBe(true);
    expect(target.chunks.map((chunk) => chunk.toString())).toEqual(["one"]);
    let finished = false;
    const flushed = delivery.flush([source]).then((ok) => {
      finished = true;
      return ok;
    });
    target.callbacks.shift()!();
    await nextTurn();
    expect(finished).toBe(false);
    expect(target.chunks.map((chunk) => chunk.toString())).toEqual(["one", "two"]);
    target.callbacks.shift()!();
    expect(await flushed).toBe(true);
    expect(source.readableEnded).toBe(true);
    expect(source.listenerCount("end")).toBe(0);
    expect(source.listenerCount("close")).toBe(0);
    delivery.dispose();
  });

  test("producer flush cannot complete before EOF or wait indefinitely for it", async () => {
    const target = immediate();
    const source = new Readable({ read() {} });
    const delivery = createOutputDelivery({ stdout: target.stream, stderr: target.stream }, limits);
    expect(await delivery.flush([source])).toBe(false);
    expect(delivery.issues.join()).toContain("final drain timed out");
    expect(source.listenerCount("end")).toBe(0);
    expect(source.listenerCount("close")).toBe(0);
    delivery.dispose();
    source.destroy();
  });

  test("disposal settles a flush waiting only for producer EOF", async () => {
    const target = immediate();
    const source = new Readable({ read() {} });
    const delivery = createOutputDelivery({ stdout: target.stream, stderr: target.stream }, limits);
    const flushed = delivery.flush([source]);
    delivery.dispose();
    expect(await flushed).toBe(false);
    expect(source.listenerCount("end")).toBe(0);
    expect(source.listenerCount("close")).toBe(0);
    source.destroy();
  });

  test("async callback errors and subsequent error events remain safe after disposal", async () => {
    const target = controlled();
    const delivery = createOutputDelivery({ stdout: target.stream, stderr: target.stream }, limits);
    delivery.write("stdout", "bytes");
    delivery.dispose();
    const error = Object.assign(new Error("PRIVATE-OUTPUT-SENTINEL"), { code: "EPIPE" });
    target.callbacks.shift()!(error);
    await nextTurn();
    expect(delivery.failed).toBe(true);
    expect(delivery.issues.join()).toContain("EPIPE");
    expect(delivery.issues.join()).not.toContain("PRIVATE-OUTPUT-SENTINEL");
    expect(await delivery.flush()).toBe(false);
  });

  test("synchronous write throws cannot escape or retain pending accounting", async () => {
    const target = new Writable({
      write() {
        throw Object.assign(new Error("PRIVATE-OUTPUT-SENTINEL"), { code: "EIO" });
      },
    });
    const delivery = createOutputDelivery({ stdout: target, stderr: target }, limits);
    expect(() => delivery.write("stdout", "x")).not.toThrow();
    expect(await delivery.flush()).toBe(false);
    expect(delivery.snapshot().pendingBytes).toBe(0);
    expect(delivery.issues.join()).toContain("EIO");
    expect(delivery.issues.join()).not.toContain("PRIVATE-OUTPUT-SENTINEL");
    delivery.dispose();
  });

  test("observes late destination errors after a successful flush", async () => {
    const target = immediate();
    const delivery = createOutputDelivery({ stdout: target.stream, stderr: target.stream });
    delivery.write("stdout", "okay");
    expect(await delivery.flush()).toBe(true);
    target.stream.emit("error", Object.assign(new Error("late private error"), { code: "EPIPE" }));
    expect(delivery.failed).toBe(true);
    expect(await delivery.flush()).toBe(false);
    delivery.dispose();
  });

  test("empty flush succeeds and disposal preserves caller error listeners", async () => {
    const target = immediate();
    const listener = () => {};
    target.stream.on("error", listener);
    const delivery = createOutputDelivery({ stdout: target.stream, stderr: target.stream });
    expect(await delivery.flush()).toBe(true);
    delivery.dispose();
    delivery.dispose();
    await nextTurn();
    expect(target.stream.listeners("error")).toEqual([listener]);
    expect(target.stream.listenerCount("drain")).toBe(0);
    expect(target.stream.listenerCount("close")).toBe(0);
    expect(target.stream.destroyed).toBe(false);
  });

  test("fallback is attempted once on the surviving destination", async () => {
    const stdout = immediate();
    const stderr = immediate();
    const delivery = createOutputDelivery({ stdout: stdout.stream, stderr: stderr.stream });
    stdout.stream.emit("error", Object.assign(new Error("private"), { code: "EPIPE" }));
    await delivery.fallback("Delivery failed.\n");
    await delivery.fallback("must not repeat");
    expect(Buffer.concat(stderr.chunks).toString()).toBe("Delivery failed.\n");
    expect(delivery.snapshot().fallbackAttempted).toBe(true);
    expect(delivery.failed).toBe(true);
    delivery.dispose();
  });

  test("fallback skips an unacknowledged write even when it never applied backpressure", async () => {
    const stdout = controlled(1024);
    const stderr = immediate();
    const delivery = createOutputDelivery(
      { stdout: stdout.stream, stderr: stderr.stream },
      { ...limits, stallMs: 20 },
    );
    delivery.write("stdout", "hung");
    await delay(50);
    expect(delivery.failed).toBe(true);
    await delivery.fallback("failed");
    expect(Buffer.concat(stdout.chunks).toString()).toBe("hung");
    expect(Buffer.concat(stderr.chunks).toString()).toBe("failed");
    stdout.callbacks.shift()!();
    delivery.dispose();
  });

  test("fallback cannot exceed pending cap or recurse when both destinations fail", async () => {
    const stdout = controlled();
    const stderr = immediate();
    const delivery = createOutputDelivery({ stdout: stdout.stream, stderr: stderr.stream }, limits);
    delivery.write("stdout", "1234567890123456");
    delivery.write("stderr", "overflow");
    await delivery.fallback("fallback");
    expect(stderr.chunks).toHaveLength(0);
    expect(delivery.snapshot().peakPendingBytes).toBe(16);
    stdout.callbacks.shift()!();
    delivery.dispose();

    const first = immediate();
    const second = immediate();
    const both = createOutputDelivery({ stdout: first.stream, stderr: second.stream }, limits);
    first.stream.emit("error", new Error("private first"));
    second.stream.emit("error", new Error("private second"));
    await both.fallback("failure");
    await both.fallback("again");
    expect(first.chunks).toHaveLength(0);
    expect(second.chunks).toHaveLength(0);
    expect(both.issues.join()).toContain("no fallback destination");
    both.dispose();
  });

  test("disposing cancels a pending fallback deadline and settles its promise", async () => {
    const stdout = immediate();
    const stderr = controlled();
    const delivery = createOutputDelivery({ stdout: stdout.stream, stderr: stderr.stream }, limits);
    stdout.stream.emit("error", new Error("closed"));
    const fallback = delivery.fallback("failure");
    delivery.dispose();
    await fallback;
    const issues = delivery.issues;
    await delay(60);
    expect(delivery.issues).toEqual(issues);
    stderr.callbacks.shift()!();
  });

  test("fallback drain remains finite when the surviving stream hangs", async () => {
    const stdout = immediate();
    const stderr = controlled();
    const delivery = createOutputDelivery({ stdout: stdout.stream, stderr: stderr.stream }, limits);
    stdout.stream.emit("error", new Error("closed"));
    await delivery.fallback("failure");
    expect(delivery.issues.join()).toContain("fallback drain timed out");
    stderr.callbacks.shift()!();
    delivery.dispose();
  });
});
