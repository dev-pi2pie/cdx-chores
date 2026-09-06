import { describe, expect, test } from "bun:test";
import { mkdir, symlink, access } from "node:fs/promises";
import { join } from "node:path";

import {
  runSuitePreflight,
  type PreflightLauncher,
} from "../../scripts/testing/execution/prerequisites.ts";
import { startOwnedProcess } from "../../scripts/testing/execution/process.ts";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

const success = JSON.stringify({ schema: 1, suite: "unit", versions: { bun: "1.4.1" } });
const fixture = (script: string, timeoutMs = 1500): PreflightLauncher => ({
  run: (options) =>
    startOwnedProcess({
      ...options,
      args: ["--eval", script],
      timeoutMs,
      graceMs: 100,
      cleanupMs: 1000,
    }).completion,
});
const options = {
  suite: "unit" as const,
  repoRoot: REPO_ROOT,
  bunExecutable: process.execPath,
  env: { PATH: process.env.PATH },
};

describe("bounded suite preflight", () => {
  test("unit succeeds with an empty PATH and no integration configuration", async () => {
    const result = await runSuitePreflight({ ...options, env: { PATH: "" } });
    expect(result.error).toBeUndefined();
    expect(result.versions?.bun).toBe(process.versions.bun);
    expect(result.process.stopped).toBe(true);
  });

  test("missing runner is a stopped launch failure without fabricated versions", async () => {
    const result = await runSuitePreflight({ ...options, bunExecutable: "/missing-preflight-bun" });
    expect(result.process.reason).toBe("launch-failed");
    expect(result.process.stopped).toBe(true);
    expect(result.versions).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  test("hanging preflight stops before a gated execution can launch", async () => {
    const result = await runSuitePreflight(
      options,
      fixture(
        'const {spawn}=require("node:child_process");spawn(process.execPath,["--eval","setInterval(() => {}, 1000)"],{stdio:"ignore"});setInterval(() => {}, 1000);',
        300,
      ),
    );
    let launched = false;
    if (!result.error && result.process.ok) launched = true;
    expect(launched).toBe(false);
    expect(result.process.reason).toBe("timeout");
    expect(result.process.stopped).toBe(true);
    expect(result.process.observations.some((sample) => sample.members.length > 1)).toBe(true);
    expect(result.versions).toBeUndefined();
  });

  test("cancellation stops a hanging preflight", async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 150);
    try {
      const result = await runSuitePreflight(
        { ...options, signal: controller.signal },
        fixture("setInterval(() => {}, 1000)"),
      );
      expect(result.process.reason).toBe("cancelled");
      expect(result.process.stopped).toBe(true);
      expect(result.versions).toBeUndefined();
    } finally {
      clearTimeout(timer);
    }
  });

  test("a successful report cannot override nonzero exit", async () => {
    const result = await runSuitePreflight(
      options,
      fixture(`process.stdout.write(${JSON.stringify(success)});process.exitCode=3;`),
    );
    expect(result.process.reason).toBe("exit-failed");
    expect(result.versions).toBeUndefined();
    expect(result.error).toContain("exit-failed");
  });

  test("malformed stdout and raw stderr never become summary diagnostics", async () => {
    const result = await runSuitePreflight(
      options,
      fixture(
        'process.stdout.write("malformed /personal/path");process.stderr.write("private-token");',
      ),
    );
    expect(result.error).toBe("Prerequisite probe returned an invalid report.");
    expect(result.process.stdout).toBe("");
    expect(result.process.stderr).toBe("");
    expect(JSON.stringify(result)).not.toContain("private-token");
    expect(JSON.stringify(result)).not.toContain("/personal/path");
  });

  test("missing Pandoc fails its leaf's preflight explicitly", async () => {
    const result = await runSuitePreflight({ ...options, suite: "pandoc", env: { PATH: "" } });
    expect(result.error).toBe("Required prerequisite is unavailable: Pandoc.");
    expect(result.process.stopped).toBe(true);
  });

  test("app rejects an absent extension source using an isolated home", async () => {
    await withTempFixtureDir("prerequisite-cache-", async (root) => {
      const home = join(root, "home");
      await mkdir(home);
      const result = await runSuitePreflight({
        ...options,
        suite: "app",
        env: { ...options.env, HOME: home },
        sourceHome: join(root, "missing-source"),
      });
      expect(result.error).toBe(
        "Required prerequisite is unavailable: Current DuckDB excel and sqlite_scanner extension cache.",
      );
      expect(result.process.stopped).toBe(true);
      expect(JSON.stringify(result)).not.toContain(root);
    });
  });

  test("app refuses a symlinked source cache without copying its contents", async () => {
    await withTempFixtureDir("prerequisite-cache-link-", async (root) => {
      const home = join(root, "home");
      const source = join(root, "source");
      const unrelated = join(root, "unrelated");
      await Promise.all([mkdir(home), mkdir(source), mkdir(unrelated)]);
      await symlink(unrelated, join(source, ".duckdb"));
      const result = await runSuitePreflight({
        ...options,
        suite: "app",
        env: { ...options.env, HOME: home },
        sourceHome: source,
      });
      expect(result.error).toContain("Current DuckDB excel and sqlite_scanner extension cache");
      expect(result.process.stopped).toBe(true);
      await expect(access(join(home, ".duckdb"))).rejects.toThrow();
    });
  });
});
