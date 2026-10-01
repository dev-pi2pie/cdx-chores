import { describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import {
  promptFramePicker,
  type PickerObservation,
} from "../../../src/cli/interactive/video-frames/picker";
import type { FrameRequest } from "../../../src/cli/interactive/video-frames/selection";
import { CliError } from "../../../src/cli/errors";

class Input extends PassThrough {
  isTTY = true;
  isRaw = false;
  onRaw?: () => void;
  setRawMode(raw: boolean): this {
    this.isRaw = raw;
    if (raw) this.onRaw?.();
    return this;
  }
}
class Output extends PassThrough {
  isTTY = true;
  columns = 100;
  rows = 32;
  text = "";
  constructor() {
    super();
    this.on("data", (chunk) => {
      this.text += String(chunk);
    });
  }
}
const flush = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
};
const escape = async (input: Input, completed: () => boolean = () => !input.isRaw) => {
  input.write("\x1b");
  const deadline = Date.now() + 2_000;
  while (!completed()) {
    if (Date.now() > deadline) throw new Error("Escape did not settle the expected input owner.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
function streams() {
  const input = new Input();
  const output = new Output();
  return {
    input: input as unknown as NodeJS.ReadStream,
    output: output as unknown as NodeJS.WriteStream,
    actualInput: input,
    actualOutput: output,
  };
}

describe("synthetic frame picker ownership", () => {
  for (const key of ["\x1b", "\x03"])
    test("fatal closure survives picker cancellation " + JSON.stringify(key), async () => {
      const io = streams();
      const failure = new CliError("Child closure unconfirmed", {
        code: "PROCESS_STOP_FAILED",
        exitCode: 2,
      });
      let resolving = false;
      const prompt = promptFramePicker({
        ...io,
        durationMs: 3000,
        resolve: async (_request, signal) => {
          resolving = true;
          return await new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(failure), { once: true }),
          );
        },
      });
      void prompt.catch(() => {});
      io.actualInput.write("\r");
      await flush();
      expect(resolving).toBe(true);
      io.actualInput.write(key);
      await expect(prompt).rejects.toBe(failure);
      expect(io.actualInput.isRaw).toBe(false);
      expect(io.actualInput.listenerCount("keypress")).toBe(0);
      expect(io.actualOutput.listenerCount("resize")).toBe(0);
    });
  test("picker endpoint resolution retains custom naming intent", async () => {
    const io = streams();
    const prompt = promptFramePicker({
      ...io,
      durationMs: 3_000,
      resolve: async () => ({ frameNumber: 1, startMs: 0 }),
    });
    io.actualInput.write("\r");
    const result = await prompt;
    expect(result?.request).toEqual({ kind: "first" });
    expect(result?.selection).toBe("custom");
    expect(io.actualInput.isRaw).toBe(false);
  });

  test("navigation, glyph changes and layout resize preserve the precise request without resolution", async () => {
    const io = streams();
    const observations: PickerObservation[] = [];
    let calls = 0;
    const request: FrameRequest = { kind: "time", timeMs: { numerator: 1234n, denominator: 1n } };
    const prompt = promptFramePicker({
      ...io,
      durationMs: 3000,
      initialState: { request, resolved: { frameNumber: 3, startMs: 1200 }, glyphs: "unicode" },
      resolve: async () => {
        calls++;
        return { frameNumber: 3 };
      },
      onChange: (value) => observations.push(value),
    });
    io.actualInput.write("A");
    await flush();
    io.actualOutput.rows = 18;
    io.actualOutput.emit("resize");
    await flush();
    expect(observations.at(-1)?.layout).toBe("compact");
    expect(observations.at(-1)?.state).toEqual({
      request,
      resolved: { frameNumber: 3, startMs: 1200 },
      glyphs: "ascii",
    });
    expect(calls).toBe(0);
    await escape(io.actualInput);
    expect(await prompt).toBeNull();
    expect(io.actualInput.isRaw).toBe(false);
    expect(io.actualInput.listenerCount("keypress")).toBe(0);
    expect(io.actualOutput.listenerCount("resize")).toBe(0);
    expect(io.actualOutput.text).toContain("\x1b[?25h");
  });

  test("editor letters and arrows belong to the editor; invalid input does not resolve", async () => {
    const io = streams();
    const observations: PickerObservation[] = [];
    const requests: FrameRequest[] = [];
    const prompt = promptFramePicker({
      ...io,
      durationMs: 3000,
      resolve: async (request) => {
        requests.push(request);
        return { frameNumber: 2, startMs: 100 };
      },
      onChange: (value) => observations.push(value),
    });
    io.actualInput.write("FaTf\r");
    await flush();
    expect(observations.at(-1)?.editor?.draft).toBe("aTf");
    expect(requests).toEqual([]);
    io.actualOutput.rows = 10;
    io.actualOutput.emit("resize");
    await flush();
    expect(observations.at(-1)?.editor?.draft).toBe("aTf");
    io.actualOutput.rows = 32;
    io.actualOutput.emit("resize");
    await flush();
    await escape(io.actualInput, () => observations.at(-1)?.editor === undefined);
    io.actualInput.write("f2\r");
    expect((await prompt)?.resolved).toEqual({ frameNumber: 2, startMs: 100 });
    expect(requests).toEqual([{ kind: "frame", frameNumber: 2 }]);
    expect(io.actualInput.listenerCount("keypress")).toBe(0);
  });

  test("cancellation holds input until the resolver acknowledges closure", async () => {
    const io = streams();
    const observations: PickerObservation[] = [];
    let calls = 0;
    let signal: AbortSignal | undefined;
    let rejectOperation!: (error: Error) => void;
    const prompt = promptFramePicker({
      ...io,
      durationMs: 3000,
      resolve: (_request, operationSignal) => {
        calls++;
        signal = operationSignal;
        return new Promise((_resolve, reject) => {
          rejectOperation = reject;
        });
      },
      onChange: (value) => observations.push(value),
    });
    io.actualInput.write("\r");
    await flush();
    await escape(io.actualInput, () => signal?.aborted === true);
    expect(signal?.aborted).toBe(true);
    expect(observations.at(-1)?.resolving).toBe(true);
    io.actualInput.write("aF\x1b[C\r");
    await flush();
    expect(calls).toBe(1);
    expect(observations.at(-1)?.state.glyphs).toBe("unicode");
    rejectOperation(new Error("Synthetic stop acknowledged"));
    await flush();
    expect(observations.at(-1)?.resolving).toBe(false);
    await escape(io.actualInput);
    expect(await prompt).toBeNull();
    expect(io.actualInput.isRaw).toBe(false);
    expect(io.actualInput.listenerCount("keypress")).toBe(0);
  });

  test("resolver failure restores the session; noninteractive input never opens it", async () => {
    const io = streams();
    const prompt = promptFramePicker({
      ...io,
      durationMs: 3000,
      resolve: async () => {
        throw new Error("Synthetic failure");
      },
    });
    io.actualInput.write("\r");
    await expect(prompt).rejects.toThrow("Synthetic failure");
    expect(io.actualInput.isRaw).toBe(false);
    expect(io.actualOutput.listenerCount("resize")).toBe(0);
    io.actualInput.isTTY = false;
    await expect(
      promptFramePicker({
        ...io,
        resolve: async () => {
          throw new Error("Must not resolve");
        },
      }),
    ).rejects.toThrow("direct video frames CLI options");
    expect(io.actualInput.listenerCount("keypress")).toBe(0);
  });

  test("interruption waits for resolver acknowledgement and keeps interruption semantics", async () => {
    const io = streams();
    let signal: AbortSignal | undefined;
    let rejectOperation!: (error: Error) => void;
    let settled = false;
    const prompt = promptFramePicker({
      ...io,
      durationMs: 3_000,
      resolve: (_request, operationSignal) => {
        signal = operationSignal;
        return new Promise((_resolve, reject) => {
          rejectOperation = reject;
        });
      },
    });
    const outcome = prompt.catch((error: unknown) => {
      settled = true;
      return error;
    });
    io.actualInput.write("\r");
    await flush();
    io.actualInput.write("\x03");
    await flush();
    expect(signal?.aborted).toBe(true);
    expect(settled).toBe(false);
    expect(io.actualInput.isRaw).toBe(true);
    rejectOperation(new Error("Resolver acknowledged cancellation"));
    expect(await outcome).toMatchObject({ name: "ExitPromptError" });
    expect(io.actualInput.isRaw).toBe(false);
    expect(io.actualInput.listenerCount("keypress")).toBe(0);
    expect(io.actualOutput.listenerCount("resize")).toBe(0);
    expect(io.actualOutput.text).toContain("\x1b[?25h");
  });
});

describe("simple prompt cancellation initialization", () => {
  test("immediate and setup-time aborts leave no listener; the next ordinary prompt works", () => {
    verifyRealPromptCancellation("initialization", ["immediate", "setup"]);
  }, 10_000);

  test("pre-aborted input never starts an Inquirer session", () => {
    verifyRealPromptCancellation("pre-aborted", ["pre-aborted"]);
  }, 10_000);

  test("direct resolution preserves interruption after either acknowledgement outcome", () => {
    verifyRealPromptCancellation("direct-interruption", ["rejected", "resolved"]);
  }, 10_000);
});

function verifyRealPromptCancellation(scenario: string, cases: string[]): void {
  // A fresh synchronous child loads installed Inquirer independently of other tests' module mocks.
  const result = Bun.spawnSync({
    cmd: [process.execPath, import.meta.dir + "/fixtures/real-prompt-cancellation.ts", scenario],
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: 5_000,
    killSignal: "SIGKILL",
    maxBuffer: 65_536,
  });
  expect({
    exitCode: result.exitCode,
    success: result.success,
    timedOut: Boolean(result.exitedDueToTimeout),
    outputLimitExceeded: Boolean(result.exitedDueToMaxBuffer),
    signal: result.signalCode ?? null,
    stderr: result.stderr.toString(),
    stdout: result.stdout.toString(),
  }).toEqual({
    exitCode: 0,
    success: true,
    timedOut: false,
    outputLimitExceeded: false,
    signal: null,
    stderr: "",
    stdout: JSON.stringify({ cases, passed: true }) + "\n",
  });
}
