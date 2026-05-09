import type { CliRuntime } from "../../types";
import { handleRenameApplyInteractiveAction } from "./apply";
import { handleRenameBatchInteractiveAction } from "./batch";
import { handleRenameCleanupInteractiveAction } from "./cleanup";
import { handleRenameFileInteractiveAction } from "./file";
import type { RenameInteractiveActionKey } from "../menu";
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "../shared";

export async function handleRenameInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  action: RenameInteractiveActionKey,
): Promise<void> {
  if (action === "rename:batch") {
    await handleRenameBatchInteractiveAction(runtime, pathPromptContext);
    return;
  }

  if (action === "rename:cleanup") {
    await handleRenameCleanupInteractiveAction(runtime, pathPromptContext);
    return;
  }

  if (action === "rename:file") {
    await handleRenameFileInteractiveAction(runtime, pathPromptContext);
    return;
  }

  if (action === "rename:apply") {
    await handleRenameApplyInteractiveAction(runtime, pathPromptContext);
    return;
  }

  assertNeverInteractiveAction(action);
}
