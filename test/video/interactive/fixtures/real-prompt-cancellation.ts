import assert from "node:assert/strict";
import { PassThrough } from "node:stream";

import {
  chooseFrameOption,
  enterFrameValue,
} from "../../../../src/cli/interactive/video-frames/simple-prompts";
import { promptFramePicker } from "../../../../src/cli/interactive/video-frames/picker";
import { promptFramePath } from "../../../../src/cli/interactive/video-frames/settings";
import { resolvePathPromptRuntimeConfig } from "../../../../src/cli/prompts/path-config";

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
    // A real terminal's process.stdout survives the prompt's output pipe ending.
    this.end = (() => this) as typeof this.end;
    this.on("data", (chunk) => {
      this.text += String(chunk);
    });
  }
}

const flush = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
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

async function verifyInitializationCancellation(setupTime: boolean): Promise<void> {
  const io = streams();
  const controller = new AbortController();
  if (setupTime) io.actualInput.onRaw = () => controller.abort("setup cancellation");
  const prompt = chooseFrameOption(
    { ...io, signal: controller.signal },
    "Synthetic choice",
    [
      { name: "Frame", value: "frame" },
      { name: "Back", value: "back" },
    ],
    "back",
  );
  if (!setupTime) controller.abort("immediate cancellation");
  await assert.rejects(prompt, { name: "AbortPromptError" });
  await flush();
  assert.equal(io.actualInput.isRaw, false);
  assert.equal(io.actualInput.listenerCount("keypress"), 0);
  assert.equal(io.actualOutput.listenerCount("resize"), 0);
  io.actualInput.onRaw = undefined;
  const next = enterFrameValue(io, {
    message: "Next ordinary prompt",
    validate: (value) => (value === "ready" ? true : "Required"),
  });
  await flush();
  io.actualInput.write("ready\r");
  assert.equal(await next, "ready");
  await flush();
  assert.equal(io.actualInput.listenerCount("keypress"), 0);
  assert.equal(io.actualInput.isRaw, false);
  assert.equal(io.actualOutput.listenerCount("resize"), 0);
}

async function verifyPreAborted(): Promise<void> {
  const io = streams();
  const controller = new AbortController();
  controller.abort();
  let rawStarts = 0;
  io.actualInput.onRaw = () => rawStarts++;
  await assert.rejects(
    chooseFrameOption(
      { ...io, signal: controller.signal },
      "Choice",
      [{ name: "Back", value: "back" }],
      "back",
    ),
    { name: "AbortPromptError" },
  );
  await flush();
  assert.equal(rawStarts, 0);
  assert.equal(io.actualInput.isRaw, false);
  assert.equal(io.actualInput.listenerCount("keypress"), 0);
  assert.equal(io.actualOutput.listenerCount("resize"), 0);
}

async function verifyDirectInterruption(resolveAfterAbort: boolean): Promise<void> {
  const io = streams();
  const controller = new AbortController();
  let acknowledge!: () => void;
  let operationSignal: AbortSignal | undefined;
  let settled = false;
  const prompt = promptFramePicker({
    ...io,
    simple: true,
    durationMs: 3_000,
    signal: controller.signal,
    resolve: (_request, signal) => {
      operationSignal = signal;
      return new Promise((resolve, reject) => {
        acknowledge = () =>
          resolveAfterAbort
            ? resolve({ frameNumber: 1, startMs: 0 })
            : reject(new Error("Resolver acknowledged cancellation"));
      });
    },
  });
  const outcome = prompt.catch((error: unknown) => {
    settled = true;
    return error;
  });
  await flush();
  io.actualInput.write("\x1b[B\x1b[B\r");
  await flush();
  assert(operationSignal, "Retained candidate must start direct resolution");
  controller.abort();
  await flush();
  assert.equal(operationSignal.aborted, true);
  assert.equal(settled, false);
  acknowledge();
  assert.equal(((await outcome) as Error).name, "ExitPromptError");
  await flush();
  assert.equal(io.actualInput.isRaw, false);
  assert.equal(io.actualInput.listenerCount("keypress"), 0);
  assert.equal(io.actualOutput.listenerCount("resize"), 0);
}

async function verifyDestinationValidation(simple: boolean): Promise<void> {
  const io = streams();
  let settled = false;
  const prompt = promptFramePath(
    { ...io, simple },
    {
      cwd: process.cwd(),
      stdin: io.input,
      stdout: io.output,
      runtimeConfig: resolvePathPromptRuntimeConfig({}),
    },
    "Output image file (.png)",
    "file",
    "png",
  ).then((value) => {
    settled = true;
    return value;
  });
  while (!io.actualInput.isRaw) await new Promise((resolve) => setTimeout(resolve, 10));
  await flush();
  io.actualInput.write("result.webp\r");
  while (!io.actualOutput.text.includes("extension must match"))
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(settled, false);
  assert(io.actualOutput.text.includes("result.webp"));
  io.actualInput.write("\x7f".repeat("result.webp".length) + "result.PnG\r");
  assert.equal(await prompt, "result.PnG");
  await flush();
  assert.equal(io.actualInput.isRaw, false);
  assert.equal(io.actualInput.listenerCount("keypress"), 0);
  assert.equal(io.actualOutput.listenerCount("resize"), 0);
}

async function verifyEstimatedDuration(targetMs: number): Promise<void> {
  const io = streams();
  let resolved = false;
  const prompt = promptFramePicker({
    ...io,
    simple: true,
    durationMs: 100,
    durationIsEstimate: true,
    resolve: async (request) => {
      assert.equal(request.kind, "time");
      if (request.kind !== "time") throw new Error("Expected timestamp");
      assert.equal(request.timeMs.numerator, BigInt(targetMs));
      resolved = true;
      if (targetMs >= 540) throw new Error("Outside verified decoded end");
      return { frameNumber: 3, startMs: 120 };
    },
  });
  void prompt.catch(() => {});
  await flush();
  io.actualInput.write("\x1b[B\r");
  await flush();
  io.actualInput.write(`00:00:00.${String(targetMs).padStart(3, "0")}\r`);
  if (targetMs < 540) assert.equal((await prompt)?.resolved.frameNumber, 3);
  else await assert.rejects(prompt, /Outside verified decoded end/);
  assert.equal(resolved, true);
  assert.equal(io.actualInput.isRaw, false);
  assert.equal(io.actualInput.listenerCount("keypress"), 0);
}

// The synchronous parent also enforces a hard timeout and output limit.
const guard = setTimeout(() => {
  process.stderr.write("Real Inquirer cancellation fixture timed out.\n");
  process.exit(1);
}, 3_000);
try {
  const scenario = process.argv[2];
  let cases: string[];
  if (scenario === "initialization") {
    await verifyInitializationCancellation(false);
    await verifyInitializationCancellation(true);
    cases = ["immediate", "setup"];
  } else if (scenario === "pre-aborted") {
    await verifyPreAborted();
    cases = ["pre-aborted"];
  } else if (scenario === "direct-interruption") {
    await verifyDirectInterruption(false);
    await verifyDirectInterruption(true);
    cases = ["rejected", "resolved"];
  } else if (scenario === "destination-validation") {
    await verifyDestinationValidation(false);
    await verifyDestinationValidation(true);
    cases = ["inline", "simple"];
  } else if (scenario === "estimated-duration") {
    await verifyEstimatedDuration(120);
    await verifyEstimatedDuration(540);
    cases = ["resolved", "rejected"];
  } else {
    throw new Error("Unknown real prompt cancellation scenario.");
  }
  process.stdout.write(JSON.stringify({ cases, passed: true }) + "\n");
} finally {
  clearTimeout(guard);
}
