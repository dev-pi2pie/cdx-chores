import { describe, expect, test } from "bun:test";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Writable } from "node:stream";

import { completed, withRunner, writeReport } from "./runner-support.ts";

const outputLimits = { maxPendingBytes: 64 * 1024, stallMs: 500, drainMs: 500 };

function pipeError(code: "EPIPE" | "EIO"): NodeJS.ErrnoException {
  return Object.assign(new Error("private destination details"), { code });
}

function capture(parts: string[]): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      parts.push(chunk.toString());
      setImmediate(callback);
    },
  });
}

function failWrites(code: "EPIPE" | "EIO"): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      setImmediate(() => callback(pipeError(code)));
    },
  });
}

async function storedSummary(root: string): Promise<{ state: string; errors: string[] }> {
  return JSON.parse(await readFile(join(root, "results/summary.json"), "utf8"));
}

describe("managed runner output delivery", () => {
  test("delivers execution bytes before completion exactly once and hides preflight protocol", async () => {
    await withRunner(async ({ invoke }) => {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const result = await invoke(["unit"], {
        streams: { stdout: capture(stdout), stderr: capture(stderr) },
        outputLimits,
        dependencies: {
          preflight: async () => ({
            process: completed({
              stdout: "private-preflight-protocol",
              stderr: "private-native-probe",
            }),
          }),
          execute: async (options) => {
            options.output!.write("stdout", "live-case-start\n");
            options.output!.write("stderr", "live-case-detail\n");
            expect(stdout.join("")).toBe("live-case-start\n");
            expect(stderr.join("")).toBe("live-case-detail\n");
            await writeReport(options);
            return completed({ stdout: "live-case-start\n", stderr: "live-case-detail\n" });
          },
        },
      });
      expect(result.exitCode).toBe(0);
      expect(stdout.join("").split("live-case-start")).toHaveLength(2);
      expect(stderr.join("")).toBe("live-case-detail\n");
      expect(stdout.join("")).toContain("Test invocation: passed");
      const delivered = stdout.join("") + stderr.join("");
      expect(delivered).not.toContain("private-preflight-protocol");
      expect(delivered).not.toContain("private-native-probe");
    });
  });

  test("an asynchronous destination failure stops later suites and cleans proven stopped work", async () => {
    await withRunner(async ({ roots, events, invoke }) => {
      const fallback: string[] = [];
      const result = await invoke(["all"], {
        streams: { stdout: failWrites("EPIPE"), stderr: capture(fallback) },
        outputLimits,
        dependencies: {
          execute: async (options) => {
            options.output!.write("stdout", "test progress\n");
            expect(await options.output!.flush()).toBe(false);
            await writeReport(options);
            return completed();
          },
        },
      });
      expect(result.exitCode).toBe(1);
      expect(events).not.toContain("preflight:app");
      expect(result.summary.leaves.map((leaf) => leaf.state)).toEqual([
        "failed",
        "not-run",
        "not-run",
        "not-run",
      ]);
      expect(result.summary.leaves[0]!.errors.join(" ")).toContain("output delivery failed");
      expect(result.summary.errors.join(" ")).toContain("EPIPE");
      expect(fallback.join("")).toContain("terminal output delivery was incomplete");
      await expect(access(roots[0]!.root)).rejects.toThrow();
    });
  });

  test("a stalled terminal callback has a bounded failure and prevents later scheduling", async () => {
    await withRunner(async ({ roots, events, invoke }) => {
      let acknowledge: (() => void) | undefined;
      const fallback: string[] = [];
      const stalled = new Writable({
        write(_chunk, _encoding, callback) {
          acknowledge = callback;
        },
      });
      try {
        const result = await invoke(["all"], {
          streams: { stdout: stalled, stderr: capture(fallback) },
          outputLimits: { ...outputLimits, stallMs: 50, drainMs: 100 },
          dependencies: {
            execute: async (options) => {
              options.output!.write("stdout", "pending progress\n");
              await writeReport(options);
              return completed();
            },
          },
        });
        expect(result.exitCode).toBe(1);
        expect(result.summary.errors.join(" ")).toMatch(/stalled|timed out/);
        expect(fallback.join("")).toContain("terminal output delivery was incomplete");
        expect(result.summary.errors.join(" ")).not.toContain("fallback drain timed out");
        expect(events).not.toContain("preflight:app");
        await expect(access(roots[0]!.root)).rejects.toThrow();
      } finally {
        acknowledge?.();
      }
    });
  });

  test("late final-summary delivery failure updates an already retained passing summary", async () => {
    await withRunner(async ({ roots, invoke }) => {
      let stateBeforeFailure: string | undefined;
      const stdout = new Writable({
        write(_chunk, _encoding, callback) {
          void storedSummary(roots[0]!.root).then((summary) => {
            stateBeforeFailure = summary.state;
            setImmediate(() => callback(pipeError("EPIPE")));
          }, callback);
        },
      });
      const fallback: string[] = [];
      const result = await invoke(["unit", "--keep-results"], {
        streams: { stdout, stderr: capture(fallback) },
        outputLimits,
      });
      expect(stateBeforeFailure).toBe("passed");
      expect(result.exitCode).toBe(1);
      expect(result.summary.leaves[0]!.state).toBe("passed");
      const stored = await storedSummary(roots[0]!.root);
      expect(stored.state).toBe("failed");
      expect(stored.errors.join(" ")).toContain("EPIPE");
      expect(fallback.join("")).toContain("Test invocation: failed");
      await expect(access(join(roots[0]!.root, "scratch"))).rejects.toThrow();
    });
  });

  test("late summary delivery failure does not recreate default results after cleanup", async () => {
    await withRunner(async ({ roots, invoke }) => {
      let removedBeforeFailure = false;
      const stdout = new Writable({
        write(_chunk, _encoding, callback) {
          void access(roots[0]!.root).then(
            () => callback(new Error("Run still existed.")),
            () => {
              removedBeforeFailure = true;
              setImmediate(() => callback(pipeError("EPIPE")));
            },
          );
        },
      });
      const result = await invoke(["unit"], {
        streams: { stdout, stderr: capture([]) },
        outputLimits,
      });
      expect(removedBeforeFailure).toBe(true);
      expect(result.exitCode).toBe(1);
      expect(result.summary.errors.join(" ")).toContain("EPIPE");
      expect(result.summary.retainedResultsPath).toBeUndefined();
      await expect(access(roots[0]!.root)).rejects.toThrow();
    });
  });

  test("fallback write failure preserves both destination failures in retained evidence", async () => {
    await withRunner(async ({ roots, invoke }) => {
      const result = await invoke(["unit", "--keep-results"], {
        streams: { stdout: failWrites("EPIPE"), stderr: failWrites("EIO") },
        outputLimits,
      });
      expect(result.exitCode).toBe(1);
      const errors = result.summary.errors.join(" ");
      expect(errors).toContain("EPIPE");
      expect(errors).toContain("EIO");
      expect(errors).not.toContain("private destination details");
      const stored = await storedSummary(roots[0]!.root);
      expect(stored.state).toBe("failed");
      expect(stored.errors.join(" ")).toContain("EPIPE");
      expect(stored.errors.join(" ")).toContain("EIO");
    });
  });

  test("late output failure preserves the earlier assertion and process failures", async () => {
    await withRunner(async ({ roots, invoke }) => {
      const result = await invoke(["unit", "--keep-results"], {
        streams: { stdout: failWrites("EPIPE"), stderr: capture([]) },
        outputLimits,
        dependencies: {
          execute: async (options) => {
            await writeReport(
              options,
              '<testcase name="assertion"><failure message="expected mismatch"/></testcase>',
            );
            return completed({ ok: false, reason: "exit-failed", exitCode: 1 });
          },
        },
      });
      expect(result.exitCode).toBe(1);
      const leaf = result.summary.leaves[0]!;
      expect(leaf.counts?.failures).toBe(1);
      expect(leaf.errors.join(" ")).toContain("exit-failed");
      expect(leaf.errors.join(" ")).toContain("JUnit:");
      expect(result.summary.errors.join(" ")).toContain("EPIPE");
      const persisted = await readFile(join(roots[0]!.root, "results/summary.json"), "utf8");
      expect(persisted).toContain("exit-failed");
      expect(persisted).toContain("JUnit:");
      expect(persisted).toContain("EPIPE");
    });
  });
});
