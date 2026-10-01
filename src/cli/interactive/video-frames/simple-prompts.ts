import { input, select } from "@inquirer/prompts";
import { selectInteractiveMenuChoice } from "../menu-prompt";
import { getDisplayWidth } from "../../text-display-width";

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
  choices: { name: string; value: Value; description?: string; disabled?: boolean | string }[],
  exitValue: Value,
  defaultValue?: Value,
): Promise<Value> {
  const safeText = (value: string) => value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ");
  const promptMessage = safeText(message);
  const promptChoices = choices.map((choice) => ({
    ...choice,
    name: safeText(choice.name),
    ...(choice.description ? { description: safeText(choice.description) } : {}),
    ...(typeof choice.disabled === "string" ? { disabled: safeText(choice.disabled) } : {}),
  }));
  const help = "Up/Down navigate | Enter select | Esc Back";
  const pageSize = () => {
    const terminal = io.output as NodeJS.WritableStream & { rows?: number; columns?: number };
    if (!Number.isSafeInteger(terminal.rows) || terminal.rows! < 1) return 7;
    const columns =
      Number.isSafeInteger(terminal.columns) && terminal.columns! > 0 ? terminal.columns! : 80;
    const lines = (text: string) => Math.max(1, Math.ceil(getDisplayWidth(text) / columns));
    const descriptionRows = Math.max(
      0,
      ...promptChoices.map((choice) => (choice.description ? lines(choice.description) : 0)),
    );
    // Inquirer paginates already wrapped rows. Reserve the header, help, and terminal margin.
    return Math.max(
      1,
      Math.min(7, terminal.rows! - lines(`? ${promptMessage}`) - lines(help) - descriptionRows - 2),
    );
  };
  return await selectInteractiveMenuChoice({
    message: promptMessage,
    choices: promptChoices,
    exitValue,
    input: io.input,
    output: io.output,
    selectImpl: (options, context) =>
      invokePrompt([io.signal, context?.signal], (signal) =>
        select<Value>(
          {
            ...options,
            default: defaultValue,
            get pageSize() {
              return pageSize();
            },
            theme: { style: { keysHelpTip: () => help } },
          },
          { ...context, signal },
        ),
      ),
  });
}

export async function enterFrameValue(
  io: FramePromptIO,
  options: {
    message: string;
    default?: string;
    validate: (value: string) => true | string;
    transformer?: (value: string, flags: { isFinal: boolean }) => string;
  },
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
