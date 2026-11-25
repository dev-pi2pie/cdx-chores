import type { RunResult, Thread } from "@openai/codex-sdk";

import type { CodexSessionRetention } from "../../utils/codex-session-retention";
import { CodexAppServer } from "./app-server";
import { resolveDiscoveryExecutable } from "./discovery/executable";
import { applyCodexSessionRetention } from "./session-retention";

export type CodexThreadScope = Pick<Thread, "id" | "run">;

export function resolveCodexSessionLaunch(codexPathOverride?: string) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  return {
    executable: codexPathOverride ?? resolveDiscoveryExecutable(env),
    cwd: process.cwd(),
    env,
  };
}

export async function withRetainedCodexThread<T>(
  thread: Thread,
  launch: ReturnType<typeof resolveCodexSessionLaunch>,
  mode: Exclude<CodexSessionRetention, "keep">,
  work: (thread: CodexThreadScope) => Promise<T>,
): Promise<T> {
  let activeTurn: Promise<RunResult> | undefined;
  let attempted = false;
  let completed = false;
  let released = false;
  let threadId: string | null = null;

  const run: Thread["run"] = async (input, options) => {
    if (released || activeTurn)
      throw new Error("The Codex thread is unavailable for another turn.");
    attempted = true;
    completed = false;
    try {
      activeTurn = thread.run(input, options);
      const result = await activeTurn;
      // SDK run() returns usage only after a turn.completed event.
      completed = result.usage != null && (!threadId || threadId === thread.id);
      return result;
    } finally {
      threadId ??= thread.id;
      activeTurn = undefined;
    }
  };

  try {
    return await work({
      get id() {
        return thread.id;
      },
      run,
    });
  } finally {
    released = true;
    await activeTurn?.catch(() => undefined);
    if (attempted) {
      const outcome = await applyCodexSessionRetention({
        mode,
        threadId,
        completed,
        async request(method, params) {
          const server = new CodexAppServer(launch.executable, launch.cwd, launch.env, {
            cleanupOnSignal: true,
          });
          try {
            await server.initialize();
            await server.request(method, params);
          } finally {
            await server.close();
          }
        },
      });
      if (outcome.status === "skipped" || outcome.status === "failed") {
        const target = outcome.threadId ? ` for thread ${JSON.stringify(outcome.threadId)}` : "";
        const detail = JSON.stringify(outcome.error);
        process.stderr.write(`Codex session ${mode} ${outcome.status}${target}. ${detail}\n`);
      }
    }
  }
}
