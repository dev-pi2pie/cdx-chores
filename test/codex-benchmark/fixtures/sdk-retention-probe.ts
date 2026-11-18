import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";
import { basename, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { withCodexReadOnlyThread } from "../../../src/adapters/codex/shared";
import { draftDataQueryWithCodex } from "../../../src/cli/data-query/runner";

const [scenario, fixturePrompt, fixtureAnswer] = process.argv.slice(2);
const cwd = process.cwd();
const home = process.env.CODEX_HOME;
assert(home);

if (scenario === "rpc-error" || scenario === "work-error" || scenario === "cancelled") {
  assert(fixturePrompt);
  const abort = new AbortController();
  try {
    const result = await withCodexReadOnlyThread(
      cwd,
      { codexPathOverride: fixturePrompt, codexExecution: { sessionRetention: "archive" } },
      async (thread) => {
        const turn = thread.run("Run the synthetic probe.", { signal: abort.signal });
        if (scenario === "cancelled") {
          // Wait until the SDK itself has observed the thread.started event.
          while (!thread.id) await delay(10);
          abort.abort();
        }
        const result = await turn;
        if (scenario === "work-error") throw new Error("Original helper error.");
        return result;
      },
    );
    console.log(result.finalResponse);
  } catch (error) {
    console.log(error instanceof Error ? error.message : String(error));
  }
  process.exit(0);
}

execFileSync("git", ["init", "--quiet"], { cwd });

const active = () => globSync(join(home, "sessions", "**", "rollout-*.jsonl")).sort();
const archived = () => globSync(join(home, "archived_sessions", "rollout-*.jsonl")).sort();

if (scenario === "one-shot") {
  await withCodexReadOnlyThread(cwd, {}, async (thread) => {
    const turn = await thread.run(fixturePrompt!);
    assert.equal(turn.finalResponse, fixtureAnswer);
  });
  const sentinel = active();
  assert.equal(sentinel.length, 1);
  const draft = await draftDataQueryWithCodex({
    codexExecution: { speed: "fast", sessionRetention: "delete" },
    format: "csv",
    intent: "Read the value",
    introspection: { columns: [], sampleRows: [], truncated: false },
    workingDirectory: cwd,
  });
  assert.deepEqual(draft, {
    draft: { sql: "SELECT value FROM file", reasoningSummary: "Read value." },
  });
  assert.deepEqual(active(), sentinel);
  assert.deepEqual(archived(), []);
} else {
  assert.equal(scenario, "reuse");
  const rollout = await withCodexReadOnlyThread(
    cwd,
    { codexExecution: { speed: "standard", sessionRetention: "archive" } },
    async (thread) => {
      assert.equal((await thread.run(fixturePrompt!)).finalResponse, fixtureAnswer);
      const threadId = thread.id;
      assert(threadId);
      const afterFirst = active();
      assert.equal(afterFirst.length, 1);
      assert.deepEqual(archived(), []);
      assert.equal(
        (await thread.run("Continue with the same answer.")).finalResponse,
        fixtureAnswer,
      );
      assert.equal(thread.id, threadId);
      assert.deepEqual(active(), afterFirst);
      assert.deepEqual(archived(), []);
      return basename(afterFirst[0]!);
    },
  );
  assert.deepEqual(active(), []);
  assert.deepEqual(
    archived().map((path) => basename(path)),
    [rollout],
  );
}
