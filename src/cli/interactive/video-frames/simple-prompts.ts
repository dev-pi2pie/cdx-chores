import { input, select } from "@inquirer/prompts";
import { selectInteractiveMenuChoice } from "../menu-prompt";

export interface FramePromptIO {
  input: NodeJS.ReadStream;
  output: NodeJS.WritableStream;
  signal?: AbortSignal;
}

function cancelledPrompt(cause?: unknown): Error {
  const error = new Error("Prompt cancelled", { cause });
  error.name = "AbortPromptError";
  return error;
}

async function invokePrompt<T>(
  signals: (AbortSignal | undefined)[],
  invoke: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const combined = AbortSignal.any(
    signals.filter((signal): signal is AbortSignal => signal !== undefined),
  );
  if (combined.aborted) throw cancelledPrompt(combined.reason);
  const controller = new AbortController();
  let pending: NodeJS.Immediate | undefined;
  let initializing = true;
  // Inquirer queues its initial effects with setImmediate. Let that initialization
  // finish before abort cleanup, otherwise effects can attach listeners after close.
  const abort = () => {
    if (!initializing) pending = setImmediate(() => controller.abort(combined.reason));
  };
  combined.addEventListener("abort", abort, { once: true });
  try {
    const prompt = invoke(controller.signal);
    initializing = false;
    if (combined.aborted) abort();
    const result = await prompt;
    if (combined.aborted) throw cancelledPrompt(combined.reason);
    return result;
  } finally {
    combined.removeEventListener("abort", abort);
    if (pending) clearImmediate(pending);
  }
}

export async function chooseFrameOption<Value extends string>(
  io: FramePromptIO,
  message: string,
  choices: { name: string; value: Value }[],
  exitValue: Value,
): Promise<Value> {
  return await selectInteractiveMenuChoice({
    message,
    choices,
    exitValue,
    input: io.input,
    output: io.output,
    selectImpl: (options, context) =>
      invokePrompt([io.signal, context?.signal], (signal) =>
        select<Value>(options, { ...context, signal }),
      ),
  });
}

export async function enterFrameValue(
  io: FramePromptIO,
  options: { message: string; default?: string; validate: (value: string) => true | string },
): Promise<string | undefined> {
  // Empty input is invalid for these fields, so it is also an unambiguous Escape result.
  const answer = await selectInteractiveMenuChoice<string>({
    message: options.message,
    choices: [],
    exitValue: "",
    input: io.input,
    output: io.output,
    selectImpl: (_choices, context) =>
      invokePrompt([io.signal, context?.signal], (signal) =>
        input(options, { ...context, signal }),
      ),
  });
  return answer === "" ? undefined : answer;
}
