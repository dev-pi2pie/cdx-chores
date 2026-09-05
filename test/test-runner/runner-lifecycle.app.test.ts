import { describe, expect, test } from "bun:test";
import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { completed, withRunner, writeReport } from "./runner-support.ts";

describe("managed runner cancellation and finalization", () => {
  test("already cancelled invocation allocates no run", async () => {
    await withRunner(async ({ roots, events, invoke }) => {
      const controller = new AbortController();
      controller.abort();
      const result = await invoke(["all"], { signal: controller.signal });
      expect(result.exitCode).toBe(1);
      expect(roots).toHaveLength(0);
      expect(events).toHaveLength(0);
      expect(result.summary.leaves.every((leaf) => leaf.state === "not-run")).toBe(true);
    });
  });

  test("cancellation before export completion fails the active attempt despite a passing report", async () => {
    await withRunner(async ({ events, invoke }) => {
      const controller = new AbortController();
      const result = await invoke(["all"], {
        signal: controller.signal,
        dependencies: {
          inspectExports: async () => {
            controller.abort();
            return { ok: true, cleanupVerified: true, issues: [] };
          },
        },
      });
      expect(result.exitCode).toBe(1);
      expect(result.summary.leaves[0]!.counts?.tests).toBe(1);
      expect(result.summary.leaves[0]!.state).toBe("failed");
      expect(result.summary.leaves[0]!.errors.join(" ")).toContain("cancelled");
      expect(events).not.toContain("preflight:app");
    });
  });

  test.each(["preflight", "test", "completed"])(
    "cancellation during %s preserves outcomes and stops scheduling",
    async (stage) => {
      await withRunner(async ({ events, invoke }) => {
        const controller = new AbortController();
        const result = await invoke(["all"], {
          signal: controller.signal,
          dependencies: {
            preflight: async ({ suite }) => {
              events.push(`preflight:${suite}`);
              if (stage === "preflight" || (stage === "completed" && suite === "app")) {
                controller.abort();
                return { process: completed({ ok: false, reason: "cancelled", exitCode: null }) };
              }
              return { process: completed() };
            },
            execute: async (options) => {
              events.push("execute:unit");
              if (stage === "completed") await writeReport(options);
              if (stage === "test") controller.abort();
              return completed(
                stage === "test" ? { ok: false, reason: "cancelled", exitCode: null } : {},
              );
            },
          },
        });
        expect(result.exitCode).toBe(1);
        expect(events).not.toContain("preflight:codex");
        expect(result.summary.leaves.map((leaf) => leaf.state)).toEqual(
          stage === "completed"
            ? ["passed", "failed", "not-run", "not-run"]
            : ["failed", "not-run", "not-run", "not-run"],
        );
        if (stage !== "completed") expect(result.summary.leaves[0]!.counts).toBeUndefined();
        expect(result.summary.errors.join(" ")).toContain("cancelled");
      });
    },
  );

  test.each(["outer", "nested"])(
    "unresolved %s work stops scheduling and export inspection and retains scratch",
    async (kind) => {
      await withRunner(async ({ roots, events, invoke }) => {
        let inspected = false;
        const result = await invoke(["all"], {
          dependencies: {
            execute: async () =>
              completed(
                kind === "outer" ? { ok: false, stopped: false, reason: "unverified" } : {},
              ),
            inspectProcesses: () => ({
              stopped: kind !== "nested",
              issues: kind === "nested" ? ["Nested fixture work is active."] : [],
            }),
            inspectExports: async () => {
              inspected = true;
              return { ok: true, cleanupVerified: true, issues: [] };
            },
          },
        });
        expect(result.exitCode).toBe(1);
        expect(inspected).toBe(false);
        expect(events).not.toContain("preflight:app");
        expect(result.summary.leaves.map((leaf) => leaf.state)).toEqual([
          "failed",
          "not-run",
          "not-run",
          "not-run",
        ]);
        expect(await readdir(roots[0]!.root)).toContain("scratch");
      });
    },
  );

  test.each(["thrown", "unverified", "recovered"])(
    "%s export cleanup controls whether scheduling can continue",
    async (kind) => {
      await withRunner(async ({ roots, events, invoke }) => {
        const result = await invoke(["all"], {
          dependencies: {
            inspectExports: async () => {
              if (kind === "thrown") throw new Error("Export receipt inspection failed.");
              return {
                ok: false,
                cleanupVerified: kind === "recovered",
                issues: ["Designated export failed."],
              };
            },
          },
        });
        expect(result.exitCode).toBe(1);
        expect(result.summary.leaves[0]!.errors.join(" ")).toContain(
          kind === "thrown" ? "Export receipt inspection failed." : "Designated export failed.",
        );
        if (kind === "recovered") {
          expect(events).toContain("execute:pandoc");
          await expect(access(roots[0]!.root)).rejects.toThrow();
        } else {
          expect(events).not.toContain("preflight:app");
          expect(await readdir(roots[0]!.root)).toContain("scratch");
        }
      });
    },
  );

  test.each(["default", "retained"])(
    "terminal failure diagnostics survive %s finalization",
    async (mode) => {
      const keep = mode === "retained";
      await withRunner(async ({ roots, output, invoke }) => {
        const result = await invoke(["unit", ...(keep ? ["--keep-results"] : [])], {
          dependencies: {
            preflight: async () => ({
              process: completed({ ok: false, reason: "exit-failed", exitCode: 1 }),
              error: "Required fixture dependency is absent.",
            }),
          },
        });
        expect(result.exitCode).toBe(1);
        const text = output.join("\n");
        expect(text).toContain("failed");
        expect(text).toContain("Required fixture dependency is absent.");
        expect(result.summary.leaves[0]!.counts).toBeUndefined();
        if (keep) {
          expect(await readdir(roots[0]!.root)).toContain("results");
          await expect(access(join(roots[0]!.root, "scratch"))).rejects.toThrow();
          expect(text).toContain(roots[0]!.root);
        } else await expect(access(roots[0]!.root)).rejects.toThrow();
      });
    },
  );

  test("concurrent roots and prior retained results remain independent", async () => {
    await withRunner(async ({ roots, invoke }) => {
      const first = await invoke(["unit", "--keep-results"]);
      expect(first.exitCode).toBe(0);
      const priorReport = join(roots[0]!.root, "results/unit.junit.xml");
      const original = await readFile(priorReport, "utf8");
      const results = await Promise.all([invoke(["unit"]), invoke(["unit", "--keep-results"])]);
      expect(results.map((result) => result.exitCode)).toEqual([0, 0]);
      expect(new Set(roots.map((root) => root.root)).size).toBe(3);
      expect(await readFile(priorReport, "utf8")).toBe(original);
      expect(roots.filter((root) => root.keepResults)).toHaveLength(2);
    });
  });
});
