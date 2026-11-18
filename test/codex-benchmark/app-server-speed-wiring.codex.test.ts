import { expect, test } from "bun:test";
import { EventEmitter, once } from "node:events";

import { LiveProtocolClient } from "../codex-info/live-protocol-client";
import {
  captureSpeedRequest,
  fixtureModel,
  fixturePrompt,
  speedCases,
} from "./fixtures/speed-provider";

test.each(speedCases)(
  "app-server sends the selected tier: $label",
  async ({ baseline, appServerTier, wireTier }) => {
    const requests = await captureSpeedRequest(
      baseline,
      async ({ codex, cwd, env, start, close }) => {
        const owned = start({ executable: codex, args: ["app-server"], env, timeoutMs: 12_000 });
        const completedTurns = new Map<string, string>();
        const notifications = new EventEmitter();
        const client = new LiveProtocolClient(
          codex,
          cwd,
          env,
          { child: owned.child, close: () => close(owned) },
          (method, params) => {
            if (method !== "turn/completed") return;
            const { threadId, turn } = params as {
              threadId: string;
              turn: { id: string; status: string };
            };
            const key = `${threadId}:${turn.id}`;
            completedTurns.set(key, turn.status);
            notifications.emit(key);
          },
        );
        try {
          await client.request("initialize", {
            clientInfo: {
              name: "cdx_chores_speed_probe",
              title: "Speed wiring probe",
              version: "1",
            },
          });
          client.notify("initialized");
          const { thread } = (await client.request("thread/start", {
            cwd,
            ephemeral: true,
            sandbox: "read-only",
            approvalPolicy: "never",
          })) as { thread: { id: string } };
          const { turn } = (await client.request("turn/start", {
            threadId: thread.id,
            input: [{ type: "text", text: fixturePrompt, text_elements: [] }],
            ...(appServerTier === undefined ? {} : { serviceTierForTurn: appServerTier }),
          })) as { turn: { id: string } };
          const key = `${thread.id}:${turn.id}`;
          if (!completedTurns.has(key))
            await once(notifications, key, { signal: AbortSignal.timeout(5_000) });
          expect(completedTurns.get(key)).toBe("completed");
        } finally {
          await client.close();
        }
      },
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: fixtureModel });
    expect(requests[0]?.service_tier).toBe(wireTier);
  },
  20_000,
);
