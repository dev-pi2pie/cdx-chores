import { describe, expect, test } from "bun:test";
import { access, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readFixtureContext } from "../../scripts/testing/run-context.ts";
import { SUITES } from "../../scripts/testing/selection.ts";
import { completed, reportPath, withRunner, writeReport } from "./runner-support.ts";

describe("managed runner scheduling", () => {
  test.each(["arguments", "config", "empty"])(
    "rejects invalid %s before allocation or prerequisites",
    async (kind) => {
      await withRunner(async ({ repo, roots, events, invoke }) => {
        if (kind === "config") await writeFile(join(repo, "bunfig.toml"), "[test]\nroot='wrong'\n");
        if (kind === "empty") await unlink(join(repo, "test/example.app.test.ts"));
        const result = await invoke(kind === "arguments" ? ["all", "--unknown"] : ["all"]);
        expect(result.exitCode).toBe(1);
        expect(roots).toHaveLength(0);
        expect(events).toHaveLength(0);
        expect(result.summary.errors.length).toBeGreaterThan(0);
      });
    },
  );

  test("runs each leaf exactly once in order and removes default results", async () => {
    await withRunner(async ({ roots, events, output, invoke }) => {
      const result = await invoke();
      expect(result.exitCode).toBe(0);
      expect(events).toEqual(SUITES.flatMap((suite) => [`preflight:${suite}`, `execute:${suite}`]));
      expect(result.summary.leaves.map((leaf) => leaf.state)).toEqual([
        "passed",
        "passed",
        "passed",
        "passed",
      ]);
      expect(result.summary.leaves.map((leaf) => leaf.counts?.tests)).toEqual([1, 1, 1, 1]);
      expect(roots).toHaveLength(1);
      await expect(access(roots[0]!.root)).rejects.toThrow();
      expect(output.join("\n")).toContain("passed");
    });
  });

  test("continues after ordinary test failure and passing XML cannot override nonzero exit", async () => {
    await withRunner(async ({ events, invoke }) => {
      const result = await invoke(["all"], {
        dependencies: {
          execute: async (options) => {
            const suite = readFixtureContext(options.env)!.suite;
            events.push(`execute:${suite}`);
            await writeReport(options);
            return completed(
              suite === "unit" ? { ok: false, reason: "exit-failed", exitCode: 3 } : {},
            );
          },
        },
      });
      expect(result.exitCode).toBe(1);
      expect(events).toEqual(SUITES.flatMap((suite) => [`preflight:${suite}`, `execute:${suite}`]));
      expect(result.summary.leaves.map((leaf) => leaf.state)).toEqual([
        "failed",
        "passed",
        "passed",
        "passed",
      ]);
      expect(result.summary.leaves[0]!.counts?.tests).toBe(1);
      expect(result.summary.leaves[0]!.errors.join(" ")).toContain("exit-failed");
    });
  });

  test.each(["missing-tool", "timeout"])(
    "failed %s preflight never launches tests or invents counts",
    async (kind) => {
      await withRunner(async ({ events, invoke }) => {
        const result = await invoke(["all"], {
          dependencies: {
            preflight: async ({ suite }) => {
              events.push(`preflight:${suite}`);
              return suite === "unit"
                ? {
                    process: completed({
                      ok: false,
                      reason: kind === "timeout" ? "timeout" : "exit-failed",
                      exitCode: 1,
                    }),
                    error:
                      kind === "timeout"
                        ? "Prerequisite deadline exceeded."
                        : "Required prerequisite is unavailable: example.",
                  }
                : { process: completed() };
            },
          },
        });
        expect(result.exitCode).toBe(1);
        expect(events).not.toContain("execute:unit");
        expect(events).toContain("execute:pandoc");
        expect(result.summary.leaves[0]!.counts).toBeUndefined();
        expect(result.summary.leaves[0]!.state).toBe("failed");
      });
    },
  );

  test.each(["missing", "malformed", "skipped", "mismatch"])(
    "rejects %s JUnit after a successful process",
    async (kind) => {
      await withRunner(async ({ invoke }) => {
        const result = await invoke(["unit"], {
          dependencies: {
            execute: async (options) => {
              if (kind === "malformed")
                await writeFile(reportPath(options), "<invalid>", { flag: "wx" });
              if (kind === "skipped")
                await writeReport(options, '<testcase name="one"><skipped/></testcase>');
              if (kind === "mismatch")
                await writeReport(options, undefined, "test/unselected.unit.test.ts");
              return completed();
            },
          },
        });
        expect(result.exitCode).toBe(1);
        expect(result.summary.leaves[0]!.state).toBe("failed");
        expect(result.summary.leaves[0]!.errors.join(" ")).toContain("JUnit:");
      });
    },
  );
});
