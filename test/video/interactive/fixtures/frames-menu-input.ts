import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { stripVTControlCharacters } from "node:util";

class Input extends PassThrough {
  isTTY = true;
  isRaw = false;
  setRawMode(raw: boolean): this {
    this.isRaw = raw;
    return this;
  }
}

class Output extends PassThrough {
  isTTY = true;
  rows = 18;
  columns = 60;
  text = "";
  constructor() {
    super();
    this.end = (() => this) as typeof this.end;
    this.on("data", (value) => {
      this.text += stripVTControlCharacters(String(value));
    });
  }
}

export const keys = {
  up: "\x1b[A",
  down: "\x1b[B",
  left: "\x1b[D",
  right: "\x1b[C",
  escape: "\x1b",
  enter: "\r",
};

export const flush = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
};

export function frameMenuStreams() {
  const actualInput = new Input();
  const actualOutput = new Output();
  const io = {
    input: actualInput as unknown as NodeJS.ReadStream,
    output: actualOutput as unknown as NodeJS.WriteStream,
  };
  let promptStart = 0;
  let ready = false;
  const active = () => {
    assert(actualInput.isRaw, "Expected an active raw input owner");
    assert(actualInput.listenerCount("keypress") > 0, "Expected an initialized keypress owner");
  };
  const wait = async (text: string, start = promptStart) => {
    const deadline = performance.now() + 1_000;
    while (!actualOutput.text.slice(start).includes(text)) {
      if (performance.now() > deadline)
        throw new Error("Prompt did not reach " + text + ": " + actualOutput.text.slice(start));
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await flush();
    active();
    ready = true;
  };
  const step = async (input: string, text: string) => {
    const start = actualOutput.text.length;
    ready = false;
    actualInput.write(input);
    await wait(text, start);
  };
  const clean = async () => {
    const check = () => {
      assert.equal(actualInput.isRaw, false);
      assert.equal(actualInput.listenerCount("keypress"), 0);
      assert.equal(actualOutput.listenerCount("resize"), 0);
    };
    check();
    await flush();
    check();
    // Node may retain reusable data/newListener decoder hooks on the stream.
    promptStart = actualOutput.text.length;
    ready = false;
  };
  const fragment = async (sequence: string) => {
    assert(ready, "Wait for fresh prompt output before fragmented input");
    active();
    for (const byte of sequence) {
      actualInput.write(byte);
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await flush();
  };
  return { io, actualInput, actualOutput, wait, step, clean, fragment };
}
