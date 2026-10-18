import { describe, expect, test } from "bun:test";
import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Writable } from "node:stream";

import type { InvocationSummary } from "../../scripts/testing/terminal/summary.ts";
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

function failWrites(code: "EPIPE" | "EIO", marker = "Test invocation:"): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      setImmediate(() => callback(chunk.toString().includes(marker) ? pipeError(code) : undefined));
    },
  });
}

async function storedSummary(root: string): Promise<InvocationSummary> {
  return JSON.parse(await readFile(join(root, "results/summary.json"), "utf8"));
}

describe("managed runner output delivery", () => {
  test("failure delivering initial status leaves all suites unstarted and allocates no run", async () => {
    await withRunner(async ({ roots, events, invoke }) => {
      const result = await invoke(["all"], {
        streams: { stdout: failWrites("EPIPE", "cdx-chores"), stderr: capture([]) },
        outputLimits,
      });
      expect(result.exitCode).toBe(1);
      expect(roots).toHaveLength(0);
      expect(events).toHaveLength(0);
      expect(result.summary.leaves.every((leaf) => leaf.state === "not-run")).toBe(true);
      expect(result.summary.errors.join(" ")).toContain("EPIPE");
    });
  });

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
            await options.output!.flush();
            expect(stdout.join("").split("live-case-start")).toHaveLength(2);
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
        streams: { stdout: failWrites("EPIPE", "test progress"), stderr: capture(fallback) },
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

  test.each([
    ["stdout", "default"],
    ["stdout", "retained"],
    ["stderr", "default"],
    ["stderr", "retained"],
  ] as const)(
    "a stalled %s callback fails execution and finalizes %s results",
    async (channel, mode) => {
      await withRunner(async ({ roots, events, invoke }) => {
        const marker = `pending progress ${channel}/${mode}\n`;
        const withheld: Array<() => void> = [];
        const delivered: string[] = [];
        const fallback: string[] = [];
        const stalled = new Writable({
          write(chunk, _encoding, callback) {
            const text = chunk.toString();
            delivered.push(text);
            if (text === marker) withheld.push(callback);
            else setImmediate(callback);
          },
        });
        const healthy = capture(fallback);
        const keep = mode === "retained";
        try {
          const result = await invoke(["all", ...(keep ? ["--keep-results"] : [])], {
            streams:
              channel === "stdout"
                ? { stdout: stalled, stderr: healthy }
                : { stdout: healthy, stderr: stalled },
            outputLimits: { ...outputLimits, stallMs: 50, drainMs: 100 },
            dependencies: {
              execute: async (options) => {
                events.push("execute:unit");
                // Establish successful initial status delivery before withholding execution output.
                expect(await options.output!.flush()).toBe(true);
                options.output!.write(channel, marker);
                await writeReport(options);
                return completed();
              },
            },
          });
          expect(delivered.filter((text) => text === marker)).toEqual([marker]);
          expect(withheld).toHaveLength(1);
          expect(stalled.writableLength).toBe(Buffer.byteLength(marker));
          expect(result.exitCode).toBe(1);
          expect(result.outputFailed).toBe(true);
          expect(result.summary.state).toBe("failed");
          expect(result.summary.keepResults).toBe(keep);
          expect(result.summary.leaves.map((leaf) => leaf.suite)).toEqual([
            "unit",
            "app",
            "codex",
            "pandoc",
          ]);
          expect(result.summary.leaves.map((leaf) => leaf.state)).toEqual([
            "failed",
            "not-run",
            "not-run",
            "not-run",
          ]);
          expect(events).toEqual(["preflight:unit", "execute:unit"]);
          const leaf = result.summary.leaves[0]!;
          expect(leaf.processes.map((entry) => entry.stage)).toEqual(["preflight", "test"]);
          expect(leaf.processes.every((entry) => entry.result.stopped)).toBe(true);
          expect(leaf.counts).toMatchObject({ tests: 1, failures: 0, errors: 0, skipped: 0 });
          expect(leaf.errors.join(" ")).toContain("Test output delivery failed");
          expect(result.summary.leaves.slice(1).map((entry) => entry.processes)).toEqual([
            [],
            [],
            [],
          ]);
          const errors = result.summary.errors.join(" ");
          expect(errors).toContain(`Output ${channel}: destination stalled;`);
          expect(errors).toContain("delivery incomplete.");
          expect(errors).not.toMatch(
            /timed out|EPIPE|EIO|pending byte limit|no fallback destination/,
          );
          const terminal = fallback.join("");
          expect(terminal).toContain("terminal output delivery was incomplete");
          expect(terminal).toContain("Test invocation: failed");
          expect(result.summary.remainingOwnedPath).toBeUndefined();
          expect(terminal).not.toContain("Remaining owned location:");
          expect(roots).toHaveLength(1);
          const root = roots[0]!.root;
          // Observe product cleanup before withRunner removes any retained fixture roots.
          if (keep) {
            const retained = join(root, "results");
            expect(result.summary.retainedResultsPath).toBe(retained);
            expect(terminal).toContain(`Retained results: ${retained}`);
            expect(await readdir(root)).toEqual(["results"]);
            const stored = await storedSummary(root);
            expect(stored.state).toBe("failed");
            expect(stored.keepResults).toBe(true);
            expect(stored.errors).toEqual(result.summary.errors);
            expect(stored.leaves).toEqual(result.summary.leaves);
            expect(stored.retainedResultsPath).toBe(retained);
            expect(stored.remainingOwnedPath).toBeUndefined();
            await expect(access(join(root, "scratch"))).rejects.toMatchObject({ code: "ENOENT" });
          } else {
            expect(result.summary.retainedResultsPath).toBeUndefined();
            expect(terminal).toContain("No results were retained.");
            // invoke has finished fallback reporting, which must not recreate the removed run.
            await expect(access(root)).rejects.toMatchObject({ code: "ENOENT" });
          }
        } finally {
          for (const acknowledge of withheld) acknowledge();
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
      });
    },
    5000,
  );

  test("late final-summary delivery failure updates an already retained passing summary", async () => {
    await withRunner(async ({ roots, invoke }) => {
      let stateBeforeFailure: string | undefined;
      const stdout = new Writable({
        write(chunk, _encoding, callback) {
          if (!chunk.toString().includes("Test invocation:")) {
            setImmediate(callback);
            return;
          }
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
        write(chunk, _encoding, callback) {
          if (!chunk.toString().includes("Test invocation:")) {
            setImmediate(callback);
            return;
          }
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
