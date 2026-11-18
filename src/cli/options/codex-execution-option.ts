import type { ModelReasoningEffort } from "@openai/codex-sdk";
import { Command, InvalidArgumentError, Option } from "commander";

import {
  resolveCodexExecution,
  resolveCodexSelectors,
  type CodexExecutionOptions,
  type CodexSpeed,
  type ResolvedCodexExecution,
} from "../../utils/codex-execution";
import type { CodexSessionRetention } from "../../utils/codex-session-retention";

export interface CodexExecutionCommandOptions {
  codexModel?: string;
  codexProvider?: string;
  codexReasoningEffort?: ModelReasoningEffort;
  codexSpeed?: CodexSpeed;
  sessionRetention?: CodexSessionRetention;
}

function validateOption<T>(resolve: () => T): T {
  try {
    return resolve();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new InvalidArgumentError(error.message);
    }
    throw error;
  }
}

function executionOption(
  flags: string,
  description: string,
  field: keyof CodexExecutionOptions,
  repeatable = false,
): Option {
  const option = new Option(flags, description);
  const parse = (value: string) =>
    validateOption(() => resolveCodexSelectors({ [field]: value })[field]!);
  if (repeatable) {
    return option.argParser<string[]>((value, previous) => [...(previous ?? []), parse(value)]);
  }
  return option.argParser<string | undefined>((value, previous) => {
    if (previous !== undefined) {
      throw new InvalidArgumentError(`${option.long} may only be specified once.`);
    }
    return parse(value);
  });
}

export function applyCodexExecutionOptions(command: Command, benchmark = false): Command {
  if (!benchmark) {
    command.addHelpText(
      "after",
      "\nPass Codex options after this command. Model, provider, and speed inherit from Codex when omitted.\n" +
        "Session retention applies to threads this command creates after their final use.\n",
    );
  }
  return command
    .addOption(
      executionOption(
        "--codex-model <model>",
        benchmark ? "Codex model override (repeatable)" : "Codex model override",
        "model",
        benchmark,
      ),
    )
    .addOption(
      executionOption("--codex-provider <provider-id>", "Codex provider override", "provider"),
    )
    .addOption(
      executionOption(
        "--codex-reasoning-effort <effort>",
        benchmark
          ? "Codex reasoning effort (default: inherit)"
          : "Codex reasoning effort (default: low)",
        "reasoningEffort",
      ),
    )
    .addOption(
      executionOption(
        "--codex-speed <speed>",
        benchmark
          ? "Codex speed: standard, fast, or ultrafast (repeatable, default: inherit)"
          : "Codex speed: standard, fast, or ultrafast (default: inherit)",
        "speed",
        benchmark,
      ),
    )
    .addOption(
      executionOption(
        "--session-retention <mode>",
        "Codex sessions: keep (default), archive, or permanently delete",
        "sessionRetention",
      ),
    );
}

export function resolveCodexExecutionCommandOptions(
  options: CodexExecutionCommandOptions,
): ResolvedCodexExecution {
  return validateOption(() =>
    resolveCodexExecution({
      model: options.codexModel,
      provider: options.codexProvider,
      reasoningEffort: options.codexReasoningEffort,
      speed: options.codexSpeed,
      sessionRetention: options.sessionRetention,
    }),
  );
}
