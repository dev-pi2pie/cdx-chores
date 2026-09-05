import { describe, expect, test } from "bun:test";
import { lstat, mkdir, readdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { type OwnedProcess } from "../../scripts/testing/process.ts";
import {
  inspectFixtureExports,
  registerFixtureOutput,
} from "../../scripts/testing/fixture-exports.ts";
import {
  inspectFixtureProcesses,
  startFixtureProcess,
} from "../../scripts/testing/fixture-process.ts";
import {
  allocateRun,
  fixtureEnvironment,
  removeRun,
  suitePath,
  TEST_CONTEXT_ENV,
  type RunContext,
} from "../../scripts/testing/run-context.ts";
import { REPO_ROOT, withTempFixtureDir } from "../helpers/cli-test-utils";

async function managed(keep: boolean, run: (context: RunContext) => Promise<void>) {
  const context = await allocateRun(REPO_ROOT, ["app"], keep);
  const previous = process.env[TEST_CONTEXT_ENV];
  process.env[TEST_CONTEXT_ENV] = fixtureEnvironment(context, "app");
  try {
    await run(context);
  } finally {
    if (previous === undefined) delete process.env[TEST_CONTEXT_ENV];
    else process.env[TEST_CONTEXT_ENV] = previous;
    await removeRun(context);
  }
}
async function designated(root: string) {
  const source = join(root, "generated.html");
  registerFixtureOutput(root, {
    source,
    name: "generated.html",
    kind: "generated",
    required: true,
  });
  await writeFile(source, "<h1>Synthetic generated output</h1>");
  await mkdir(join(root, "home"));
  await writeFile(join(root, "home", "credentials.json"), "synthetic-private-sentinel");
}

describe("managed fixture ownership and exports", () => {
  test.each([false, true])(
    "exports and validates before finalization with keep=%s",
    async (keep) => {
      await managed(keep, async (context) => {
        let fixture = "";
        await withTempFixtureDir("retention", async (root) => {
          fixture = root;
          await designated(root);
        });
        expect(await lstat(fixture).catch(() => undefined)).toBeUndefined();
        const results = suitePath(context, "app", "results");
        const names = await readdir(results);
        expect(names).toHaveLength(1);
        const directory = join(results, names[0]!);
        expect((await readdir(directory)).sort()).toEqual(["generated.html", "manifest.json"]);
        expect(await readFile(join(directory, "generated.html"), "utf8")).toContain(
          "Synthetic generated",
        );
        const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
        expect(manifest).toMatchObject({
          successful: true,
          exportFailures: 0,
          exports: [{ status: "checks-passed" }],
        });
        expect(await inspectFixtureExports(context, "app")).toEqual({
          ok: true,
          cleanupVerified: true,
          issues: [],
        });
      });
    },
  );
  test("marks existing output diagnostic after failed assertions", async () => {
    await managed(true, async (context) => {
      await expect(
        withTempFixtureDir("failed-check", async (root) => {
          await designated(root);
          throw new Error("injected assertion");
        }),
      ).rejects.toThrow("injected assertion");
      const results = suitePath(context, "app", "results");
      const [name] = await readdir(results);
      const manifest = JSON.parse(await readFile(join(results, name!, "manifest.json"), "utf8"));
      expect(manifest).toMatchObject({
        successful: false,
        exports: [{ status: "diagnostic-after-failure" }],
      });
      expect(await inspectFixtureExports(context, "app")).toEqual({
        ok: true,
        cleanupVerified: true,
        issues: [],
      });
      expect(await readdir(join(suitePath(context, "app", "scratch"), "fixtures"))).toEqual([]);
    });
  });
  test.each([false, true])("preserves callback and export failures with keep=%s", async (keep) => {
    await managed(keep, async (context) => {
      let failure: unknown;
      try {
        await withTempFixtureDir("missing-output", async (root) => {
          registerFixtureOutput(root, {
            source: join(root, "missing.html"),
            name: "missing.html",
            kind: "generated",
            required: true,
          });
          throw new Error("setup failed");
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(AggregateError);
      expect((failure as AggregateError).errors).toHaveLength(2);
      expect(await inspectFixtureExports(context, "app")).toMatchObject({
        ok: false,
        cleanupVerified: true,
      });
      expect(await readdir(join(suitePath(context, "app", "scratch"), "fixtures"))).toEqual([]);
    });
  });
  test("preserves callback, export, and cleanup failures for a replaced owner", async () => {
    await managed(true, async () => {
      let failure: unknown;
      try {
        await withTempFixtureDir("replaced-owner", async (root) => {
          await designated(root);
          await rename(root, root + "-original");
          await mkdir(root);
          throw new Error("assertion failed");
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(AggregateError);
      expect((failure as AggregateError).errors).toHaveLength(3);
    });
  });
  test("refuses symlink output instead of copying private fixture state", async () => {
    await managed(true, async (context) => {
      await expect(
        withTempFixtureDir("symlink-output", async (root) => {
          await designated(root);
          await rm(join(root, "generated.html"));
          await symlink(join(root, "home", "credentials.json"), join(root, "generated.html"));
        }),
      ).rejects.toThrow("Fixture export failed");
      const results = suitePath(context, "app", "results");
      const [name] = await readdir(results);
      expect(await readdir(join(results, name!))).toEqual(["manifest.json"]);
    });
  });
  test("concurrent fixture exports remain separate", async () => {
    await managed(true, async (context) => {
      await Promise.all([
        withTempFixtureDir("concurrent", designated),
        withTempFixtureDir("concurrent", designated),
      ]);
      expect(await readdir(suitePath(context, "app", "results"))).toHaveLength(2);
      expect((await inspectFixtureExports(context, "app")).ok).toBe(true);
    });
  });
  test.each(["missing", "truncated"] as const)(
    "removes an incomplete publication with %s completion receipt",
    async (mode) => {
      await managed(true, async (context) => {
        await withTempFixtureDir("interrupted-export", designated);
        const directory = join(suitePath(context, "app", "scratch"), "exports");
        const completion = (await readdir(directory)).find((name) =>
          name.endsWith(".complete.json"),
        )!;
        if (mode === "missing") await rm(join(directory, completion));
        else await writeFile(join(directory, completion), "{");
        expect(await inspectFixtureExports(context, "app")).toMatchObject({
          ok: false,
          cleanupVerified: true,
        });
        expect(await readdir(suitePath(context, "app", "results"))).toEqual([]);
      });
    },
  );
  test("unverified export namespaces prevent finalization cleanup", async () => {
    await managed(true, async (context) => {
      const directory = join(suitePath(context, "app", "scratch"), "exports");
      await rename(directory, directory + "-original");
      await mkdir(directory);
      expect(await inspectFixtureExports(context, "app")).toMatchObject({
        ok: false,
        cleanupVerified: false,
      });
    });
  });
});

describe("nested fixture process handoff", () => {
  test("pending and stopped:false receipts preserve unresolved ownership", async () => {
    await managed(false, async (context) => {
      const directory = join(suitePath(context, "app", "scratch"), "processes");
      const id = randomUUID();
      await writeFile(
        join(directory, id + ".pending.json"),
        JSON.stringify({ version: 1, id, state: "pending" }),
      );
      expect(inspectFixtureProcesses(context, "app").stopped).toBe(false);
      await writeFile(
        join(directory, id + ".started.json"),
        JSON.stringify({ version: 1, id, state: "started", pid: 123 }),
      );
      await writeFile(
        join(directory, id + ".complete.json"),
        JSON.stringify({
          version: 1,
          id,
          state: "complete",
          pid: 123,
          groupId: 123,
          stopped: false,
          reason: "unverified",
        }),
      );
      expect(inspectFixtureProcesses(context, "app").stopped).toBe(false);
    });
  });
  test.each(["exit-failed", "timeout", "cancelled"] as const)(
    "persists verified expected %s without unresolved ownership",
    async (reason) => {
      await managed(false, async (context) => {
        const listeners = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
        const cancellation = new AbortController();
        const owned = startFixtureProcess({
          executable: process.execPath,
          args: [
            "-e",
            reason !== "exit-failed"
              ? "process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 100)"
              : "process.exit(3)",
          ],
          cwd: REPO_ROOT,
          env: { PATH: process.env.PATH },
          signal: cancellation.signal,
          timeoutMs: reason === "timeout" ? 200 : 2000,
          graceMs: 250,
          cleanupMs: 1500,
        });
        owned.child.stdin.end();
        if (reason === "cancelled") cancellation.abort();
        expect(inspectFixtureProcesses(context, "app").stopped).toBe(false);
        const result = await owned.completion;
        expect(result.stopped).toBe(true);
        expect(result.reason).toBe(reason);
        expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(
          listeners,
        );
        expect(inspectFixtureProcesses(context, "app")).toEqual({ stopped: true, issues: [] });
        const directory = join(suitePath(context, "app", "scratch"), "processes");
        const receipts = await Promise.all(
          (await readdir(directory)).map((name) => readFile(join(directory, name), "utf8")),
        );
        expect(receipts.join("\n")).not.toContain("process.exit");
        expect(receipts.join("\n")).not.toContain("PATH");
      });
    },
    10_000,
  );
});

async function waitForReady(owned: OwnedProcess): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let output = "";
    const onData = (data: Buffer) => {
      output += data.toString("utf8");
      if (output.includes("ready\n")) {
        owned.child.stdout.off("data", onData);
        resolve();
      }
    };
    owned.child.stdout.on("data", onData);
    void owned.completion.then(() => {
      owned.child.stdout.off("data", onData);
      reject(new Error("Owned signal fixture exited before readiness."));
    });
  });
}

describe("managed fixture signal cancellation", () => {
  test("removes lazy handlers when launch is rejected", async () => {
    await managed(false, async (context) => {
      const before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
      expect(() =>
        startFixtureProcess({
          executable: process.execPath,
          args: [],
          cwd: REPO_ROOT,
          env: {},
          timeoutMs: 0,
          graceMs: 250,
          cleanupMs: 1500,
        }),
      ).toThrow("Invalid process deadline");
      expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(before);
      expect(inspectFixtureProcesses(context, "app")).toEqual({ stopped: true, issues: [] });
    });
  });
  test.each(["SIGINT", "SIGTERM"] as const)(
    "forwards %s to its detached child and leaves an independent owner alive",
    async (signal) => {
      const context = await allocateRun(REPO_ROOT, ["app"], false);
      const owned: OwnedProcess[] = [];
      const errors: unknown[] = [];
      const childProgram = 'process.stdout.write("ready\\n"); setInterval(() => {}, 100);';
      const limits = {
        executable: process.execPath,
        cwd: REPO_ROOT,
        timeoutMs: 5000,
        graceMs: 250,
        cleanupMs: 1500,
        maxOutputBytes: 4096,
      };
      try {
        const harnessProgram = `
        const { startFixtureProcess } = await import(${JSON.stringify(join(REPO_ROOT, "scripts/testing/fixture-process.ts"))});
        const before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
        const callerSignal = new AbortController();
        const child = startFixtureProcess({ executable: process.execPath, args: ["-e", ${JSON.stringify(childProgram)}], cwd: process.cwd(), env: { PATH: process.env.PATH }, signal: callerSignal.signal, timeoutMs: 3000, graceMs: 250, cleanupMs: 1500 });
        child.child.stdin.end();
        child.child.stdout.once("data", () => process.stdout.write("ready\\n"));
        const result = await child.completion;
        process.stdout.write(JSON.stringify({ stopped: result.stopped, reason: result.reason, removedListeners: JSON.stringify(before) === JSON.stringify([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]) }) + "\\n");
        process.exitCode = result.stopped ? 0 : 1;
      `;
        const harness = startFixtureProcess({
          ...limits,
          args: ["-e", harnessProgram],
          env: { PATH: process.env.PATH, [TEST_CONTEXT_ENV]: fixtureEnvironment(context, "app") },
        });
        owned.push(harness);
        harness.child.stdin.end();
        const sibling = startFixtureProcess({
          ...limits,
          args: ["-e", childProgram],
          env: { PATH: process.env.PATH },
        });
        owned.push(sibling);
        sibling.child.stdin.end();
        await Promise.all([waitForReady(harness), waitForReady(sibling)]);
        expect(harness.child.kill(signal)).toBe(true);
        const result = await harness.completion;
        expect(result.ok, result.stderr).toBe(true);
        const report = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
        expect(report).toEqual({ stopped: true, reason: "cancelled", removedListeners: true });
        expect(inspectFixtureProcesses(context, "app")).toEqual({ stopped: true, issues: [] });
        expect(sibling.child.exitCode).toBeNull();
        expect(sibling.child.signalCode).toBeNull();
        expect(() => process.kill(sibling.child.pid!, 0)).not.toThrow();
      } catch (error) {
        errors.push(error);
      } finally {
        for (const process of owned) process.shutdown();
        const results = await Promise.all(owned.map((process) => process.completion));
        if (
          results.every((result) => result.stopped) &&
          inspectFixtureProcesses(context, "app").stopped
        )
          await removeRun(context);
        else
          errors.push(
            new Error("Signal regression ownership is unresolved; retained " + context.root),
          );
      }
      if (errors.length)
        throw new AggregateError(errors, "Managed fixture signal regression failed.");
    },
    12_000,
  );
});
