import type { CliRuntime } from "../../types";
import type { CodexExecutionOptions } from "../../../utils/codex-execution";
import { runInteractiveRenameCleanup } from "../rename-cleanup";
import type { InteractivePathPromptContext } from "../shared";

export async function handleRenameCleanupInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  codexTimeoutMs: number,
  codexExecution?: CodexExecutionOptions,
): Promise<void> {
  await runInteractiveRenameCleanup(runtime, pathPromptContext, codexTimeoutMs, codexExecution);
}
