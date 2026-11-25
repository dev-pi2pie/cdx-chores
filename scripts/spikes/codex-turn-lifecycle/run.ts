import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const source = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const execute = promisify(execFile);

const scenarios = [
  { name: "Normal", config: {} },
  { name: "No reply + terminal", config: { withholdStartReplyThread: 1 } },
  {
    name: "No reply + active",
    config: { withholdStartReplyThread: 1, waitForInterruptThread: 1, interrupt: "unconfirmed" },
  },
  {
    name: "Reply + ack only",
    config: { waitForInterruptThread: 1, interrupt: "unconfirmed" },
  },
];

interface TraceEvent {
  method: string;
  params?: { threadId?: string; turnId?: string; serviceTierForTurn?: string };
}

interface Trial {
  requestedSpeed: string;
  threadId?: string;
  turnId?: string;
  sessionRetention?: { status: string };
}

interface CallerReport {
  run?: { codexVersion?: unknown };
  codexVersion?: unknown;
  trials?: Trial[];
  results?: Trial[];
}

function summarize(
  trace: TraceEvent[],
  trials: Trial[],
  expected: (typeof scenarios)[number]["config"],
) {
  const turnRequests = trace.filter(({ method }) => method === "turn/start");
  const firstThread = (tier: string) =>
    turnRequests.find(({ params }) => params?.serviceTierForTurn === tier)?.params?.threadId;
  const standardThread = firstThread("default");
  const standard = trials.find((trial) => trial.requestedSpeed === "standard");
  const standardTurn = trace.find(
    ({ method, params }) => method === "turn/started" && params?.threadId === standardThread,
  )?.params?.turnId;
  if (
    !standardThread ||
    standardThread !== turnRequests[0]?.params?.threadId ||
    !standardTurn ||
    standard?.threadId !== standardThread
  ) {
    throw new Error("Missing first Standard turn in the report or fixture trace.");
  }

  const terminal = trace.findIndex(
    ({ method, params }) =>
      method === "turn/completed" &&
      params?.threadId === standardThread &&
      params.turnId === standardTurn,
  );
  const startReply = trace.some(
    ({ method, params }) =>
      method === "fixture/turn-start-reply" && params?.threadId === standardThread,
  );
  const expectsReply = expected.withholdStartReplyThread !== 1;
  const expectsTerminal = expected.waitForInterruptThread !== 1;
  const sentTerminal = terminal >= 0;
  if (startReply !== expectsReply || sentTerminal !== expectsTerminal) {
    throw new Error("Fixture did not reproduce the selected Standard scenario.");
  }
  const fastThread = firstThread("priority");
  const fast = trace.findIndex(
    ({ method, params }) => method === "turn/started" && params?.threadId === fastThread,
  );
  const archive = trace.findIndex(
    ({ method, params }) => method === "thread/archive" && params?.threadId === standardThread,
  );
  if (standard.sessionRetention?.status === "archived" && archive < 0) {
    throw new Error("The reported Standard archive was absent from the fixture trace.");
  }
  const confirmed = sentTerminal && standard.turnId === standardTurn && archive > terminal;
  const interrupts = trace
    .filter(({ method }) => method === "turn/interrupt")
    .map(({ params }) => {
      const ack = trace.some(
        (entry) =>
          entry.method === "fixture/turn-interrupt-reply" &&
          entry.params?.threadId === params?.threadId &&
          entry.params?.turnId === params?.turnId,
      );
      return `${params?.turnId}${ack ? " (ack)" : ""}`;
    });
  return {
    Terminal: confirmed ? "confirmed" : sentTerminal ? "emitted only" : "absent",
    Interrupt: interrupts.join(", ") || "none",
    Archive: standard.sessionRetention?.status ?? "unreported",
    "Fast overlap": fast < 0 ? "not started" : !sentTerminal || fast < terminal ? "yes" : "no",
  };
}

async function runMatrix() {
  const scratch = join(repo, "examples/playground/codex-turn-lifecycle");
  await mkdir(scratch, { recursive: true });
  const owner = await mkdtemp(join(scratch, "run-"));
  console.log(`Evidence in ${relative(repo, owner)}`);
  const fixture = join(owner, "app-server.mjs");
  await copyFile(join(repo, "test/codex-benchmark/fixtures/benchmark-app-server.mjs"), fixture);
  await chmod(fixture, 0o700);
  const { version: appVersion }: { version?: unknown } = JSON.parse(
    await readFile(join(repo, "node_modules/@openai/codex-sdk/package.json"), "utf8"),
  );
  if (typeof appVersion !== "string" || !appVersion) {
    throw new Error("The installed Codex SDK package did not report a version.");
  }
  const callers = [
    {
      name: "codex-bench",
      reportedVersion: (report: CallerReport) => report.run?.codexVersion,
      executable: "node",
      args: [
        "--import",
        source("deadline.mjs"),
        join(repo, "dist/esm/bin.mjs"),
        "codex-bench",
        "--case",
        "model-a=standard",
        "--case",
        "model-a=fast",
        "--codex-reasoning-effort",
        "low",
        "--runs",
        "1",
        "--session-retention",
        "archive",
        "--json",
      ],
    },
    {
      name: "live check",
      reportedVersion: (report: CallerReport) => report.codexVersion,
      executable: process.execPath,
      args: ["--preload", source("deadline.mjs"), source("live.ts")],
    },
  ];

  const runs = scenarios.flatMap(({ name, config }, index) =>
    callers.map(async ({ name: caller, executable, args, reportedVersion }, callerIndex) => {
      const home = join(owner, `${index + 1}-${callerIndex + 1}`);
      await mkdir(home);
      await writeFile(
        join(home, "scenario.json"),
        JSON.stringify({
          ...config,
          appServerUserAgent: `cdx_chores/${appVersion}`,
          traceLifecycle: true,
        }),
      );

      const options = {
        cwd: home,
        encoding: "utf8" as const,
        timeout: 30_000,
        killSignal: "SIGKILL" as const,
        env: {
          PATH: process.env.PATH,
          HOME: home,
          CODEX_HOME: home,
          CDX_CHORES_CODEX_PATH: fixture,
          NO_COLOR: "1",
        },
      };
      const { stdout, stderr, code } = await execute(executable, args, options).then(
        (result) => ({ ...result, code: 0 }),
        (error: NodeJS.ErrnoException & { stdout: string; stderr: string }) => error,
      );
      await Promise.all([
        writeFile(join(home, "stdout.json"), stdout),
        writeFile(join(home, "stderr.txt"), stderr),
      ]);
      if (code !== 0 && code !== 1) {
        throw new Error(
          `${caller} / ${name} failed to produce an observation. Exit ${code ?? "by signal"}.`,
        );
      }
      const report: CallerReport = JSON.parse(stdout);
      const version = reportedVersion(report);
      if (version !== appVersion) {
        throw new Error(
          `Expected Codex version ${appVersion} for ${caller} / ${name}, received ${JSON.stringify(version) ?? "no value"}.`,
        );
      }
      const trace: TraceEvent[] = (await readFile(join(home, "events.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const summary = summarize(trace, report.trials ?? report.results ?? [], config);
      return { Caller: caller, Case: name, Version: version, ...summary, Exit: code };
    }),
  );
  const results = await Promise.allSettled(runs);
  console.table(results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])));
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(result.reason);
      process.exitCode = 1;
    }
  }
}

console.log(
  "Start RPC uses 15 s. Turn completion uses 500 ms (shortened from 120 s). Interrupt and readback use 2 s each.",
);
await runMatrix();
