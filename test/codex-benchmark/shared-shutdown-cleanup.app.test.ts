import { expect, test } from "bun:test";
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";
import { isLiveProcess, observeProcessGroup } from "../../scripts/testing/execution/process-table";
import { removeFixtureDir } from "../../scripts/testing/fixtures/fixture-exports";
import { runManagedTests } from "../../scripts/testing/orchestration/runner";
import {
  allocateRun,
  readFixtureContext,
  removeRun,
  suitePath,
  TEST_CONTEXT_ENV,
  type RunContext,
} from "../../scripts/testing/ownership/run-context";
import { classifyTestFiles } from "../../scripts/testing/suites/selection";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { completed, writeReport } from "../test-runner/runner-support";
import {
  readSpawnedLeader,
  startShutdownLiveCheck,
  withShutdownFixture,
} from "./fixtures/shutdown";

const cases = ["assertion failure", "partial spawn receipt", "observation failure"] as const;
type Case = (typeof cases)[number];
interface Control {
  home?: string;
  groupId?: number;
  callerStopped?: boolean;
}

async function runControl(mode: Case, control: Control) {
  const observe =
    mode === "observation failure"
      ? async () => {
          throw new Error("Injected group observation failure.");
        }
      : observeProcessGroup;
  return withShutdownFixture(
    { resistantLeader: true, resistantWorker: true },
    async (fixture) => {
      control.home = fixture.home;
      const owned = startShutdownLiveCheck(fixture, "allowed");
      const result = await owned.completion;
      control.callerStopped = result.stopped;
      control.groupId = await readSpawnedLeader(fixture.home);
      expect(result.ok, result.stderr).toBe(true);
      if (control.groupId === undefined) throw new Error("Missing control group identity.");
      // Inject uncertainty only after the actual leader and worker have stopped.
      expect((await observeProcessGroup(control.groupId, 500)).some(isLiveProcess)).toBe(false);
      await access(join(fixture.home, "worker.pid"));
      if (mode === "partial spawn receipt") {
        await writeFile(join(fixture.home, "app-server-spawn"), String(control.groupId));
      }
      if (mode === "assertion failure") {
        expect(false, "Injected ordinary fixture assertion").toBe(true);
      }
    },
    observe,
  );
}

async function checkFailure(mode: Case, control: Control) {
  const error = await runControl(mode, control).then(
    () => undefined,
    (error: unknown) => error,
  );
  const { home } = control;
  if (!home) throw error ?? new Error("Control failed before fixture allocation.");
  if (mode === "assertion failure") {
    expect(String(error)).toContain("Injected ordinary fixture assertion");
    await expect(access(dirname(home))).rejects.toMatchObject({ code: "ENOENT" });
  } else {
    expect(error).toBeInstanceOf(AggregateError);
    const messages = (error as AggregateError).errors.map(String).join("\n");
    expect(messages).toContain("Fixture cleanup unverified; scratch retained");
    expect(messages).toContain(
      mode === "partial spawn receipt"
        ? "Incomplete fixture app-server spawn receipt"
        : "Injected group observation failure",
    );
    await access(join(home, "release-shutdown"));
    await access(join(home, "leader.pid"));
    await access(join(home, "worker.pid"));
    expect(await readFile(join(home, "app-server-spawn"), "utf8")).toBe(
      String(control.groupId) + (mode === "partial spawn receipt" ? "" : "\n"),
    );
  }
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function cleanControl(control: Control) {
  if (!control.home) return;
  const directory = dirname(control.home);
  if (!(await exists(directory))) return;
  // Retire control artifacts only with independent proof of both process boundaries.
  if (
    !control.callerStopped ||
    control.groupId === undefined ||
    (await observeProcessGroup(control.groupId, 500)).some(isLiveProcess)
  ) {
    throw new Error("Control process shutdown is unverified; leaving its fixture in place.");
  }
  await removeFixtureDir(directory);
}

test.skipIf(process.platform === "win32").each(cases)(
  "direct shutdown fixture cleanup after %s",
  async (mode) => {
    const control: Control = {};
    try {
      await checkFailure(mode, control);
    } finally {
      await cleanControl(control);
    }
  },
  10_000,
);

test.skipIf(process.platform === "win32").each(cases)(
  "managed runner finalizes shutdown fixture cleanup after %s",
  async (mode) => {
    const control: Control = {};
    const preflight: string[] = [];
    let context: RunContext | undefined;
    let fixtureFailure: unknown;
    const stopped = mode === "assertion failure";
    const output: string[] = [];
    const capture = () =>
      new Writable({
        write(chunk, _encoding, callback) {
          output.push(chunk.toString());
          callback();
        },
      });
    try {
      const result = await runManagedTests(REPO_ROOT, ["all"], {
        streams: { stdout: capture(), stderr: capture() },
        dependencies: {
          discover: async () =>
            classifyTestFiles([
              "test/codex-benchmark/report.unit.test.ts",
              "test/codex-benchmark/shared-shutdown-cleanup.app.test.ts",
              "test/codex-benchmark/sdk-retention.codex.test.ts",
              "test/markdown-pdf/actions/rendering/cover-text.pandoc.test.ts",
            ]),
          async allocate(...args) {
            return (context = await allocateRun(...args));
          },
          async preflight({ suite }) {
            preflight.push(suite);
            return { process: completed() };
          },
          async execute(options) {
            const suite = readFixtureContext(options.env, REPO_ROOT)!.suite;
            if (suite !== "app") {
              await writeReport(options);
              return completed();
            }
            // Use the actual fixture with the selected leaf's ownership context.
            const previous = process.env[TEST_CONTEXT_ENV];
            process.env[TEST_CONTEXT_ENV] = options.env[TEST_CONTEXT_ENV];
            try {
              await checkFailure(mode, control);
            } catch (error) {
              fixtureFailure = error;
            } finally {
              if (previous === undefined) delete process.env[TEST_CONTEXT_ENV];
              else process.env[TEST_CONTEXT_ENV] = previous;
            }
            await writeReport(options, '<testcase name="expected failure"><failure/></testcase>');
            return completed({ ok: false, exitCode: 1, reason: "exit-failed" });
          },
        },
      });
      if (fixtureFailure !== undefined) throw fixtureFailure;
      const root = context!.root;
      const states = result.summary.leaves.map(({ state }) => state);
      expect(result.exitCode).toBe(1);
      expect(preflight).toEqual(stopped ? ["unit", "app", "codex", "pandoc"] : ["unit", "app"]);
      expect(states).toEqual(
        stopped
          ? ["passed", "failed", "passed", "passed"]
          : ["passed", "failed", "not-run", "not-run"],
      );
      if (stopped) {
        await expect(access(root)).rejects.toMatchObject({ code: "ENOENT" });
      } else {
        expect(result.summary.remainingOwnedPath).toBe(root);
        expect(result.summary.leaves[1]!.errors).toContain(
          "Nested fixture process completion is pending.",
        );
        const summary = JSON.parse(await readFile(join(root, "results/summary.json"), "utf8"));
        expect(summary.errors).toContain(
          "Cleanup withheld: Owned work or cleanup ownership remains unverified; scratch was retained.",
        );
        expect(output.join("")).toContain("Cleanup withheld");
        await access(join(control.home!, "release-shutdown"));
        const directory = join(suitePath(context!, "app", "scratch"), "processes");
        const receipts = await readdir(directory);
        const pending = receipts.filter((name) => name.endsWith(".pending.json"));
        expect(pending).toHaveLength(2);
        const unresolved = pending.filter(
          (name) => !receipts.includes(name.replace(".pending.", ".complete.")),
        );
        expect(unresolved).toHaveLength(1);
        const started = unresolved[0]!.replace(".pending.", ".started.");
        if (mode === "observation failure") {
          expect(JSON.parse(await readFile(join(directory, started), "utf8"))).toMatchObject({
            state: "started",
            pid: control.groupId,
          });
        } else {
          expect(receipts).not.toContain(started);
        }
      }
    } finally {
      await cleanControl(control);
      if (context && (await exists(context.root))) await removeRun(context);
    }
  },
  12_000,
);
