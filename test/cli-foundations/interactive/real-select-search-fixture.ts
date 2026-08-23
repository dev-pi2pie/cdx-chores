import { PassThrough } from "node:stream";

import { selectInteractiveMenuChoice } from "../../../src/cli/interactive/menu-prompt";

class PromptInput extends PassThrough {
  isTTY = true;

  setRawMode(): this {
    return this;
  }
}

class PromptOutput extends PassThrough {
  isTTY = true;
  columns = 80;
}

const stdin = new PromptInput();
const stdout = new PromptOutput();
const prompt = selectInteractiveMenuChoice({
  message: "Choose a command",
  choices: [
    { name: "doctor", value: "doctor" },
    { name: "query", value: "query" },
    { name: "cancel", value: "cancel" },
  ] as const,
  exitValue: "cancel",
  input: stdin as unknown as NodeJS.ReadStream,
  output: stdout as unknown as NodeJS.WritableStream,
});

await new Promise((resolve) => setImmediate(resolve));
stdin.write("q");
await new Promise((resolve) => setImmediate(resolve));
stdin.write("\r");

let timeout: ReturnType<typeof setTimeout> | undefined;
const result = await Promise.race([
  prompt,
  new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error("Timed out waiting for the real select prompt")),
      1_000,
    );
  }),
]);
clearTimeout(timeout);

process.stdout.write(`${result}\n`);
