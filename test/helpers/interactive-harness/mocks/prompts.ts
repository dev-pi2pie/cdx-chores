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
  mock.module("@inquirer/prompts", () => ({
    select: async (options: SelectPromptOptions) => {
      const message = String(options.message ?? "");
      const choices = (options.choices ?? []).map((choice) => ({
        name: String(choice.name ?? ""),
        value: String(choice.value ?? ""),
        description:
          choice.description === undefined ? undefined : String(choice.description),
      }));

      context.result.promptCalls.push({
        kind: "select",
        message,
      });
      context.result.selectChoicesByMessage[message] = choices;

      return context.shiftQueueValue(
        context.scenario.selectQueue ?? [],
        `select:${message}`,
      );
    },
    checkbox: async (options: BooleanPromptOptions) => {
      const message = String(options.message ?? "");
      context.result.promptCalls.push({ kind: "checkbox", message });
      return context.shiftQueueValue(
        context.scenario.checkboxQueue ?? [],
        `checkbox:${message}`,
      );
    },
    confirm: async (options: BooleanPromptOptions) => {
      const message = String(options.message ?? "");
      context.result.promptCalls.push({ kind: "confirm", message });
      return context.shiftQueueValue(
        context.scenario.confirmQueue ?? [],
        `confirm:${message}`,
      );
    },
    input: async (options: TextPromptOptions) => {
      const message = String(options.message ?? "");
      context.result.promptCalls.push({
        kind: "input",
        message,
        defaultValue:
          typeof options.default === "string" ? options.default : undefined,
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
        defaultValue:
          typeof options.default === "string" ? options.default : undefined,
        postfix:
          typeof options.postfix === "string" ? options.postfix : undefined,
      });

      return await resolveValidatedValue(
        context,
        context.scenario.editorQueue ?? [],
        "editor",
        message,
        options.validate,
      );
    },
  }));
}
