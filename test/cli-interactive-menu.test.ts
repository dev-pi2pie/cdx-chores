import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";

import { actionDoctor } from "../src/cli/actions";
import { runInteractiveMode } from "../src/cli/interactive";
import { selectInteractiveAction } from "../src/cli/interactive/menu";
import type { SelectInteractiveMenuChoiceOptions } from "../src/cli/interactive/menu-prompt";
import type { CliRuntime } from "../src/cli/types";
import { createDoctorFixture } from "./helpers/doctor-test-fixtures";

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

  get text(): string {
    return this.writes.join("");
  }
}

function createRuntime(): {
  runtime: CliRuntime;
  stdin: FakePromptReadStream;
  stdout: FakePromptWriteStream;
  stderr: FakePromptWriteStream;
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
    stderr,
  };
}

describe("interactive command menu wiring", () => {
  test("selectInteractiveAction passes stdin and stdout to the root command menu helper", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const calls: Array<{
      message: string;
      input: NodeJS.ReadStream;
      output: NodeJS.WritableStream;
    }> = [];
    const selectMenuChoiceImpl = async <Value extends string>(
      options: SelectInteractiveMenuChoiceOptions<Value>,
    ): Promise<Value> => {
      calls.push({
        message: options.message,
        input: options.input,
        output: options.output,
      });
      return options.exitValue;
    };

    const result = await selectInteractiveAction({
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      selectMenuChoiceImpl,
    });

    expect(result).toBe("cancel");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.message).toBe("Choose a command");
    expect(calls[0]?.input).toBe(stdin as unknown as NodeJS.ReadStream);
    expect(calls[0]?.output).toBe(stdout as unknown as NodeJS.WritableStream);
  });

  test("selectInteractiveAction wires the same stdin/stdout through the submenu helper", async () => {
    const stdin = new FakePromptReadStream();
    const stdout = new FakePromptWriteStream();
    const calls: string[] = [];
    const selectMenuChoiceImpl = async <Value extends string>(
      options: SelectInteractiveMenuChoiceOptions<Value>,
    ): Promise<Value> => {
      expect(options.input).toBe(stdin as unknown as NodeJS.ReadStream);
      expect(options.output).toBe(stdout as unknown as NodeJS.WritableStream);
      calls.push(options.message);
      if (calls.length === 1) {
        return "data" as Value;
      }
      return options.exitValue;
    };

    const result = await selectInteractiveAction({
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WritableStream,
      selectMenuChoiceImpl,
    });

    expect(result).toBe("cancel");
    expect(calls).toEqual(["Choose a command", "Choose a data command"]);
  });

  test("runInteractiveMode passes runtime streams into selectInteractiveAction and prints spaced cancellation", async () => {
    const { runtime, stdin, stdout } = createRuntime();
    const calls: Array<{
      input: NodeJS.ReadStream | undefined;
      output: NodeJS.WritableStream | undefined;
    }> = [];

    await runInteractiveMode(runtime, {
      selectInteractiveActionImpl: async (options) => {
        calls.push({
          input: options?.stdin,
          output: options?.stdout,
        });
        return "cancel";
      },
    });

    expect(calls).toEqual([
      {
        input: stdin as unknown as NodeJS.ReadStream,
        output: stdout as unknown as NodeJS.WritableStream,
      },
    ]);
    expect(stdout.text).toContain("\nCancelled.\n");
  });

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

  test("runInteractiveMode renders compact doctor output from Summary", async () => {
    const { runtime, stdout, stderr } = createRuntime();
    const fixture = createDoctorFixture();

    await runInteractiveMode(runtime, {
      selectInteractiveActionImpl: async () => "doctor",
      selectInteractiveDoctorOutputImpl: async () => "summary",
      actionDoctorImpl: async (doctorRuntime, options) => {
        await actionDoctor(doctorRuntime, { ...options, inspectors: fixture.inspectors });
      },
    });

    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Workflows:");
    expect(stdout.text).not.toContain("Platform:");
    expect(fixture.calls).toEqual({
      commands: ["pandoc", "ffmpeg", "weasyprint", "fc-list", "fc-query"],
      query: 1,
      codex: 1,
    });
  });

  test("runInteractiveMode renders detailed doctor output from Details", async () => {
    const { runtime, stdout, stderr } = createRuntime();
    const fixture = createDoctorFixture();

    await runInteractiveMode(runtime, {
      selectInteractiveActionImpl: async () => "doctor",
      selectInteractiveDoctorOutputImpl: async () => "details",
      actionDoctorImpl: async (doctorRuntime, options) => {
        await actionDoctor(doctorRuntime, { ...options, inspectors: fixture.inspectors });
      },
    });

    expect(stderr.text).toBe("");
    expect(stdout.text).toContain("Platform:");
    expect(stdout.text).not.toContain("Workflows:");
    expect(fixture.calls).toEqual({
      commands: ["pandoc", "ffmpeg", "weasyprint", "fc-list", "fc-query"],
      query: 1,
      codex: 1,
    });
  });

  test("runInteractiveMode renders structured doctor output from JSON", async () => {
    const { runtime, stdout, stderr } = createRuntime();
    const fixture = createDoctorFixture();

    await runInteractiveMode(runtime, {
      selectInteractiveActionImpl: async () => "doctor",
      selectInteractiveDoctorOutputImpl: async () => "json",
      actionDoctorImpl: async (doctorRuntime, options) => {
        await actionDoctor(doctorRuntime, { ...options, inspectors: fixture.inspectors });
      },
    });

    expect(stderr.text).toBe("");
    expect(JSON.parse(stdout.text)).toMatchObject({
      platform: runtime.platform,
      query: { available: true },
    });
    expect(fixture.calls).toEqual({
      commands: ["pandoc", "ffmpeg", "weasyprint", "fc-list", "fc-query"],
      query: 1,
      codex: 1,
    });
  });
});
