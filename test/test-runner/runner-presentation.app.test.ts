import { describe, expect, test } from "bun:test";
import { access } from "node:fs/promises";
import { Writable } from "node:stream";

import { completed, withRunner } from "./runner-support.ts";

describe("managed runner progress presentation", () => {
  test.each(["Prepare test run", "Unit · Preflight", "Unit · Test execution"])(
    "synchronous status failure at %s stops before taking process ownership",
    async (stage) => {
      await withRunner(async ({ roots, invoke }) => {
        let preflights = 0;
        let executions = 0;
        const stdout = new Writable();
        // Standard Writable defers callbacks after synchronous _write completion.
        // This adapter models a destination that acknowledges on the same stack.
        stdout.write = ((chunk: Buffer, callback: (error?: Error) => void) => {
          const failed = chunk.toString().includes(`▶ ${stage}\n`);
          callback(
            failed
              ? Object.assign(new Error("synthetic terminal failure"), { code: "EPIPE" })
              : undefined,
          );
          return !failed;
        }) as typeof stdout.write;
        const stderr = new Writable({
          write(_chunk, _encoding, callback) {
            callback();
          },
        });
        const result = await invoke(["all"], {
          streams: { stdout, stderr },
          dependencies: {
            preflight: async (options) => {
              preflights++;
              if (options.signal?.aborted) throw new Error("Preflight launched after abort.");
              return { process: completed() };
            },
            execute: async (options) => {
              executions++;
              if (options.signal?.aborted || options.output?.signal.aborted)
                throw new Error("Test launched after abort.");
              return completed();
            },
          },
        });
        expect(result.exitCode).toBe(1);
        expect(preflights).toBe(stage === "Unit · Test execution" ? 1 : 0);
        expect(executions).toBe(0);
        expect(roots).toHaveLength(stage === "Prepare test run" ? 0 : 1);
        for (const root of roots) await expect(access(root.root)).rejects.toThrow();
        expect(result.summary.errors.join(" ")).toContain("EPIPE");
        expect(result.summary.errors.join(" ")).not.toContain(
          "Owned work or ownership remains unverified",
        );
        expect(result.summary.remainingOwnedPath).toBeUndefined();
        expect(result.summary.retainedResultsPath).toBeUndefined();
        expect(result.summary.leaves.every((leaf) => leaf.counts === undefined)).toBe(true);
      });
    },
  );

  test("presents selection, suite stages, verified outcome, cleanup and final summary in order", async () => {
    await withRunner(async ({ output, invoke }) => {
      const result = await invoke(["unit"]);
      expect(result.exitCode).toBe(0);
      const text = output.join("");
      const positions = [
        "Selected: Unit",
        "▶ Validate selection",
        "▶ Prepare test run",
        "▶ Unit · Preflight",
        "▶ Unit · Test execution",
        "▶ Unit · Validate results",
        "▶ Unit · Validate fixture outputs",
        "✓ Unit · passed",
        "▶ Cleanup",
        "Test invocation: passed",
      ].map((stage) => text.indexOf(stage));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(
        positions.every((position, index) => index === 0 || position > positions[index - 1]!),
      ).toBe(true);
      expect(text.split("✓ Unit · passed")).toHaveLength(2);
      expect(text).toContain("No results were retained.");
    });
  });

  test("later aggregate failure preserves the already verified outcome and subsequent attempts", async () => {
    await withRunner(async ({ output, invoke }) => {
      const result = await invoke(["all"], {
        dependencies: {
          preflight: async ({ suite }) =>
            suite === "app"
              ? {
                  process: completed({ ok: false, reason: "exit-failed", exitCode: 1 }),
                  error: "Application prerequisite unavailable.",
                }
              : { process: completed() },
        },
      });
      expect(result.exitCode).toBe(1);
      expect(result.summary.leaves.map((leaf) => leaf.state)).toEqual([
        "passed",
        "failed",
        "passed",
        "passed",
      ]);
      const text = output.join("");
      expect(text).toContain("Selected: Unit, Application, Codex, Pandoc");
      const positions = [
        "✓ Unit · passed",
        "✗ Application · failed",
        "✓ Codex · passed",
        "✓ Pandoc · passed",
        "Test invocation: failed",
      ].map((stage) => text.indexOf(stage));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(
        positions.every((position, index) => index === 0 || position > positions[index - 1]!),
      ).toBe(true);
      expect(text).not.toContain("✗ Unit · failed");
      expect(text).not.toContain("▶ Application · Test execution");
    });
  });

  test("a printed passing test line cannot replace required report evidence", async () => {
    await withRunner(async ({ output, invoke }) => {
      const result = await invoke(["unit"], {
        dependencies: {
          execute: async (options) => {
            options.output!.write("stdout", "(pass) synthetic case\n999 pass\n");
            return completed();
          },
        },
      });
      expect(result.exitCode).toBe(1);
      expect(result.summary.leaves[0]!.state).toBe("failed");
      expect(result.summary.leaves[0]!.counts).toBeUndefined();
      const text = output.join("");
      expect(text).toContain("(pass) synthetic case\n999 pass\n");
      expect(text).toContain("▶ Unit · Validate results");
      expect(text).toContain("✗ Unit · failed");
      expect(text).not.toContain("✓ Unit · passed");
      expect(text).toContain("JUnit:");
      expect(text).toContain("Test invocation: failed");
    });
  });
});
