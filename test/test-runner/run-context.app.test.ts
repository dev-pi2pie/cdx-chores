import { describe, expect, test } from "bun:test";
import { access, lstat, mkdir, readFile, rename, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  allocateRun,
  assertRunPath,
  assertRunRoot,
  fixtureEnvironment,
  readFixtureContext,
  removeRun,
  removeRunScratch,
  runPath,
  suitePath,
  TEST_CONTEXT_ENV,
} from "../../scripts/testing/run-context";
import { withTempFixtureDir } from "../helpers/cli-test-utils";
import { createSuiteEnvironment } from "../../scripts/testing/invocation";

describe("managed invocation ownership", () => {
  test("isolates suite homes and snapshots only allowed environment values", async () => {
    await withTempFixtureDir("run-context", async (repoRoot) => {
      const run = await allocateRun(repoRoot, ["unit", "app"], false);
      const source = {
        PATH: "/controlled/tools",
        HOME: "/personal",
        OPENAI_API_KEY: "secret",
        NODE_OPTIONS: "loader",
      };
      const unit = await createSuiteEnvironment(run, "unit", source);
      const app = await createSuiteEnvironment(run, "app", source);
      source.PATH = "/changed";
      expect(unit.PATH).toBe("/controlled/tools");
      expect(unit.HOME).not.toBe(app.HOME);
      expect(unit.HOME).toStartWith(runPath(run, "scratch/unit"));
      expect(unit.OPENAI_API_KEY).toBeUndefined();
      expect(unit.NODE_OPTIONS).toBeUndefined();
      expect(unit.TMPDIR).toBe(unit.TEMP);
      expect(await readFile(unit.GIT_CONFIG_GLOBAL!, "utf8")).toBe("");
      expect(Object.isFrozen(unit)).toBe(true);
      await removeRun(run);
    });
  });
  test("allocates disjoint concurrent roots and preserves earlier retained results", async () => {
    await withTempFixtureDir("run-context", async (repoRoot) => {
      const prior = await allocateRun(repoRoot, ["unit"], true);
      const priorResult = runPath(prior, "results/summary.json");
      await writeFile(priorResult, "earlier report");
      await removeRunScratch(prior);
      const [first, second] = await Promise.all([
        allocateRun(repoRoot, ["unit", "app"], false),
        allocateRun(repoRoot, ["unit", "app"], true),
      ]);
      expect(new Set([prior.root, first.root, second.root]).size).toBe(3);
      expect(suitePath(first, "unit", "scratch")).not.toBe(suitePath(first, "app", "scratch"));
      await writeFile(runPath(second, "results/app.junit.xml"), "second report");
      await removeRun(first);
      expect(await readFile(priorResult, "utf8")).toBe("earlier report");
      expect(await readFile(runPath(second, "results/app.junit.xml"), "utf8")).toBe(
        "second report",
      );
      await removeRun(second);
      await removeRun(prior);
    });
  });

  test("serializes an immutable suite context and rejects another repository owner", async () => {
    await withTempFixtureDir("run-context", async (repoRoot) => {
      const run = await allocateRun(repoRoot, ["unit"], false);
      const env = { [TEST_CONTEXT_ENV]: fixtureEnvironment(run, "unit") };
      const parsed = readFixtureContext(env, repoRoot)!;
      expect(parsed.suite).toBe("unit");
      expect(parsed.run.root).toBe(run.root);
      expect(Object.isFrozen(parsed.run)).toBe(true);
      expect(Object.isFrozen(parsed.run.suites)).toBe(true);
      expect(Object.isFrozen(parsed.run.directories[""])).toBe(true);
      expect(() => readFixtureContext(env, join(repoRoot, "examples"))).toThrow("Invalid managed");
      expect(() => suitePath(run, "app", "scratch")).toThrow("does not belong");
      await removeRun(run);
    });
  });

  test("refuses cleanup of a replaced root without deleting its replacement", async () => {
    await withTempFixtureDir("run-context", async (repoRoot) => {
      const run = await allocateRun(repoRoot, ["unit"], false);
      const displaced = run.root + "-displaced";
      await rename(run.root, displaced);
      await mkdir(run.root);
      await writeFile(join(run.root, "unrelated.txt"), "keep");
      expect(() => assertRunRoot(run)).toThrow("replaced");
      await expect(removeRun(run)).rejects.toThrow("replaced");
      expect(await readFile(join(run.root, "unrelated.txt"), "utf8")).toBe("keep");
    });
  });

  test("refuses a root symlink and leaves its destination intact", async () => {
    await withTempFixtureDir("run-context", async (repoRoot) => {
      const run = await allocateRun(repoRoot, ["unit"], false);
      const displaced = run.root + "-displaced";
      await rename(run.root, displaced);
      await symlink(displaced, run.root);
      await expect(removeRun(run)).rejects.toThrow("replaced");
      expect((await lstat(join(displaced, "scratch"))).isDirectory()).toBe(true);
    });
  });

  test("rejects replaced namespaces and symlinked descendants", async () => {
    await withTempFixtureDir("run-context", async (repoRoot) => {
      const run = await allocateRun(repoRoot, ["app"], true);
      const scratch = suitePath(run, "app", "scratch");
      await symlink(repoRoot, join(scratch, "escape"));
      expect(() => assertRunPath(run, "scratch/app/escape")).toThrow("symbolic links");
      await rename(runPath(run, "results"), runPath(run, "old-results"));
      await mkdir(runPath(run, "results"));
      expect(() => assertRunPath(run, "results")).toThrow("namespace was replaced");
      await removeRun(run);
    });
  });

  test("rejects a symlinked allocation parent without adopting a run", async () => {
    await withTempFixtureDir("run-context", async (repoRoot) => {
      const external = join(repoRoot, "external");
      await mkdir(external);
      await symlink(external, join(repoRoot, "examples"));
      await expect(allocateRun(repoRoot, ["unit"], false)).rejects.toThrow(
        "without symbolic links",
      );
      await expect(access(join(external, "playground"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("removes scratch separately while preserving results until the caller removes the owner", async () => {
    await withTempFixtureDir("run-context", async (repoRoot) => {
      const run = await allocateRun(repoRoot, ["pandoc"], true);
      await writeFile(runPath(run, "results/summary.json"), "summary");
      await removeRunScratch(run);
      await expect(access(runPath(run, "scratch"))).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(runPath(run, "results/summary.json"), "utf8")).toBe("summary");
      await removeRun(run);
      await expect(access(run.root)).rejects.toMatchObject({ code: "ENOENT" });
    });
  });

  test("rejects malformed contexts and traversal before filesystem access", async () => {
    expect(readFixtureContext({})).toBeUndefined();
    for (const text of ["", "null", "{}", "[]", "invalid"])
      expect(() => readFixtureContext({ [TEST_CONTEXT_ENV]: text })).toThrow("Invalid managed");
    await withTempFixtureDir("run-context", async (repoRoot) => {
      const run = await allocateRun(repoRoot, ["unit"], false);
      for (const path of [
        "../other",
        "/absolute",
        "scratch/../results",
        "scratch//unit",
        "scratch\\unit",
      ])
        expect(() => runPath(run, path)).toThrow("relative path");
      await removeRun(run);
      await expect(allocateRun(repoRoot, [], false)).rejects.toThrow("Invalid run suite");
      await expect(allocateRun(repoRoot, ["unit", "unit"], false)).rejects.toThrow(
        "Invalid run suite",
      );
    });
  });
});
