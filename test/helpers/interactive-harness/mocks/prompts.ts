import { mock } from "bun:test";

import type { HarnessRunnerContext } from "../context";

interface PromptChoice {
  name?: unknown;
  value?: unknown;
  description?: unknown;
}

interface SelectPromptOptions {
  message?: unknown;
  choices?: PromptChoice[];
  default?: unknown;
}

interface BooleanPromptOptions {
  message?: unknown;
}

interface TextPromptOptions {
  message?: unknown;
  default?: unknown;
  postfix?: unknown;
  validate?: ((value: unknown) => boolean | string | Promise<boolean | string>) | undefined;
}

interface SearchPromptOptions extends TextPromptOptions {
  source?: (
    term: string | undefined,
    context: { signal: AbortSignal },
  ) => Promise<Array<string | PromptChoice>>;
}

function normalizedChoices(choices: Array<string | PromptChoice>) {
  return choices.map((choice) =>
    typeof choice === "string"
      ? { name: choice, value: choice, description: undefined }
      : {
          name: String(choice.name ?? ""),
          value: String(choice.value ?? ""),
          description: choice.description === undefined ? undefined : String(choice.description),
        },
  );
}

async function resolveValidatedValue(
  context: HarnessRunnerContext,
  queue: unknown[],
  label: string,
  message: string,
  validate: TextPromptOptions["validate"],
): Promise<unknown> {
  while (true) {
    const nextValue = context.shiftQueueValue(queue, `${label}:${message}`);
    if (!validate) {
      return nextValue;
    }

    const validation = await validate(nextValue);
    if (validation === true) {
      return nextValue;
    }

    context.result.validationCalls.push({
      kind: "input",
      message,
      value: String(nextValue ?? ""),
      error: String(validation),
    });
  }
}

export function installPromptMocks(context: HarnessRunnerContext): void {
  const searchPrompt = async (options: SearchPromptOptions) => {
    const message = String(options.message ?? "");
    context.result.promptCalls.push({
      kind: "search",
      message,
      defaultValue: typeof options.default === "string" ? options.default : undefined,
    });
    const queued = context.shiftQueueValue(context.scenario.searchQueue ?? [], `search:${message}`);
    const term = typeof queued === "string" ? queued : queued.term;
    const value = typeof queued === "string" ? queued : queued.value;
    const choices = options.source
      ? await options.source(term, { signal: new AbortController().signal })
      : [];
    context.result.searchChoicesByMessage[message] = normalizedChoices(choices);
    if (options.validate) {
      const validation = await options.validate(value);
      if (validation !== true) {
        throw new Error(String(validation));
      }
    }
    return value;
  };

  mock.module("@inquirer/search", () => ({ default: searchPrompt }));
  mock.module("@inquirer/prompts", () => ({
    select: async (options: SelectPromptOptions) => {
      const message = String(options.message ?? "");
      const choices = (options.choices ?? []).map((choice) => ({
        name: String(choice.name ?? ""),
        value: String(choice.value ?? ""),
        description: choice.description === undefined ? undefined : String(choice.description),
      }));

      context.result.promptCalls.push({
        kind: "select",
        message,
      });
      if (typeof options.default === "string") {
        (context.result.selectDefaultsByMessage[message] ??= []).push(options.default);
      }
      context.result.selectChoicesByMessage[message] = choices;

      return context.shiftQueueValue(context.scenario.selectQueue ?? [], `select:${message}`);
    },
    checkbox: async (options: BooleanPromptOptions) => {
      const message = String(options.message ?? "");
      context.result.promptCalls.push({ kind: "checkbox", message });
      return context.shiftQueueValue(context.scenario.checkboxQueue ?? [], `checkbox:${message}`);
    },
    confirm: async (options: BooleanPromptOptions) => {
      const message = String(options.message ?? "");
      context.result.promptCalls.push({ kind: "confirm", message });
      return context.shiftQueueValue(context.scenario.confirmQueue ?? [], `confirm:${message}`);
    },
    input: async (options: TextPromptOptions) => {
      const message = String(options.message ?? "");
      context.result.promptCalls.push({
        kind: "input",
        message,
        defaultValue: typeof options.default === "string" ? options.default : undefined,
      });

      return await resolveValidatedValue(
        context,
        context.scenario.inputQueue ?? [],
        "input",
        message,
        options.validate,
      );
    },
    editor: async (options: TextPromptOptions) => {
      const message = String(options.message ?? "");
      context.result.promptCalls.push({
        kind: "editor",
        message,
        defaultValue: typeof options.default === "string" ? options.default : undefined,
        postfix: typeof options.postfix === "string" ? options.postfix : undefined,
      });

      return await resolveValidatedValue(
        context,
        context.scenario.editorQueue ?? [],
        "editor",
        message,
        options.validate,
      );
    },
    search: searchPrompt,
  }));
}
