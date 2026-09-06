import type { CliRuntime } from "../../types";
import { handleRenameApplyInteractiveAction } from "./apply";
import { handleRenameBatchInteractiveAction } from "./batch";
import { handleRenameCleanupInteractiveAction } from "./cleanup";
import { handleRenameFileInteractiveAction } from "./file";
import type { RenameInteractiveActionKey } from "../menu";
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "../shared";
import { createInteractiveSession, type InteractiveSession } from "../session";

export async function handleRenameInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
  action: RenameInteractiveActionKey,
  session: InteractiveSession = createInteractiveSession(),
): Promise<void> {
  if (action === "rename:batch") {
    await handleRenameBatchInteractiveAction(
      runtime,
      pathPromptContext,
      session.codexTimeoutMs,
      session.codexExecution,
    );
    return;
  }

  if (action === "rename:cleanup") {
    await handleRenameCleanupInteractiveAction(
      runtime,
      pathPromptContext,
      session.codexTimeoutMs,
      session.codexExecution,
    );
    return;
  }

  if (action === "rename:file") {
    await handleRenameFileInteractiveAction(
      runtime,
      pathPromptContext,
      session.codexTimeoutMs,
      session.codexExecution,
    );
    return;
  }

  if (action === "rename:apply") {
    await handleRenameApplyInteractiveAction(runtime, pathPromptContext);
    return;
  }

  assertNeverInteractiveAction(action);
}
