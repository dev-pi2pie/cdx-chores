import { expect, test } from "bun:test";
import { access, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";
import { ProcessLaunchRejectedError } from "../../scripts/testing/execution/process";
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

const preSpawnErrors = {
  "invalid deadline": "Invalid process deadline.",
  "already-aborted signal": "Process launch was cancelled before allocation.",
} as const;
const cases = [
  "assertion failure",
  "launch rejected",
  "invalid deadline",
  "already-aborted signal",
  "missing spawn receipt",
  "interrupted spawn receipt",
  "partial spawn receipt",
  "observation failure",
] as const;
type Case = (typeof cases)[number];
interface Control {
  home?: string;
  groupId?: number;
  callerStopped?: boolean;
  neverStarted?: boolean;
}

function isPreSpawnCase(mode: Case): mode is keyof typeof preSpawnErrors {
  return mode in preSpawnErrors;
}

function canVerify(mode: Case) {
  return mode === "assertion failure" || mode === "launch rejected" || isPreSpawnCase(mode);
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
      if (isPreSpawnCase(mode)) {
        const preSpawn =
          mode === "invalid deadline" ? { timeoutMs: 0 } : { signal: AbortSignal.abort() };
        const owned = startShutdownLiveCheck(
          { ...fixture, start: (options) => fixture.start({ ...options, ...preSpawn }) },
          "allowed",
        );
        await owned.completion;
        throw new Error("The caller launch should have been rejected before spawning.");
      }
      const launch =
        mode === "launch rejected"
          ? {
              ...fixture,
              options: {
                ...fixture.options,
                env: {
                  ...fixture.options.env,
                  CDX_CHORES_CODEX_PATH: join(fixture.home, "missing-app-server"),
                },
              },
            }
          : fixture;
      const owned = startShutdownLiveCheck(launch, "allowed");
      const result = await owned.completion;
      control.callerStopped = result.stopped;
      const receipt = join(fixture.home, "app-server-spawn");
      control.groupId = await readSpawnedLeader(fixture.home);
      if (mode === "launch rejected") {
        expect(result.exitCode, result.stderr).toBe(1);
        expect(result.stderr).toContain("ENOENT");
        expect(await readFile(receipt, "utf8")).toBe("not-started\n");
        await expect(access(join(fixture.home, "leader.pid"))).rejects.toMatchObject({
          code: "ENOENT",
        });
        control.neverStarted = true;
        throw new Error("Expected app-server launch rejection.");
      }
      expect(result.ok, result.stderr).toBe(true);
      if (control.groupId === undefined) throw new Error("Missing control group identity.");
      // Inject uncertainty only after the actual leader and worker have stopped.
      expect((await observeProcessGroup(control.groupId, 500)).some(isLiveProcess)).toBe(false);
      await access(join(fixture.home, "worker.pid"));
      if (mode === "missing spawn receipt") await unlink(receipt);
      if (mode === "interrupted spawn receipt") await writeFile(receipt, "starting");
      if (mode === "partial spawn receipt") await writeFile(receipt, String(control.groupId));
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
  if (isPreSpawnCase(mode)) {
    expect(error).toBeInstanceOf(ProcessLaunchRejectedError);
    expect(error).toMatchObject({
      message: preSpawnErrors[mode],
      cause: { message: preSpawnErrors[mode] },
    });
    control.callerStopped = true;
    control.neverStarted = true;
    await expect(access(dirname(home))).rejects.toMatchObject({ code: "ENOENT" });
  } else if (canVerify(mode)) {
    expect(String(error)).toContain(
      mode === "assertion failure"
        ? "Injected ordinary fixture assertion"
        : "Expected app-server launch rejection",
    );
    await expect(access(dirname(home))).rejects.toMatchObject({ code: "ENOENT" });
  } else {
    expect(error).toBeInstanceOf(AggregateError);
    const messages = (error as AggregateError).errors.map(String).join("\n");
    expect(messages).toContain("Fixture cleanup unverified; scratch retained");
    const receipt = join(home, "app-server-spawn");
    if (mode === "missing spawn receipt") {
      expect(messages).toContain("ENOENT");
      await expect(access(receipt)).rejects.toMatchObject({ code: "ENOENT" });
    } else if (mode === "observation failure") {
      expect(messages).toContain("Injected group observation failure");
      expect(await readFile(receipt, "utf8")).toBe(String(control.groupId) + "\n");
    } else {
      expect(messages).toContain("Incomplete fixture app-server spawn receipt");
      expect(await readFile(receipt, "utf8")).toBe(
        mode === "interrupted spawn receipt" ? "starting" : String(control.groupId),
      );
    }
    await access(join(home, "release-shutdown"));
    await access(join(home, "leader.pid"));
    await access(join(home, "worker.pid"));
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
    (!control.neverStarted &&
      (control.groupId === undefined ||
        (await observeProcessGroup(control.groupId, 500)).some(isLiveProcess)))
  ) {
    throw new Error("Control process shutdown is unverified; leaving its fixture in place.");
  }
  await removeFixtureDir(directory);
}

async function withFixtureContext(value: string | undefined, run: () => Promise<void>) {
  const previous = process.env[TEST_CONTEXT_ENV];
  if (value === undefined) delete process.env[TEST_CONTEXT_ENV];
  else process.env[TEST_CONTEXT_ENV] = value;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env[TEST_CONTEXT_ENV];
    else process.env[TEST_CONTEXT_ENV] = previous;
  }
}

async function checkRejectedHandoff(context: RunContext, count: number) {
  const directory = join(suitePath(context, "app", "scratch"), "processes");
  const names = await readdir(directory);
  const completions = await Promise.all(
    names
      .filter((name) => name.endsWith(".complete.json"))
      .map(async (name) => JSON.parse(await readFile(join(directory, name), "utf8"))),
  );
  expect(completions).toHaveLength(2);
  const rejected = completions.filter(({ reason }) => reason === "launch-rejected");
  expect(rejected).toHaveLength(count);
  for (const entry of rejected) {
    expect(entry).toMatchObject({ state: "complete", stopped: true });
    expect(entry.pid).toBeUndefined();
    expect(entry.groupId).toBeUndefined();
    expect(names).toContain(entry.id + ".pending.json");
    expect(names).not.toContain(entry.id + ".started.json");
  }
}

test.skipIf(process.platform === "win32").each(cases)(
  "direct shutdown fixture cleanup after %s",
  (mode) =>
    withFixtureContext(undefined, async () => {
      const control: Control = {};
      try {
        await checkFailure(mode, control);
      } finally {
        await cleanControl(control);
      }
    }),
  10_000,
);

test.skipIf(process.platform === "win32").each(cases)(
  "managed runner finalizes shutdown fixture cleanup after %s",
  async (mode) => {
    const control: Control = {};
    const preflight: string[] = [];
    let context: RunContext | undefined;
    let fixtureFailure: unknown;
    const stopped = canVerify(mode);
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
            try {
              await withFixtureContext(options.env[TEST_CONTEXT_ENV], () =>
                checkFailure(mode, control),
              );
              if (mode === "launch rejected" || isPreSpawnCase(mode)) {
                await checkRejectedHandoff(context!, isPreSpawnCase(mode) ? 2 : 1);
              }
            } catch (error) {
              fixtureFailure = error;
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
