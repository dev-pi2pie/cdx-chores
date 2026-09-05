import type { ModelReasoningEffort } from "@openai/codex-sdk";
import { Command, InvalidArgumentError, Option } from "commander";

import {
  resolveCodexExecution,
  type CodexExecutionOptions,
  type ResolvedCodexExecution,
} from "../../utils/codex-execution";

export interface CodexExecutionCommandOptions {
  codexModel?: string;
  codexProvider?: string;
  codexReasoningEffort?: ModelReasoningEffort;
}

function resolveCommandPolicy(options: CodexExecutionOptions): ResolvedCodexExecution {
  try {
    return resolveCodexExecution(options);
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
): Option {
  const option = new Option(flags, description);
  return option.argParser<string | undefined>((value, previous) => {
    if (previous !== undefined) {
      throw new InvalidArgumentError(`${option.long} may only be specified once.`);
    }
    return resolveCommandPolicy({ [field]: value })[field];
  });
}

export function applyCodexExecutionOptions(command: Command): Command {
  return command
    .addOption(executionOption("--codex-model <model>", "Codex model override", "model"))
    .addOption(
      executionOption("--codex-provider <provider-id>", "Codex provider override", "provider"),
    )
    .addOption(
      executionOption(
        "--codex-reasoning-effort <effort>",
        "Codex reasoning effort (default: low)",
        "reasoningEffort",
      ),
    );
}

export function resolveCodexExecutionCommandOptions(
  options: CodexExecutionCommandOptions,
): ResolvedCodexExecution {
  return resolveCommandPolicy({
    model: options.codexModel,
    provider: options.codexProvider,
    reasoningEffort: options.codexReasoningEffort,
  });
}
