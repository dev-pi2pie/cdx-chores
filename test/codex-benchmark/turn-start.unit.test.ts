import { expect, test } from "bun:test";
import { CodexRequestTimeoutError } from "../../src/adapters/codex/app-server";
import { TrialObserver } from "../../src/adapters/codex/benchmark/turn";

test.each([
  { completion: "matching", timedOut: true },
  { completion: "unrelated", timedOut: true },
  { completion: "matching", timedOut: false },
] as const)(
  "handles $completion completion evidence when the reply times out: $timedOut",
  async ({ completion, timedOut }) => {
    let notify: (method: string, params: unknown) => void = () => {};
    const observer = new TrialObserver(
      {
        onNotification(listener) {
          notify = listener;
          return () => {};
        },
      },
      "thread-1",
    );
    const reply = Promise.withResolvers<unknown>();
    const start = observer.waitForStart(reply.promise);
    notify("turn/started", { threadId: "thread-1", turn: { id: "turn-1" } });
    notify("turn/completed", {
      threadId: "thread-1",
      turn: { id: completion === "matching" ? "turn-1" : "turn-2", status: "completed" },
    });
    const error = timedOut
      ? new CodexRequestTimeoutError("turn/start")
      : new Error("Request failed.");
    reply.reject(error);

    if (completion === "matching" && timedOut) {
      await expect(start).resolves.toBe("turn-1");
      await expect(observer.start.reconcileReply()).resolves.toBeUndefined();
    } else {
      await expect(start).rejects.toBe(error);
    }
  },
);
