import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { interactiveHarnessRunnerPath } from "../cli-foundations/interactive-harness/module-urls";
import type {
  InteractiveHarnessResult,
  InteractiveHarnessScenario,
} from "../cli-foundations/interactive-harness/types";
import { lifecycleDiagnostic } from "../codex-info/live-fixture";
import { REPO_ROOT } from "../helpers/cli-test-utils";
import { responseFromDecision } from "../markdown-pdf/adapters/template-codex-fixtures";
import { captureSpeedRequest } from "./fixtures/speed-provider";

type Fixture = Parameters<Parameters<typeof captureSpeedRequest>[1]>[0];

async function runHelper({ start, env, codex }: Fixture, args: string[]) {
  const child = start({
    executable: process.execPath,
    args,
    env: { ...env, CDX_CHORES_CODEX_PATH: codex },
    timeoutMs: 15_000,
  });
  child.child.stdin.end();
  const result = await child.completion;
  if (!result.ok)
    throw new Error(`${lifecycleDiagnostic(result)}\n${result.stdout}\n${result.stderr}`);
  expect(result.stderr).not.toMatch(/Codex session archive (?:skipped|failed)/);
  return result.stdout;
}

async function expectTwoArchivedThreads(home: string) {
  const archived = (await readdir(join(home, "archived_sessions"))).filter((name) =>
    name.endsWith(".jsonl"),
  );
  expect(archived).toHaveLength(2);
  const active = await readdir(join(home, "sessions"), { recursive: true });
  expect(active.filter((name) => name.endsWith(".jsonl"))).toEqual([]);
}

test("PDF template CLI retains speed and archives both owned threads across a repair", async () => {
  const invalid = responseFromDecision({
    coverEnabled: false,
    managedAssets: [{ bundle_path: "unplanned-cover.png", source_label: "cover.png" }],
    templateFamily: "document-layered",
  });
  const valid = responseFromDecision({
    coverEnabled: false,
    templateFamily: "document-layered",
  });
  const requests = await captureSpeedRequest(
    "default",
    async (fixture) => {
      const stdout = await runHelper(fixture, [
        join(REPO_ROOT, "src/bin.ts"),
        "md",
        "pdf-template",
        "codex",
        "--intent",
        "Use a restrained report layout.",
        "--output",
        "draft-template",
        "--dry-run",
        "--codex-speed",
        "fast",
        "--session-retention",
        "archive",
      ]);
      expect(stdout).toContain("Decision mode: adapted");
      await expectTwoArchivedThreads(fixture.env.CODEX_HOME!);
    },
    [invalid, valid],
  );
  expect(requests.map((request) => request.service_tier)).toEqual(["priority", "priority"]);
  expect(JSON.stringify(requests[1]?.input)).toContain("Correction request:");
}, 25_000);

test("Interactive SQL regeneration passes startup speed and retention through both real SDK requests", async () => {
  const scenario: InteractiveHarnessScenario = {
    mode: "run",
    codexExecution: { speed: "fast", sessionRetention: "archive" },
    selectQueue: ["data", "data:query", "Codex Assistant", "regenerate", "table"],
    requiredPathQueue: ["fixtures/query.csv"],
    confirmQueue: [true, false, false, false, true],
    inputQueue: ["count the rows", "10"],
    dataQueryDetectedFormat: "csv",
  };
  const answer = JSON.stringify({
    sql: "select count(*) as total from file",
    reasoning_summary: "Counts the rows.",
  });
  const requests = await captureSpeedRequest(
    "default",
    async (fixture) => {
      const stdout = await runHelper(fixture, [
        interactiveHarnessRunnerPath,
        JSON.stringify(scenario),
      ]);
      const result = JSON.parse(stdout) as InteractiveHarnessResult;
      expect(result.error).toBeUndefined();
      expect(result.actionCalls).toContainEqual(
        expect.objectContaining({
          name: "data:query",
          options: expect.objectContaining({ sql: "select count(*) as total from file" }),
        }),
      );
      await expectTwoArchivedThreads(fixture.env.CODEX_HOME!);
    },
    answer,
  );
  expect(requests.map((request) => request.service_tier)).toEqual(["priority", "priority"]);
}, 25_000);
