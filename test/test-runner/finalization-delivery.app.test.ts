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

import {
  finalizeRun,
  type FinalizationHooks,
} from "../../scripts/testing/ownership/finalization.ts";
import {
  allocateRun,
  removeRun,
  runPath,
  type RunContext,
} from "../../scripts/testing/ownership/run-context.ts";
import {
  refreshSummaryState,
  type InvocationSummary,
} from "../../scripts/testing/terminal/summary.ts";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils.ts";

function summary(keepResults: boolean): InvocationSummary {
  return {
    schema: 1,
    selected: ["unit"],
    keepResults,
    state: "passed",
    errors: [],
    leaves: [{ suite: "unit", state: "passed", errors: [], processes: [] }],
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
function failedDelivery(
  value: InvocationSummary,
  message = "Final terminal delivery failed.",
): void {
  value.errors.push(message);
  refreshSummaryState(value);
}

describe("summary recovery after terminal delivery", () => {
  test("changes the retained passing summary to failed without replacing its inode", async () => {
    await withRun(true, async (context, value) => {
      const receipt = await finalizeRun(context, value, true);
      expect(receipt).toBeDefined();
      const path = runPath(context, "results/summary.json");
      const original = await lstat(path);
      expect((await stored(context)).state).toBe("passed");
      failedDelivery(value);
      await receipt!.persistFailure();
      expect(await stored(context)).toEqual(value);
      expect(value.state).toBe("failed");
      expect((await lstat(path)).ino).toBe(original.ino);
      expect((await lstat(path)).birthtimeMs).toBe(original.birthtimeMs);
      expect(await exists(runPath(context, "scratch"))).toBe(false);
    });
  });

  test("returns no recovery receipt after successful default removal", async () => {
    await withRun(false, async (context, value) => {
      const receipt = await finalizeRun(context, value, true);
      expect(receipt).toBeUndefined();
      failedDelivery(value);
      expect(value.state).toBe("failed");
      expect(await exists(context.root)).toBe(false);
    });
  });

  test("keeps original assertion and cleanup failures alongside output failure", async () => {
    await withRun(false, async (context, value) => {
      value.leaves[0]!.state = "failed";
      value.leaves[0]!.errors.push("Original test assertion failed.");
      const receipt = await finalizeRun(context, value, true, {
        before: async (stage) => {
          if (stage === "scratch-cleanup") throw new Error("original cleanup failure");
        },
      });
      expect(receipt).toBeDefined();
      failedDelivery(value);
      await receipt!.persistFailure();
      const persisted = await stored(context);
      expect(persisted).toEqual(value);
      expect(persisted.leaves[0]!.errors).toEqual(["Original test assertion failed."]);
      expect(persisted.errors).toContain("Scratch cleanup failed: original cleanup failure");
      expect(persisted.errors).toContain("Final terminal delivery failed.");
      expect(value.remainingOwnedPath).toBe(context.root);
    });
  });

  test.each(["file", "symlink", "hardlink"] as const)(
    "leaves a foreign %s untouched",
    async (replacement) => {
      await withTempFixtureDir("delivery-foreign", async (foreign) => {
        const target = join(foreign, "target.json");
        await writeFile(target, "foreign contents");
        await withRun(true, async (context, value) => {
          const receipt = await finalizeRun(context, value, true);
          const path = runPath(context, "results/summary.json");
          await rename(path, path + ".original");
          if (replacement === "file") await writeFile(path, "foreign contents");
          else if (replacement === "symlink") await symlink(target, path);
          else await link(target, path);
          failedDelivery(value);
          await receipt!.persistFailure();
          expect(await readFile(path, "utf8")).toBe("foreign contents");
          expect(await readFile(target, "utf8")).toBe("foreign contents");
          expect(value.state).toBe("failed");
          expect(
            value.errors.some((error) => error.startsWith("Persisted summary may be stale:")),
          ).toBe(true);
        });
      });
    },
  );

  test("refuses an added hardlink to the original summary", async () => {
    await withTempFixtureDir("delivery-added-link", async (foreign) => {
      await withRun(true, async (context, value) => {
        const receipt = await finalizeRun(context, value, true);
        const path = runPath(context, "results/summary.json");
        const original = await readFile(path, "utf8");
        await link(path, join(foreign, "linked.json"));
        failedDelivery(value);
        await receipt!.persistFailure();
        expect(await readFile(path, "utf8")).toBe(original);
        expect(await readFile(join(foreign, "linked.json"), "utf8")).toBe(original);
        expect(
          value.errors.some((error) => error.startsWith("Failure summary removal failed:")),
        ).toBe(true);
      });
    });
  });

  test("rechecks path ownership after opening before writing", async () => {
    await withRun(true, async (context, value) => {
      const path = runPath(context, "results/summary.json");
      const receipt = await finalizeRun(context, value, true, {
        before: async (stage) => {
          if (stage === "recovery-write") {
            await rename(path, path + ".original");
            await writeFile(path, "replacement after open");
          }
        },
      });
      failedDelivery(value);
      await receipt!.persistFailure();
      expect(await readFile(path, "utf8")).toBe("replacement after open");
      expect(JSON.parse(await readFile(path + ".original", "utf8")).state).toBe("passed");
      expect(
        value.errors.some((error) => error.startsWith("Persisted summary may be stale:")),
      ).toBe(true);
    });
  });

  test.each(["directory", "symlink"] as const)(
    "refuses a replaced root (%s)",
    async (replacement) => {
      await withTempFixtureDir("delivery-root-target", async (foreign) => {
        const context = await allocateRun(REPO_ROOT, ["unit"], true);
        const value = summary(true);
        const receipt = await finalizeRun(context, value, true);
        const saved = context.root + "-original";
        await rename(context.root, saved);
        try {
          if (replacement === "directory") await mkdir(context.root);
          else await symlink(foreign, context.root);
          const target = replacement === "directory" ? context.root : foreign;
          await writeFile(join(target, "sentinel"), "unchanged");
          failedDelivery(value);
          await receipt!.persistFailure();
          expect(await readFile(join(target, "sentinel"), "utf8")).toBe("unchanged");
          expect(value.retainedResultsPath).toBeUndefined();
          expect(value.remainingOwnedPath).toBe(context.root);
          expect(
            value.errors.some((error) => error.startsWith("Persisted summary may be stale:")),
          ).toBe(true);
        } finally {
          await rm(context.root, { recursive: true });
          await rename(saved, context.root);
          await removeRun(context);
        }
      });
    },
  );

  test.each(["recovery-write", "recovery-close"] as const)(
    "removes only its summary after %s failure",
    async (failureStage) => {
      await withRun(true, async (context, value) => {
        const path = runPath(context, "results/summary.json");
        const output = runPath(context, "results/unit/generated.html");
        await writeFile(output, "generated output");
        const receipt = await finalizeRun(context, value, true, {
          before: async (stage) => {
            if (stage === failureStage) {
              if (stage === "recovery-write") await writeFile(path, "{partial");
              throw new AggregateError(
                [new Error("write or close failed"), new Error("secondary storage detail")],
                "injected storage failure",
              );
            }
          },
        });
        failedDelivery(value);
        await receipt!.persistFailure();
        expect(value.state).toBe("failed");
        expect(value.errors).toContain("Final terminal delivery failed.");
        expect(value.errors.join("\n")).toContain("write or close failed");
        expect(value.errors.join("\n")).toContain("secondary storage detail");
        expect(await exists(path)).toBe(false);
        expect(await readFile(output, "utf8")).toBe("generated output");
        await receipt!.persistFailure();
        expect(await exists(path)).toBe(false);
      });
    },
  );

  test.each(["summary", "root"] as const)("does not recreate a missing %s", async (removed) => {
    await withRun(true, async (context, value) => {
      const receipt = await finalizeRun(context, value, true);
      const path = runPath(context, "results/summary.json");
      if (removed === "summary") await unlink(path);
      else await removeRun(context);
      failedDelivery(value);
      await receipt!.persistFailure();
      expect(await exists(path)).toBe(false);
      if (removed === "root") {
        expect(await exists(context.root)).toBe(false);
        expect(value.retainedResultsPath).toBeUndefined();
      }
      expect(value.errors).toEqual(["Final terminal delivery failed."]);
    });
  });

  test("preserves primary and fallback delivery errors across serial updates", async () => {
    await withRun(true, async (context, value) => {
      const receipt = await finalizeRun(context, value, true);
      failedDelivery(value);
      await receipt!.persistFailure();
      failedDelivery(value, "Fallback terminal delivery also failed.");
      await receipt!.persistFailure();
      expect((await stored(context)).errors).toEqual([
        "Final terminal delivery failed.",
        "Fallback terminal delivery also failed.",
      ]);
      expect((await stored(context)).state).toBe("failed");
    });
  });

  test("serializes concurrent persistence requests without holding idle handles", async () => {
    await withRun(true, async (context, value) => {
      let entered!: () => void;
      let release!: () => void;
      const firstEntered = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const firstReleased = new Promise<void>((resolve) => {
        release = resolve;
      });
      const stages: string[] = [];
      let writes = 0;
      const hooks: FinalizationHooks = {
        before: async (stage) => {
          if (stage === "recovery-write") {
            writes += 1;
            stages.push("write" + writes);
            if (writes === 1) {
              entered();
              await firstReleased;
            }
          }
          if (stage === "recovery-close") stages.push("close" + writes);
        },
      };
      const receipt = await finalizeRun(context, value, true, hooks);
      failedDelivery(value);
      const first = receipt!.persistFailure();
      await firstEntered;
      const second = receipt!.persistFailure();
      expect(writes).toBe(1);
      release();
      await Promise.all([first, second]);
      expect(stages).toEqual(["write1", "close1", "write2", "close2"]);
      expect(await stored(context)).toEqual(value);
    });
  });
});
