import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";

import { runInteractiveMode } from "../../../src/cli/interactive";
import type { CliRuntime } from "../../../src/cli/types";

class FakePromptReadStream extends EventEmitter {
  isTTY = true;
}

class FakePromptWriteStream {
  isTTY = true;
  writes: string[] = [];

  write(chunk: string | Uint8Array): boolean {
    this.writes.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }
}

function createRuntime(): {
  runtime: CliRuntime;
  stdin: FakePromptReadStream;
  stdout: FakePromptWriteStream;
} {
  const stdin = new FakePromptReadStream();
  const stdout = new FakePromptWriteStream();
  const stderr = new FakePromptWriteStream();

  return {
    runtime: {
      cwd: process.cwd(),
      colorEnabled: false,
      now: () => new Date("2026-04-08T00:00:00.000Z"),
      platform: process.platform,
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      stderr: stderr as unknown as NodeJS.WritableStream,
      displayPathStyle: "relative",
    },
    stdin,
    stdout,
  };
}

describe("doctor interactive menu routing", () => {
  test("runInteractiveMode passes runtime streams into the doctor output selector", async () => {
    const { runtime, stdin, stdout } = createRuntime();
    const selectCalls: Array<{
      input: NodeJS.ReadStream;
      output: NodeJS.WritableStream;
    }> = [];
    const callOrder: string[] = [];

    await runInteractiveMode(runtime, {
      selectInteractiveActionImpl: async () => "doctor",
      selectInteractiveDoctorOutputImpl: async (options) => {
        callOrder.push("select");
        selectCalls.push(options);
        return "summary";
      },
      actionDoctorImpl: async () => {
        callOrder.push("action");
      },
    });

    expect(selectCalls).toEqual([
      {
        input: stdin as unknown as NodeJS.ReadStream,
        output: stdout as unknown as NodeJS.WritableStream,
      },
    ]);
    expect(callOrder).toEqual(["select", "action"]);
  });
});
