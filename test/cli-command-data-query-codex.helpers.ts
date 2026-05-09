import { chmod, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { inspectDataQueryExtensions } from "../src/cli/duckdb/query";
import { seedDataExtractFixtures } from "./helpers/data-extract-fixture-test-utils";
import { seedDuckDbWorkspaceFixture } from "./helpers/data-query-duckdb-fixture-test-utils";
import { runCli, withTempFixtureDir } from "./helpers/cli-test-utils";

export const queryExtensions = await inspectDataQueryExtensions();
export const duckdbReady = queryExtensions.available;
export const excelReady = queryExtensions.available && queryExtensions.excel?.loadable === true;
export const sqliteReady = queryExtensions.available && queryExtensions.sqlite?.loadable === true;

export async function createCodexStub(options: {
  promptPath?: string;
  sql: string;
  summary: string;
  workingDirectory: string;
}): Promise<string> {
  const stubPath = join(options.workingDirectory, "codex-stub.mjs");
  const promptWrite = options.promptPath
    ? `await writeFile(${JSON.stringify(options.promptPath)}, prompt, "utf8");`
    : "";
  const script = `#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

const prompt = await new Promise((resolve, reject) => {
  let text = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    text += chunk;
  });
  process.stdin.on("end", () => resolve(text));
  process.stdin.on("error", reject);
});

${promptWrite}

const response = JSON.stringify({
  sql: ${JSON.stringify(options.sql)},
  reasoning_summary: ${JSON.stringify(options.summary)},
});

process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "stub-thread" }) + "\\n");
process.stdout.write(JSON.stringify({ type: "turn.started" }) + "\\n");
process.stdout.write(JSON.stringify({
  type: "item.completed",
  item: { id: "msg-1", type: "agent_message", text: response },
}) + "\\n");
process.stdout.write(JSON.stringify({
  type: "turn.completed",
  usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 },
}) + "\\n");
`;

  await writeFile(stubPath, script, "utf8");
  await chmod(stubPath, 0o755);
  return stubPath;
}

export {
  chmod,
  readFile,
  writeFile,
  join,
  describe,
  expect,
  test,
  inspectDataQueryExtensions,
  seedDataExtractFixtures,
  seedDuckDbWorkspaceFixture,
  runCli,
  withTempFixtureDir,
};
