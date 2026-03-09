import { confirm } from "@inquirer/prompts";

import { actionDoctor } from "../actions";
import { resolvePathPromptRuntimeConfig } from "../prompts/path-config";
import type { CliRuntime } from "../types";
import { handleDataInteractiveAction } from "./data";
import { handleMarkdownInteractiveAction } from "./markdown";
import { selectInteractiveAction } from "./menu";
import { handleRenameInteractiveAction } from "./rename";
import { assertNeverInteractiveAction, type InteractivePathPromptContext } from "./shared";
import { handleVideoInteractiveAction } from "./video";

export async function runInteractiveMode(runtime: CliRuntime): Promise<void> {
  const pathPromptContext: InteractivePathPromptContext = {
    runtimeConfig: resolvePathPromptRuntimeConfig(),
    cwd: runtime.cwd,
    stdin: runtime.stdin,
    stdout: runtime.stdout,
  };
  const action = await selectInteractiveAction();

  if (action === "cancel") {
    runtime.stdout.write("Cancelled.\n");
    return;
  }

  if (action === "doctor") {
    const asJson = await confirm({ message: "Output as JSON?", default: false });
    await actionDoctor(runtime, { json: asJson });
    return;
  }

  switch (action) {
    case "data:preview":
    case "data:json-to-csv":
    case "data:csv-to-json":
      await handleDataInteractiveAction(runtime, pathPromptContext, action);
      return;
    case "md:to-docx":
    case "md:frontmatter-to-json":
      await handleMarkdownInteractiveAction(runtime, pathPromptContext, action);
      return;
    case "rename:file":
    case "rename:batch":
    case "rename:cleanup":
    case "rename:apply":
      await handleRenameInteractiveAction(runtime, pathPromptContext, action);
      return;
    case "video:convert":
    case "video:resize":
    case "video:gif":
      await handleVideoInteractiveAction(runtime, pathPromptContext, action);
      return;
  }

  assertNeverInteractiveAction(action);
}
