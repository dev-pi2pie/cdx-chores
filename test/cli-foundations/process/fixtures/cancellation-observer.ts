import assert from "node:assert/strict";
import { spawn, type SpawnOptions } from "node:child_process";
import type { Readable } from "node:stream";
import { LineRecords } from "../../../../src/cli/process/records";

interface Observation {
  signals: { signal: NodeJS.Signals | number; at: number; sent: boolean }[];
  handledAt: number[];
  close?: { code: number | null; signal: NodeJS.Signals | null; at: number };
  drained: Promise<void>;
}

/** Extra fixture pipe stays observable after the operation stops consuming stdout. */
export function cancellationObserver() {
  const children = new Map<string, Observation>();
  return {
    launch(command: string, args: readonly string[], options: SpawnOptions) {
      const name = args[1]!;
      assert.equal(children.has(name), false);
      assert.ok(Array.isArray(options.stdio));
      assert.equal(options.stdio.length, 3);
      const child = spawn(command, args, { ...options, stdio: [...options.stdio, "pipe"] });
      const observed: Observation = { signals: [], handledAt: [], drained: Promise.resolve() };
      children.set(name, observed);
      const kill = child.kill.bind(child);
      child.kill = (signal) => {
        const attempt = { signal: signal ?? "SIGTERM", at: performance.now(), sent: false };
        observed.signals.push(attempt);
        attempt.sent = kill(signal);
        return attempt.sent;
      };
      child.once("close", (code, signal) => {
        observed.close = { code, signal, at: performance.now() };
      });
      const records = new LineRecords((line) => {
        assert.equal(line, "SIGTERM");
        observed.handledAt.push(performance.now());
      });
      observed.drained = (async () => {
        for await (const chunk of child.stdio[3] as Readable) await records.chunk(chunk);
        records.finish();
      })();
      void observed.drained.catch(() => {});
      return child;
    },
    async confirm(name: string, cancelledAt: number, graceMs: number) {
      const observed = children.get(name)!;
      assert.ok(observed, `Missing child observation: ${name}`);
      await observed.drained;
      const resistant = name !== "cooperative";
      const signals = observed.signals.map((entry) => entry.signal);
      assert.deepEqual(signals, resistant ? ["SIGTERM", "SIGKILL"] : ["SIGTERM"]);
      assert.ok(observed.signals.every((entry) => entry.sent));
      assert.equal(observed.handledAt.length, 1);
      const term = observed.signals[0]!;
      const handledAt = observed.handledAt[0]!;
      assert.ok(term.at >= cancelledAt);
      assert.ok(handledAt >= term.at);
      assert.ok(observed.close, "Signal attempts do not establish child closure.");
      assert.ok(observed.close.at >= handledAt);
      if (resistant) {
        const force = observed.signals[1]!;
        assert.ok(handledAt < force.at, "Child must handle SIGTERM before escalation.");
        assert.ok(force.at - term.at >= graceMs - 25, "Escalation was premature.");
        assert.ok(observed.close.at >= force.at);
        assert.equal(observed.close.code, null);
        assert.equal(observed.close.signal, "SIGKILL");
      } else {
        assert.equal(observed.close.code, 0);
        assert.equal(observed.close.signal, null);
      }
      return {
        signals,
        termHandled: true,
        closeCode: observed.close.code,
        closeSignal: observed.close.signal,
      };
    },
    async settle() {
      await Promise.all([...children.values()].map((child) => child.drained));
    },
  };
}
