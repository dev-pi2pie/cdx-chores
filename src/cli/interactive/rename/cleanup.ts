import type { CliRuntime } from "../../types";
import { runInteractiveRenameCleanup } from "../rename-cleanup";
import type { InteractivePathPromptContext } from "../shared";

export async function handleRenameCleanupInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  await runInteractiveRenameCleanup(runtime, pathPromptContext);
}
