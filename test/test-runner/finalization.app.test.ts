import { describe, expect, test } from "bun:test";
import {
  link,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

import { finalizeRun, type FinalizationHooks } from "../../scripts/testing/finalization.ts";
import {
  allocateRun,
  removeRun,
  runPath,
  type RunContext,
} from "../../scripts/testing/run-context.ts";
import {
  processDiagnostic,
  refreshSummaryState,
  renderSummary,
  type InvocationSummary,
} from "../../scripts/testing/summary.ts";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils.ts";

function summary(keepResults: boolean): InvocationSummary {
  return {
    schema: 1,
    selected: ["unit"],
    keepResults,
    state: "passed",
    errors: [],
    leaves: [
      {
        suite: "unit",
        state: "passed",
        errors: [],
        versions: { bun: "synthetic-version" },
        counts: {
          tests: 2,
          assertions: 4,
          failures: 0,
          errors: 0,
          skipped: 0,
          durationSeconds: 0.25,
          files: ["test/example.unit.test.ts"],
        },
        processes: [],
      },
    ],
  };
}
async function exists(path: string): Promise<boolean> {
  return Boolean(await lstat(path).catch(() => undefined));
}
async function withRun(
  keep: boolean,
  run: (context: RunContext, value: InvocationSummary) => Promise<void>,
) {
  const context = await allocateRun(REPO_ROOT, ["unit"], keep);
  try {
    await run(context, summary(keep));
  } finally {
    if (await exists(context.root)) await removeRun(context);
  }
}
async function stored(context: RunContext): Promise<InvocationSummary> {
  return JSON.parse(await readFile(runPath(context, "results/summary.json"), "utf8"));
}

describe("managed run finalization", () => {
  test.each([false, true])(
    "uses provisional storage and cleans scratch with keep=%s",
    async (keep) => {
      await withRun(keep, async (context, value) => {
        const output = runPath(context, "results/unit/designated.html");
        await writeFile(output, "<h1>Generated</h1>");
        const stages: string[] = [];
        const hooks: FinalizationHooks = {
          before: async (stage) => {
            stages.push(stage);
            if (stage === "scratch-cleanup") {
              const pending = await stored(context);
              expect(pending.state).toBe("failed");
              expect(pending.errors).toContain("Finalization has not completed.");
            }
          },
        };
        await finalizeRun(context, value, true, hooks);
        expect(value.state).toBe("passed");
        expect(value.errors).toEqual([]);
        expect(await exists(runPath(context, "scratch"))).toBe(false);
        expect(stages.slice(0, 2)).toEqual(["initial-summary", "scratch-cleanup"]);
        if (keep) {
          expect(await readFile(output, "utf8")).toBe("<h1>Generated</h1>");
          expect(await stored(context)).toEqual(value);
          expect(value.retainedResultsPath).toBe(runPath(context, "results"));
        } else {
          expect(await exists(context.root)).toBe(false);
          expect(value.retainedResultsPath).toBeUndefined();
        }
        expect(value.remainingOwnedPath).toBeUndefined();
        const terminal = renderSummary(value);
        expect(terminal).toContain("unit: passed");
        expect(terminal).toContain("2 cases, 4 assertions");
        expect(terminal).toContain("bun=synthetic-version");
        expect(terminal).toContain(keep ? "Retained results: " : "No results were retained.");
      });
    },
  );

  test.each([false, true])("preserves leaf and cleanup errors with keep=%s", async (keep) => {
    await withRun(keep, async (context, value) => {
      value.leaves[0]!.state = "failed";
      value.leaves[0]!.errors.push("Test assertion failed.");
      await finalizeRun(context, value, true, {
        before: async (stage) => {
          if (stage === "scratch-cleanup") throw new Error("injected cleanup failure");
        },
      });
      expect(value.state).toBe("failed");
      expect(value.leaves[0]!.errors).toEqual(["Test assertion failed."]);
      expect(value.errors).toContain("Scratch cleanup failed: injected cleanup failure");
      expect(value.remainingOwnedPath).toBe(context.root);
      expect(await exists(runPath(context, "scratch"))).toBe(true);
      expect(await stored(context)).toEqual(value);
      expect(renderSummary(value)).toContain("Test assertion failed.");
      expect(renderSummary(value)).toContain("injected cleanup failure");
    });
  });

  test.each([false, true])(
    "removes an incomplete summary after storage failure with keep=%s",
    async (keep) => {
      await withRun(keep, async (context, value) => {
        await finalizeRun(context, value, true, {
          before: async (stage) => {
            if (stage === "initial-summary") {
              await writeFile(runPath(context, "results/summary.json"), "{partial");
              throw new Error("injected storage failure");
            }
          },
        });
        expect(value.state).toBe("failed");
        expect(value.errors).toContain("Summary storage failed: injected storage failure");
        expect(await exists(runPath(context, "results/summary.json"))).toBe(false);
        expect(await exists(runPath(context, "scratch"))).toBe(false);
        expect(value.retainedResultsPath).toBe(runPath(context, "results"));
      });
    },
  );

  test("does no scratch or root cleanup when owned processes are unverified", async () => {
    await withRun(false, async (context, value) => {
      const stages: string[] = [];
      await finalizeRun(context, value, false, {
        before: async (stage) => {
          stages.push(stage);
        },
      });
      expect(stages).toEqual(["initial-summary", "final-summary", "summary-close"]);
      expect(value.state).toBe("failed");
      expect(value.remainingOwnedPath).toBe(context.root);
      expect(await exists(runPath(context, "scratch/unit/home"))).toBe(true);
      expect(await stored(context)).toEqual(value);
    });
  });

  test.each(["results", "root"] as const)(
    "reports actual paths after partial %s removal",
    async (removed) => {
      await withRun(false, async (context, value) => {
        await finalizeRun(context, value, true, {
          before: async (stage) => {
            if (stage === "root-cleanup") {
              await rm(removed === "root" ? context.root : runPath(context, "results"), {
                recursive: true,
              });
              throw new Error("injected partial removal");
            }
          },
        });
        expect(value.state).toBe("failed");
        expect(value.errors).toContain("Run cleanup failed: injected partial removal");
        expect(value.retainedResultsPath).toBeUndefined();
        expect(value.remainingOwnedPath).toBe(removed === "root" ? undefined : context.root);
        expect(renderSummary(value)).toContain("No results were retained.");
        if (removed === "root") expect(renderSummary(value)).not.toContain(context.root);
      });
    },
  );

  test("does not overwrite a pre-existing summary", async () => {
    await withRun(false, async (context, value) => {
      const path = runPath(context, "results/summary.json");
      await writeFile(path, "earlier summary");
      await finalizeRun(context, value, true);
      expect(value.state).toBe("failed");
      expect(await readFile(path, "utf8")).toBe("earlier summary");
      expect(value.remainingOwnedPath).toBe(context.root);
    });
  });

  test.each(["replace", "hardlink"] as const)(
    "refuses final writes after summary ownership changes by %s",
    async (change) => {
      await withTempFixtureDir("summary-foreign", async (foreign) => {
        await withRun(true, async (context, value) => {
          const target = runPath(context, "results/summary.json");
          const linked = join(foreign, "independent.json");
          let before = "";
          await finalizeRun(context, value, true, {
            before: async (stage) => {
              if (stage === "final-summary") {
                if (change === "replace") {
                  await unlink(target);
                  await writeFile(target, "replacement content");
                } else await link(target, linked);
                before = await readFile(target, "utf8");
              }
            },
          });
          expect(value.state).toBe("failed");
          expect(
            value.errors.some((error) => error.startsWith("Final summary update failed:")),
          ).toBe(true);
          expect(await readFile(target, "utf8")).toBe(before);
          if (change === "hardlink") expect(await readFile(linked, "utf8")).toBe(before);
        });
      });
    },
  );

  test("removes its incomplete final write without deleting retained outputs", async () => {
    await withRun(true, async (context, value) => {
      const output = runPath(context, "results/unit/designated.html");
      await writeFile(output, "generated");
      await finalizeRun(context, value, true, {
        before: async (stage) => {
          if (stage === "final-summary") {
            await writeFile(runPath(context, "results/summary.json"), "{partial");
            throw new Error("interrupted final write");
          }
        },
      });
      expect(value.state).toBe("failed");
      expect(await exists(runPath(context, "results/summary.json"))).toBe(false);
      expect(await readFile(output, "utf8")).toBe("generated");
    });
  });

  test.each(["directory", "symlink"] as const)(
    "refuses a replaced results namespace (%s)",
    async (replacement) => {
      await withTempFixtureDir("summary-namespace", async (foreign) => {
        await withRun(true, async (context, value) => {
          const results = runPath(context, "results");
          const saved = results + "-original";
          await rename(results, saved);
          try {
            if (replacement === "symlink") await symlink(foreign, results);
            else await mkdir(results);
            await writeFile(
              join(replacement === "symlink" ? foreign : results, "sentinel"),
              "unchanged",
            );
            await finalizeRun(context, value, true);
            expect(value.state).toBe("failed");
            expect(await exists(runPath(context, "scratch"))).toBe(true);
            expect(
              await readFile(
                join(replacement === "symlink" ? foreign : results, "sentinel"),
                "utf8",
              ),
            ).toBe("unchanged");
            expect(value.retainedResultsPath).toBeUndefined();
          } finally {
            await rm(results, { recursive: true });
            await rename(saved, results);
          }
        });
      });
    },
  );

  test("removes a passing stored summary if its final close fails", async () => {
    await withRun(true, async (context, value) => {
      const output = runPath(context, "results/unit/designated.html");
      await writeFile(output, "generated");
      await finalizeRun(context, value, true, {
        before: async (stage) => {
          if (stage === "summary-close") {
            expect((await stored(context)).state).toBe("passed");
            throw new Error("injected close failure");
          }
        },
      });
      expect(value.state).toBe("failed");
      expect(value.errors).toContain("Summary storage close failed: injected close failure");
      expect(await exists(runPath(context, "results/summary.json"))).toBe(false);
      expect(await readFile(output, "utf8")).toBe("generated");
    });
  });

  test("reports a stale summary limitation if ownership changes during a close failure", async () => {
    await withTempFixtureDir("summary-close-link", async (foreign) => {
      await withRun(true, async (context, value) => {
        await finalizeRun(context, value, true, {
          before: async (stage) => {
            if (stage === "summary-close") {
              await link(runPath(context, "results/summary.json"), join(foreign, "linked.json"));
              throw new Error("injected close failure");
            }
          },
        });
        expect(value.state).toBe("failed");
        expect(
          value.errors.some((error) => error.startsWith("Persisted summary may be stale:")),
        ).toBe(true);
        expect(await readFile(runPath(context, "results/summary.json"), "utf8")).toBe(
          await readFile(join(foreign, "linked.json"), "utf8"),
        );
      });
    });
  });

  test("retains an allocated root location diagnostic when ownership is replaced", async () => {
    const context = await allocateRun(REPO_ROOT, ["unit"], true);
    const saved = context.root + "-original";
    await rename(context.root, saved);
    try {
      await mkdir(context.root);
      await writeFile(join(context.root, "sentinel"), "unchanged");
      const value = summary(true);
      await finalizeRun(context, value, true);
      expect(value.state).toBe("failed");
      expect(value.remainingOwnedPath).toBe(context.root);
      expect(renderSummary(value)).toContain("Remaining owned location: " + context.root);
      expect(value.retainedResultsPath).toBeUndefined();
      expect(await readFile(join(context.root, "sentinel"), "utf8")).toBe("unchanged");
    } finally {
      await rm(context.root, { recursive: true });
      await rename(saved, context.root);
      await removeRun(context);
    }
  });
});

describe("terminal invocation summaries", () => {
  test("keeps available counts and lifecycle reasons without raw process streams", () => {
    const value = summary(false);
    value.selected.push("pandoc");
    value.leaves.push({
      suite: "pandoc",
      state: "not-run",
      errors: ["Scheduling stopped after cancellation."],
      processes: [],
    });
    value.leaves[0]!.processes.push({
      stage: "test",
      result: processDiagnostic({
        ok: false,
        reason: "cancelled",
        exitCode: null,
        signal: "SIGTERM",
        stdout: "private stream",
        stderr: "private error",
        elapsedMs: 15,
        drainMs: 2,
        stopped: true,
        escalated: false,
        issues: ["Lifecycle diagnostic."],
        observations: [],
        signals: [{ elapsedMs: 5, signal: "SIGTERM" }],
      }),
    });
    refreshSummaryState(value);
    expect(value.state).toBe("failed");
    expect(JSON.stringify(value)).not.toContain("private");
    const text = renderSummary(value);
    expect(text).toContain("2 cases, 4 assertions");
    expect(text).toContain("pandoc: not-run");
    expect(text).toContain("Scheduling stopped after cancellation.");
    expect(text).toContain("test: cancelled");
    expect(text).toContain("Lifecycle diagnostic.");
    expect(text).toContain("No results were retained.");
  });
  test("does not print a removed results location", async () => {
    await withRun(true, async (context, value) => {
      await finalizeRun(context, value, true);
      await removeRun(context);
      const text = renderSummary(value);
      expect(text).toContain("No results were retained.");
      expect(text).not.toContain(context.root);
    });
  });
});
