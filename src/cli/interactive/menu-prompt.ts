import { emitKeypressEvents } from "node:readline";
import { select } from "@inquirer/prompts";
import type { Context as InquirerPromptContext } from "@inquirer/type";

import { createKeypressParser } from "../tui";

type MenuChoice<Value extends string> = {
  name: string;
  value: Value;
  description?: string;
};

type SelectPromptContext = InquirerPromptContext;
const keypressEventReadyInputs = new WeakSet<NodeJS.ReadStream>();

export interface SelectInteractiveMenuChoiceOptions<Value extends string> {
  message: string;
  choices: readonly MenuChoice<Value>[];
  exitValue: Value;
  input: NodeJS.ReadStream;
  output: NodeJS.WritableStream;
  selectImpl?: (
    options: {
      message: string;
      choices: readonly MenuChoice<Value>[];
    },
    context?: SelectPromptContext,
  ) => Promise<Value>;
}

function isOrdinaryQuitKey(str: string, key: { ctrl?: boolean; meta?: boolean; shift?: boolean }): boolean {
  return str === "q" && !key.ctrl && !key.meta && !key.shift;
}

function isAbortPromptError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortPromptError";
}

function ensureKeypressEvents(input: NodeJS.ReadStream): void {
  if (keypressEventReadyInputs.has(input)) {
    return;
  }

  emitKeypressEvents(input);
  keypressEventReadyInputs.add(input);
}

export async function selectInteractiveMenuChoice<Value extends string>(
  options: SelectInteractiveMenuChoiceOptions<Value>,
): Promise<Value> {
  const controller = new AbortController();
  const keyParser = createKeypressParser({
    onEscapeAbort: () => {
      abortedByExitKey = true;
      controller.abort();
    },
  });
  const selectImpl =
    options.selectImpl ??
    ((promptOptions, context) => select<Value>(promptOptions, context));
  const input = options.input;
  let abortedByExitKey = false;

  ensureKeypressEvents(input);

  const keypressHandler = (str: string | undefined, key: { ctrl?: boolean; meta?: boolean; shift?: boolean; name?: string } = {}): void => {
    const parsed = keyParser.handle(str, key);
    if (parsed.kind !== "keypress") {
      return;
    }

    if (isOrdinaryQuitKey(parsed.str, parsed.key)) {
      abortedByExitKey = true;
      controller.abort();
    }
  };

  input.on("keypress", keypressHandler);

  try {
    return await selectImpl(
      {
        message: options.message,
        choices: options.choices,
      },
      {
        input,
        output: options.output,
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (abortedByExitKey && isAbortPromptError(error)) {
      return options.exitValue;
    }
    throw error;
  } finally {
    input.off("keypress", keypressHandler);
    keyParser.dispose();
  }
}
