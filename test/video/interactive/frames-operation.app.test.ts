import { expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { CliError } from "../../../src/cli/errors";
import { runFrameWork } from "../../../src/cli/interactive/video-frames/operation";
const io = () => {
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    isRaw: false,
    setRawMode(value: boolean) {
      this.isRaw = value;
      return this;
    },
  });
  const output = Object.assign(new PassThrough(), { isTTY: true });
  output.resume();
  return { input: input as unknown as NodeJS.ReadStream, output, actualInput: input };
};
test("operation Escape waits for settlement, releases input and allows the next owner", async () => {
  const streams = io();
  let stopped = false;
  const task = runFrameWork(
    streams,
    "Scanning",
    (signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            stopped = true;
            reject(new CliError("Cancelled", { code: "PROCESS_CANCELLED", exitCode: 130 }));
          },
          { once: true },
        );
      }),
  );
  streams.actualInput.write("\x1b");
  expect(await task).toBeUndefined();
  expect(stopped).toBe(true);
  expect(streams.actualInput.isRaw).toBe(false);
  expect(streams.actualInput.listenerCount("keypress")).toBe(0);
  expect(await runFrameWork(streams, "Next", async () => "complete")).toBe("complete");
  expect(streams.actualInput.isRaw).toBe(false);
});
test("closure failure survives local Escape and never becomes a recoverable cancel", async () => {
  const streams = io();
  const failure = new CliError("Child closure unconfirmed", {
    code: "PROCESS_STOP_FAILED",
    exitCode: 2,
  });
  const task = runFrameWork(
    streams,
    "Export",
    (signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(failure), { once: true }),
      ),
  );
  streams.actualInput.write("\x1b");
  await expect(task).rejects.toBe(failure);
  expect(streams.actualInput.isRaw).toBe(false);
  expect(streams.actualInput.listenerCount("keypress")).toBe(0);
});

test("Escape holds ownership through a late successful acknowledgement and suppresses stale success", async () => {
  const streams = io();
  let signal: AbortSignal | undefined;
  let acknowledge!: () => void;
  const task = runFrameWork(streams, "Scanning", (ownedSignal) => {
    signal = ownedSignal;
    return new Promise<string>((resolve) => {
      acknowledge = () => resolve("late result");
    });
  });
  streams.actualInput.write("\x1b");
  const deadline = Date.now() + 2000;
  while (!signal?.aborted) {
    if (Date.now() > deadline) throw new Error("Escape did not reach the operation");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(streams.actualInput.isRaw).toBe(true);
  streams.actualInput.write("\x1b");
  acknowledge();
  expect(await task).toBeUndefined();
  expect(streams.actualInput.isRaw).toBe(false);
  expect(streams.actualInput.listenerCount("keypress")).toBe(0);
  expect(streams.output.listenerCount("resize")).toBe(0);
});

test("redirected Interactive progress uses plain stderr while the prompt keeps stdout", async () => {
  const streams = io();
  const progressOutput = new PassThrough();
  let progress = "",
    prompts = "";
  progressOutput.on("data", (chunk) => (progress += String(chunk)));
  streams.output.on("data", (chunk) => (prompts += String(chunk)));
  expect(
    await runFrameWork({ ...streams, progressOutput }, "Inspecting video", async () => "ready"),
  ).toBe("ready");
  expect(progress).toContain("Inspecting video | Elapsed");
  expect(progress).not.toContain("\x1b");
  expect(prompts).not.toContain("Inspecting video");
  expect(streams.actualInput.isRaw).toBe(false);
  expect(streams.actualInput.listenerCount("keypress")).toBe(0);
});
