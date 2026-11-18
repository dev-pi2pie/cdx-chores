import { appendFile, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { runLiveCheck } from "../../../scripts/spikes/codex-benchmark-live-check.ts";

export interface Scenario {
  jsonl: string;
  finishAfterFirstRead?: string;
  pathAfterLookups?: number | null;
  deadlineMs?: number;
  liveStatus?: "completed" | "interrupted";
  liveOutputTokens?: number;
  turnStartError?: boolean;
  retentionError?: boolean;
}

const home = process.env.CODEX_HOME;
if (!home) throw new Error("Fixture requires a temporary Codex home.");
const scenario = JSON.parse(await readFile(join(home, "scenario.json"), "utf8")) as Scenario;
const rolloutPath = join(home, "returned-rollout.jsonl");
const archivedPath = join(home, "archived.jsonl");
const trace = (event: string) => appendFile(join(home, "trace.txt"), `${event}\n`);

async function serve() {
  let lookups = 0;
  const lines = createInterface({ input: process.stdin });
  const send = (message: object) => console.log(JSON.stringify(message));
  for await (const line of lines) {
    const { id, method, params } = JSON.parse(line) as {
      id?: number;
      method: string;
      params?: { threadId?: string; ephemeral?: boolean };
    };
    if (method === "initialized") continue;
    const reply = (result: object) => send({ id, result });
    const reject = (message: string) => send({ id, error: { code: -32603, message } });
    if (method !== "initialize" && method !== "model/list" && method !== "thread/start") {
      if (params?.threadId !== "fixture-thread") throw new Error(`Wrong thread for ${method}`);
      await trace(`${method} ${params.threadId}`);
    }
    switch (method) {
      case "initialize":
        reply({ userAgent: "cdx_chores/0.170.0", codexHome: home });
        break;
      case "model/list":
        reply({
          data: [
            { model: "fixture-model", supportedReasoningEfforts: [{ reasoningEffort: "low" }] },
          ],
          nextCursor: null,
        });
        break;
      case "thread/start":
        if (params?.ephemeral !== false) throw new Error("Fixture requires a persisted thread.");
        await writeFile(rolloutPath, scenario.jsonl);
        reply({
          thread: {
            id: "fixture-thread",
            path: scenario.pathAfterLookups === undefined ? rolloutPath : null,
            modelProvider: "fixture-provider",
          },
        });
        break;
      case "turn/start":
        if (scenario.turnStartError) {
          reject("fixture turn start failed");
          break;
        }
        reply({ turn: { id: "fixture-turn" } });
        if (scenario.liveOutputTokens !== undefined) {
          send({
            method: "thread/tokenUsage/updated",
            params: {
              threadId: "fixture-thread",
              turnId: "fixture-turn",
              tokenUsage: { total: { outputTokens: scenario.liveOutputTokens } },
            },
          });
        }
        await trace("turn/completed fixture-turn");
        send({
          method: "turn/completed",
          params: {
            threadId: "fixture-thread",
            turn: {
              id: "fixture-turn",
              status: scenario.liveStatus ?? "completed",
              error: null,
              durationMs: 800,
            },
          },
        });
        break;
      case "thread/read":
        lookups++;
        reply({
          thread: {
            id: "fixture-thread",
            path:
              typeof scenario.pathAfterLookups === "number" && lookups >= scenario.pathAfterLookups
                ? rolloutPath
                : null,
          },
        });
        break;
      case "thread/archive":
      case "thread/delete":
        if (scenario.retentionError) {
          reject("fixture retention failed");
          break;
        }
        if (method === "thread/archive") await rename(rolloutPath, archivedPath);
        else await unlink(rolloutPath);
        reply({});
        break;
      default:
        throw new Error(`Unexpected fixture request: ${method}`);
    }
  }
}

if (process.argv[2] === "app-server") {
  await serve();
} else {
  const fixture = fileURLToPath(import.meta.url);
  let firstRead = true;
  await runLiveCheck(process.argv.slice(2), {
    appServer: { executable: process.execPath, args: [fixture, "app-server"] },
    rollout: {
      deadlineMs: scenario.deadlineMs,
      readRollout: async (path, signal) => {
        const jsonl = await readFile(path, { encoding: "utf8", signal });
        await trace(`rollout/read ${path}`);
        if (firstRead && scenario.finishAfterFirstRead !== undefined) {
          await appendFile(path, scenario.finishAfterFirstRead);
          await trace("rollout/write completed");
        }
        firstRead = false;
        return jsonl;
      },
    },
  });
}
