import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { ProcessOperation } from "../../../src/cli/process/streaming";

test("sent signals and exit alone cannot establish closure or permit replacement", async () => {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdio: [],
    kill: () => true,
  });
  let launches = 0;
  const operation = new ProcessOperation({
    launch: () => {
      launches++;
      return child as unknown as ChildProcess;
    },
    graceMs: 5,
    forceMs: 10,
  });
  const pending = operation.run("fake", []);
  void pending.catch(() => {});
  child.emit("exit", 0, null);
  operation.cancel();
  await expect(pending).rejects.toThrow("closure unconfirmed");
  expect(operation.closureUnconfirmed).toBe(true);
  await expect(operation.run("replacement", [])).rejects.toThrow();
  expect(launches).toBe(1);
  child.stdout.end();
  child.stderr.end();
  child.emit("close", 0, null);
  await expect(operation.dispose()).rejects.toThrow("closure unconfirmed");
});

test("an oversized native output queue stops the operation before delivering it", async () => {
  let delivered = false;
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdio: [],
    kill: () => {
      child.stdout.end();
      child.stderr.end();
      queueMicrotask(() => child.emit("close", null, "SIGTERM"));
      return true;
    },
  });
  const operation = new ProcessOperation({ launch: () => child as unknown as ChildProcess });
  const pending = operation.run("fake", [], {
    consume: () => {
      delivered = true;
    },
  });
  void pending.catch(() => {});
  child.stdout.write(Buffer.alloc(262145));
  await expect(pending).rejects.toThrow("Queued tool output");
  await operation.dispose();
  expect(delivered).toBe(false);
});

test("a consumer that does not settle blocks reuse even after child close", async () => {
  let release!: () => void, entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdio: [],
    kill: () => {
      child.stdout.end();
      child.stderr.end();
      queueMicrotask(() => child.emit("close", null, "SIGTERM"));
      return true;
    },
  });
  const operation = new ProcessOperation({
    launch: () => child as unknown as ChildProcess,
    graceMs: 5,
    forceMs: 10,
  });
  const pending = operation.run("fake", [], {
    consume: async () => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    },
  });
  void pending.catch(() => {});
  child.stdout.write("record\n");
  await ready;
  operation.cancel();
  await expect(pending).rejects.toThrow("closure unconfirmed");
  release();
  await expect(operation.dispose()).rejects.toThrow("closure unconfirmed");
  expect(operation.closureUnconfirmed).toBe(true);
});

test("Windows transition forces immediately but still waits for close", async () => {
  const signals: string[] = [];
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdio: [],
    kill: (signal: string) => {
      signals.push(signal);
      return true;
    },
  });
  const operation = new ProcessOperation({
    platform: "win32",
    launch: () => child as unknown as ChildProcess,
    forceMs: 20,
  });
  const pending = operation.run("fake", []);
  void pending.catch(() => {});
  operation.cancel();
  expect(signals).toEqual(["SIGKILL"]);
  child.stdout.end();
  child.stderr.end();
  child.emit("close", null, "SIGKILL");
  await expect(pending).rejects.toThrow("cancelled");
  await operation.dispose();
  expect(operation.closureUnconfirmed).toBe(false);
});
