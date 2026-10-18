import { describe, expect, test } from "bun:test";
import { access, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { startFixtureProcess } from "../../scripts/testing/fixtures/fixture-process.ts";
import { removeFixtureDir } from "../../scripts/testing/fixtures/fixture-exports.ts";
import type { OwnedProcess } from "../../scripts/testing/execution/process.ts";
import type { InvocationSummary } from "../../scripts/testing/terminal/summary.ts";
import { UNIT_IGNORE_PATTERNS } from "../../scripts/testing/suites/selection.ts";
import { createTempFixtureDir, REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

async function prepareRepository(owner: string, source: string): Promise<string> {
  const repo = join(owner, "repo");
  await mkdir(join(repo, "test"), { recursive: true });
  await mkdir(join(repo, "home"));
  await mkdir(join(repo, "examples/playground/.tmp-tests"), { recursive: true });
  await cp(join(REPO_ROOT, "scripts/testing"), join(repo, "scripts/testing"), { recursive: true });
  await mkdir(join(repo, "src/utils"), { recursive: true });
  await cp(
    join(REPO_ROOT, "src/utils/xml-validation.ts"),
    join(repo, "src/utils/xml-validation.ts"),
  );
  await writeFile(
    join(repo, "bunfig.toml"),
    `[test]\nroot = "./test"\npathIgnorePatterns = ${JSON.stringify(UNIT_IGNORE_PATTERNS)}\n`,
  );
  await writeFile(join(repo, "test/example.unit.test.ts"), source);
  return repo;
}

function launch(repo: string, keep: boolean): OwnedProcess {
  return startFixtureProcess({
    executable: process.execPath,
    args: [join(repo, "scripts/testing/run.ts"), "unit", ...(keep ? ["--keep-results"] : [])],
    cwd: repo,
    env: { PATH: process.env.PATH, HOME: join(repo, "home") },
    timeoutMs: 12_000,
    graceMs: 1000,
    cleanupMs: 4000,
    maxOutputBytes: 8 * 1024 * 1024,
  });
}

describe("managed runner entry output shutdown", () => {
  test("blocked stderr exits without outer timeout and retains results", async () => {
    const deadline = performance.now() + 20_000;
    const owner = await createTempFixtureDir("runner-entry-output");
    let removable = true;
    const errors: unknown[] = [];
    try {
      // Exceed ordinary pipe buffering without reaching the 8 MiB capture limit.
      const repo = await prepareRepository(
        owner,
        'import {test,expect} from "bun:test";test("noisy",()=>{process.stderr.write("x".repeat(4*1024*1024));expect(1).toBe(1);});',
      );
      const runParent = join(repo, "examples/playground/.tmp-tests");
      const before = await readdir(runParent);
      // Reserve 12s execution + 4s total termination + 2s for assertions/cleanup.
      expect(deadline - performance.now()).toBeGreaterThanOrEqual(18_000);
      removable = false;
      const owned = launch(repo, true);
      owned.child.stderr.pause();
      const resume = () => owned.child.stderr.resume();
      owned.child.once("exit", resume);
      try {
        const result = await owned.completion;
        removable = result.stopped;
        expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
        expect(result.reason).toBe("exit-failed");
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain("terminal output delivery was incomplete");
        expect(result.stdout).toContain("Test invocation: failed");
        const after = await readdir(runParent);
        const added = after.filter((name) => !before.includes(name));
        expect(added).toHaveLength(1);
        const root = join(runParent, added[0]!);
        const summary: InvocationSummary = JSON.parse(
          await readFile(join(root, "results/summary.json"), "utf8"),
        );
        expect(summary.state).toBe("failed");
        expect(summary.leaves.map((leaf) => leaf.suite)).toEqual(["unit"]);
        const leaf = summary.leaves[0]!;
        expect(leaf.state).toBe("failed");
        expect(leaf.processes.map((entry) => entry.stage)).toEqual(["preflight", "test"]);
        expect(leaf.processes.every((entry) => entry.result.stopped)).toBe(true);
        expect(summary.errors.join(" ")).toContain("delivery incomplete");
        expect(summary.retainedResultsPath).toBe(join(root, "results"));
        expect(result.stdout).toContain(summary.retainedResultsPath!);
        expect(summary.remainingOwnedPath).toBeUndefined();
        await expect(access(join(root, "scratch"))).rejects.toMatchObject({ code: "ENOENT" });
      } finally {
        owned.child.stderr.resume();
        owned.child.removeListener("exit", resume);
        owned.shutdown();
        removable = (await owned.completion).stopped;
      }
    } catch (error) {
      errors.push(error);
    }
    // A failed launch/completion cannot authorize removing potentially live work.
    if (removable) {
      try {
        await removeFixtureDir(owner);
      } catch (error) {
        errors.push(error);
      }
    } else {
      errors.push(new Error("Runner entry shutdown is unconfirmed; fixture retained at " + owner));
    }
    if (errors.length > 1)
      throw new AggregateError(errors, "Runner entry fixture and cleanup failed");
    if (errors.length) throw errors[0];
  }, 20_000);

  test("SIGINT cancels a running synthetic test and completes owned cleanup", async () => {
    await withTempFixtureDir("runner-entry-cancel", async (owner) => {
      const repo = await prepareRepository(
        owner,
        'import {test} from "bun:test";test("waiting",async()=>{process.stdout.write("entry-test-ready\\n");await new Promise(()=>{});},30000);',
      );
      const runParent = join(repo, "examples/playground/.tmp-tests");
      const before = await readdir(runParent);
      const owned = launch(repo, false);
      let output = "";
      let signalled = false;
      const cancelWhenReady = (chunk: Buffer) => {
        output += chunk.toString();
        if (!signalled && output.includes("entry-test-ready")) {
          signalled = true;
          owned.child.kill("SIGINT");
        }
      };
      owned.child.stdout.on("data", cancelWhenReady);
      try {
        const result = await owned.completion;
        expect(signalled).toBe(true);
        expect(result.stopped, JSON.stringify(result.issues)).toBe(true);
        expect(result.reason).toBe("exit-failed");
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain("cancelled");
        expect(result.stdout).toContain("Test invocation: failed");
        expect(await readdir(runParent)).toEqual(before);
      } finally {
        owned.child.stdout.removeListener("data", cancelWhenReady);
        owned.child.stderr.resume();
        owned.shutdown();
        await owned.completion;
      }
    });
  }, 20_000);
});
