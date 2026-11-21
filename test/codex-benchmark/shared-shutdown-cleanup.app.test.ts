import { expect, spyOn, test } from "bun:test";
import childProcess from "node:child_process";
import { access, readFile, readdir, symlink, unlink, writeFile } from "node:fs/promises";
import { constants, devNull } from "node:os";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import {
  ProcessLaunchRejectedError,
  type OwnedProcessOptions,
  type OwnedProcessResult,
} from "../../scripts/testing/execution/process";
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
import { buildNodeCaller, traceMethod, type BenchmarkProtocolEvent } from "./fixtures/runner";
import {
  readSpawnedLeader,
  startShutdownLiveCheck,
  withDispatchFixture,
  withShutdownFixture,
} from "./fixtures/shutdown";

const fileCwdFailure = {
  options: {},
  error: {
    message: `ENOTDIR: not a directory, posix_spawn '${process.execPath}'`,
    code: "ENOTDIR",
  },
} as const;

function invalidExecutable(
  executable: string,
  code: "ENOTDIR" | "ELOOP" | "ENAMETOOLONG",
  description: string,
) {
  return {
    options: { executable },
    error: { code, message: `${code}: ${description}, posix_spawn '${executable}'` },
  };
}

const preSpawnCases = {
  "invalid deadline": {
    options: { timeoutMs: 0 },
    error: { message: "Invalid process deadline." },
  },
  "already-aborted signal": {
    options: { signal: AbortSignal.abort() },
    error: { message: "Process launch was cancelled before allocation." },
  },
  "empty executable": {
    options: { executable: "" },
    error: {
      message: "The argument 'file' cannot be empty. Received ''",
      code: "ERR_INVALID_ARG_VALUE",
    },
  },
  "NUL in executable": {
    options: { executable: "launcher\0suffix" },
    error: {
      message:
        "The argument 'file' must be a string without null bytes. Received 'launcher\\x00suffix'",
      code: "ERR_INVALID_ARG_VALUE",
    },
  },
  "NUL in argument": {
    options: { args: ["--version", " ", "arg\0suffix"] },
    error: {
      message:
        "The argument 'args[2]' must be a string without null bytes. Received 'arg\\x00suffix'",
      code: "ERR_INVALID_ARG_VALUE",
    },
  },
  "NUL in cwd": {
    options: { cwd: "fixture\0directory" },
    error: {
      message:
        "The property 'options.cwd' must be a string or Uint8Array without null bytes. Received 'fixture\\x00directory'",
      code: "ERR_INVALID_ARG_VALUE",
    },
  },
  "NUL in env key": {
    options: { env: { "FIXTURE\0KEY": "value" } },
    error: {
      message:
        "The property 'options.env['FIXTURE\0KEY']' must be a string without null bytes. Received 'FIXTURE\\x00KEY'",
      code: "ERR_INVALID_ARG_VALUE",
    },
  },
  "NUL in env value": {
    options: { env: { FIXTURE_KEY: "value\0suffix" } },
    error: {
      message:
        "The property 'options.env['FIXTURE_KEY']' must be a string without null bytes. Received 'value\\x00suffix'",
      code: "ERR_INVALID_ARG_VALUE",
    },
  },
  "cwd is an existing file": { ...fileCwdFailure, fileSuffix: "" },
  "cwd is the null device": { ...fileCwdFailure, options: { cwd: devNull } },
  "cwd contains a symlink loop": {
    options: {},
    error: {
      code: "ELOOP",
      message: `ELOOP: too many symbolic links encountered, posix_spawn '${process.execPath}'`,
    },
  },
  "cwd contains an overlong component": {
    options: {},
    error: {
      code: "ENAMETOOLONG",
      message: `ENAMETOOLONG: name too long, posix_spawn '${process.execPath}'`,
    },
  },
  "cwd traverses a file before a trailing slash": { ...fileCwdFailure, fileSuffix: "/" },
  "cwd traverses a file before a child component": { ...fileCwdFailure, fileSuffix: "/child" },
  "executable traverses a regular file": invalidExecutable(
    "unrelated.jsonl/../tool",
    "ENOTDIR",
    "not a directory",
  ),
  "executable contains a symlink loop": invalidExecutable(
    "./loop",
    "ELOOP",
    "too many symbolic links encountered",
  ),
  "executable contains an overlong component": invalidExecutable(
    "./" + "x".repeat(512),
    "ENAMETOOLONG",
    "name too long",
  ),
} as const;
const cases = [
  "assertion failure",
  "launch rejected",
  "invalid deadline",
  "already-aborted signal",
  "empty executable",
  "NUL in executable",
  "NUL in argument",
  "NUL in cwd",
  "NUL in env key",
  "NUL in env value",
  "cwd is an existing file",
  "cwd is the null device",
  "cwd contains a symlink loop",
  "cwd contains an overlong component",
  "cwd traverses a file before a trailing slash",
  "cwd traverses a file before a child component",
  "executable traverses a regular file",
  "executable contains a symlink loop",
  "executable contains an overlong component",
  "missing spawn receipt",
  "interrupted spawn receipt",
  "partial spawn receipt",
  "observation failure",
  "peer fixture setup failure",
  "verified peer closure",
  "peer closure without spawn receipt",
  "stalled peer closure",
] as const;
type Case = (typeof cases)[number];
interface Control {
  home?: string;
  groupId?: number;
  callerStopped?: boolean;
  neverStarted?: boolean;
  peer?: {
    result: OwnedProcessResult;
    stdinClosed: BenchmarkProtocolEvent[];
    leaderLiveAtCallerExit: boolean;
  };
}

function isPreSpawnCase(mode: Case): mode is keyof typeof preSpawnCases {
  return mode in preSpawnCases;
}

function canVerify(mode: Case) {
  return (
    mode === "assertion failure" ||
    mode === "launch rejected" ||
    mode === "peer fixture setup failure" ||
    mode === "verified peer closure" ||
    isPreSpawnCase(mode)
  );
}

function runPeerControl(mode: Case, control: Control) {
  const stalled = mode === "stalled peer closure";
  return withDispatchFixture(
    { closeStdinOnThreadStart: 1, stallPeerShutdown: stalled },
    async ({ home, options, start, trace }) => {
      control.home = home;
      if (mode === "peer fixture setup failure")
        throw new Error("Injected peer fixture setup failure.");
      const fixtureDir = join(import.meta.dir, "fixtures");
      const caller = await buildNodeCaller(join(fixtureDir, "runner-live-check.ts"), options.cwd);
      const result = await start({
        executable: "node",
        args: [
          "--import",
          pathToFileURL(join(fixtureDir, "turn-write-preload.mjs")).href,
          caller,
          "--model",
          "model-a",
          "--effort",
          "low",
        ],
        cwd: options.cwd,
        env: {
          ...options.env,
          FIXTURE_ESCALATION: stalled ? "undelivered" : "allowed",
          FIXTURE_TURN_WRITE: "peer-closed",
          FIXTURE_TURN_THREAD: "1",
        },
        timeoutMs: 6_000,
        graceMs: 600,
        cleanupMs: 1_500,
      }).completion;
      control.callerStopped = result.stopped;
      const leader = await readSpawnedLeader(home);
      control.groupId = leader;
      if (leader === undefined) throw new Error("Missing peer group identity.");
      const members = await observeProcessGroup(leader, 500);
      control.peer = {
        result,
        stdinClosed: traceMethod(await trace(), "stdin-closed"),
        leaderLiveAtCallerExit: members.some(
          (member) => member.pid === leader && isLiveProcess(member),
        ),
      };
      if (mode === "peer closure without spawn receipt")
        await unlink(join(home, "app-server-spawn"));
      if (mode === "verified peer closure")
        throw new Error("Injected assertion after peer closure.");
    },
  );
}

async function runControl(mode: Case, control: Control) {
  if (
    mode === "peer fixture setup failure" ||
    mode === "verified peer closure" ||
    mode === "peer closure without spawn receipt" ||
    mode === "stalled peer closure"
  ) {
    return runPeerControl(mode, control);
  }
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
        const preSpawn = preSpawnCases[mode];
        const overrides: Partial<OwnedProcessOptions> = { ...preSpawn.options };
        if ("executable" in preSpawn.options) overrides.cwd = fixture.home;
        if ("fileSuffix" in preSpawn) {
          overrides.cwd = join(fixture.home, "unrelated.jsonl") + preSpawn.fileSuffix;
        } else if (
          mode === "cwd contains a symlink loop" ||
          mode === "executable contains a symlink loop"
        ) {
          const loop = join(fixture.home, "loop");
          await symlink("loop", loop);
          if (mode === "cwd contains a symlink loop") overrides.cwd = loop;
        } else if (mode === "cwd contains an overlong component") {
          overrides.cwd = join(fixture.home, "x".repeat(512));
        }
        const owned = startShutdownLiveCheck(
          {
            ...fixture,
            start: (options) => {
              using spawn = spyOn(childProcess, "spawn");
              try {
                return fixture.start({ ...options, ...overrides });
              } finally {
                expect(spawn).not.toHaveBeenCalled();
              }
            },
          },
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
  if (mode === "peer fixture setup failure") {
    expect(String(error)).toContain("Injected peer fixture setup failure.");
    await expect(access(dirname(home))).rejects.toMatchObject({ code: "ENOENT" });
    return;
  }
  if (
    mode === "verified peer closure" ||
    mode === "peer closure without spawn receipt" ||
    mode === "stalled peer closure"
  ) {
    const peer = control.peer;
    if (!peer) throw new Error("Missing peer observations.", { cause: error });
    expect(peer.result.stopped).toBe(true);
    expect(peer.result.exitCode, peer.result.stderr).toBe(1);
    expect(peer.result.stderr).toContain("observed immediate EPIPE");
    expect(peer.leaderLiveAtCallerExit).toBe(mode === "stalled peer closure");
    expect(peer.stdinClosed).toEqual([
      { method: "stdin-closed", params: { pid: control.groupId } },
    ]);
    if (mode === "stalled peer closure") expect(peer.result.stderr).toContain("shutdown deadline");
    if (mode === "verified peer closure") {
      expect(String(error)).toContain("Injected assertion after peer closure.");
      await expect(access(dirname(home))).rejects.toMatchObject({ code: "ENOENT" });
      return;
    }
  }
  if (isPreSpawnCase(mode)) {
    const { error: expectedError, options } = preSpawnCases[mode];
    expect(error).toBeInstanceOf(ProcessLaunchRejectedError);
    expect(error).toMatchObject({ ...expectedError, cause: expectedError });
    if ("code" in expectedError) {
      const { cause } = error as Error;
      if (expectedError.code !== "ERR_INVALID_ARG_VALUE") {
        expect(cause).toMatchObject({
          errno: -constants.errno[expectedError.code],
          syscall: "spawn",
          path: "executable" in options ? options.executable : process.execPath,
        });
      } else {
        expect(cause).toBeInstanceOf(TypeError);
      }
    }
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
    if (mode === "missing spawn receipt" || mode === "peer closure without spawn receipt") {
      expect(messages).toContain("ENOENT");
      await expect(access(receipt)).rejects.toMatchObject({ code: "ENOENT" });
    } else if (mode === "observation failure") {
      expect(messages).toContain("Injected group observation failure");
      expect(await readFile(receipt, "utf8")).toBe(String(control.groupId) + "\n");
    } else if (mode === "stalled peer closure") {
      expect(messages).toMatch(
        /Fixture app-server group was still live at the cleanup deadline\.|Process-state observation failed or timed out\./,
      );
      expect(await readFile(receipt, "utf8")).toBe(String(control.groupId) + "\n");
      expect((await observeProcessGroup(control.groupId!, 500)).some(isLiveProcess)).toBe(true);
    } else {
      expect(messages).toContain("Incomplete fixture app-server spawn receipt");
      expect(await readFile(receipt, "utf8")).toBe(
        mode === "interrupted spawn receipt" ? "starting" : String(control.groupId),
      );
    }
    await access(join(home, "release-shutdown"));
    if (mode === "stalled peer closure" || mode === "peer closure without spawn receipt") {
      await access(join(home, "events.jsonl"));
    } else {
      await Promise.all([access(join(home, "leader.pid")), access(join(home, "worker.pid"))]);
    }
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

async function cleanControl(mode: Case, control: Control) {
  if (!control.home) return;
  const directory = dirname(control.home);
  if (mode === "stalled peer closure" && control.groupId !== undefined) {
    try {
      await writeFile(join(control.home, "release-stalled-peer"), "");
    } catch (error) {
      // A fixture that removed scratch too early must still wait for the peer's fallback exit.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const deadline = performance.now() + 8_500;
    while ((await observeProcessGroup(control.groupId, 500)).some(isLiveProcess)) {
      if (performance.now() >= deadline)
        throw new Error("Stalled peer did not stop after release.");
      await delay(20);
    }
  }
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
        await cleanControl(mode, control);
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
              if (mode === "peer fixture setup failure" || mode === "verified peer closure") {
                const directory = join(suitePath(context!, "app", "scratch"), "processes");
                const names = await readdir(directory);
                if (mode === "peer fixture setup failure") {
                  expect(names).toEqual([]);
                } else {
                  const completions = await Promise.all(
                    names
                      .filter((name) => name.endsWith(".complete.json"))
                      .map(async (name) =>
                        JSON.parse(await readFile(join(directory, name), "utf8")),
                      ),
                  );
                  expect(completions).toHaveLength(2);
                  expect(completions).toContainEqual(
                    expect.objectContaining({
                      state: "complete",
                      stopped: true,
                      reason: "completed",
                      pid: control.groupId,
                      groupId: control.groupId,
                    }),
                  );
                }
              }
            } catch (error) {
              fixtureFailure = error;
            }
            await writeReport(options, '<testcase name="expected failure"><failure/></testcase>');
            return completed({ ok: false, exitCode: 1, reason: "exit-failed" });
          },
        },
      });
      const root = context!.root;
      const states = result.summary.leaves.map(({ state }) => state);
      expect(result.exitCode).toBe(1);
      expect(preflight).toEqual(stopped ? ["unit", "app", "codex", "pandoc"] : ["unit", "app"]);
      expect(states).toEqual(
        stopped
          ? ["passed", "failed", "passed", "passed"]
          : ["passed", "failed", "not-run", "not-run"],
      );
      if (fixtureFailure !== undefined) throw fixtureFailure;
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
        if (mode === "observation failure" || mode === "stalled peer closure") {
          expect(JSON.parse(await readFile(join(directory, started), "utf8"))).toMatchObject({
            state: "started",
            pid: control.groupId,
          });
        } else {
          expect(receipts).not.toContain(started);
        }
      }
    } finally {
      await cleanControl(mode, control);
      if (context && (await exists(context.root))) await removeRun(context);
    }
  },
  12_000,
);
