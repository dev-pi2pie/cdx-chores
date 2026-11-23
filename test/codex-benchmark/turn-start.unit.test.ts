import { expect, test } from "bun:test";
import {
  CodexAppServerError,
  CodexRequestTimeoutError,
  isTurnInputTooLarge,
} from "../../src/adapters/codex/app-server";
import { CodexAppServerTransportClosedError } from "../../src/adapters/codex/app-server-exit";
import { claimThreadId } from "../../src/adapters/codex/app-server-identity";
import { TrialObserver } from "../../src/adapters/codex/benchmark/turn";

test.each([
  { completion: "matching", failure: "timeout" },
  { completion: "unrelated", failure: "timeout" },
  { completion: "matching", failure: "EOF" },
  { completion: "unrelated", failure: "EOF" },
  { completion: "matching", failure: "error" },
] as const)(
  "handles $completion completion evidence after a start reply failure: $failure",
  async ({ completion, failure }) => {
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
    const errors = {
      timeout: new CodexRequestTimeoutError("turn/start"),
      EOF: new CodexAppServerTransportClosedError("Codex app-server stdout ended unexpectedly."),
      error: new Error("Request failed."),
    };
    const error = errors[failure];
    reply.reject(error);

    if (completion === "matching" && failure !== "error") {
      await expect(start).resolves.toBe("turn-1");
      await expect(observer.start.reconcileReply()).resolves.toBeUndefined();
    } else {
      await expect(start).rejects.toBe(error);
    }
  },
);

const refusal = {
  code: -32602,
  message: "Input exceeds the maximum length of 1048576 characters.",
  data: { input_error_code: "input_too_large" },
};

test.each([
  ["structured refusal", refusal, true],
  ["same code and message", { code: refusal.code, message: refusal.message }, false],
  ["wrong code", { ...refusal, code: -32603 }, false],
  ["unstructured data", { ...refusal, data: "input_too_large" }, false],
] as const)("classifies turn/start input refusal with %s", (_label, error, refused) => {
  expect(isTurnInputTooLarge(new CodexAppServerError("turn/start", error))).toBe(refused);
});

test.each([
  ["missing", undefined],
  ["numeric", 123],
  ["whitespace-only", " "],
] as const)("rejects a %s thread ID without claiming it", (_label, id) => {
  const owned = new Set(["thread-1"]);
  expect(() => claimThreadId(id, owned)).toThrow(
    "Codex app-server did not return a new thread ID.",
  );
  expect([...owned]).toEqual(["thread-1"]);
});
