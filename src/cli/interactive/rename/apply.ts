import { confirm } from "@inquirer/prompts";

import { actionRenameApply } from "../../actions";
import { promptRequiredPathWithConfig } from "../../prompts/path";
import type { CliRuntime } from "../../types";
import type { InteractivePathPromptContext } from "../shared";

export async function handleRenameApplyInteractiveAction(
  runtime: CliRuntime,
  pathPromptContext: InteractivePathPromptContext,
): Promise<void> {
  const csvPath = await promptRequiredPathWithConfig("Rename plan CSV path", {
    kind: "csv",
    ...pathPromptContext,
  });
  const autoClean = await confirm({
    message: "Auto-clean plan CSV after apply?",
    default: true,
  });
  await actionRenameApply(runtime, { csv: csvPath, autoClean });
}
