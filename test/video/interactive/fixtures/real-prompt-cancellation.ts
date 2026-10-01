import assert from "node:assert/strict";
import { PassThrough } from "node:stream";

import {
  chooseFrameOption,
  enterFrameValue,
} from "../../../../src/cli/interactive/video-frames/simple-prompts";
import { promptFramePicker } from "../../../../src/cli/interactive/video-frames/picker";

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
  constructor() {
    super();
    // A real terminal's process.stdout survives the prompt's output pipe ending.
    this.end = (() => this) as typeof this.end;
    this.on("data", () => {});
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
  } else {
    throw new Error("Unknown real prompt cancellation scenario.");
  }
  process.stdout.write(JSON.stringify({ cases, passed: true }) + "\n");
} finally {
  clearTimeout(guard);
}
