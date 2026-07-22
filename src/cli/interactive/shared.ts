import type { PathPromptRuntimeConfig } from "../prompts/path-config";
import type { CliRuntime } from "../types";

export interface InteractivePathPromptContext {
  runtimeConfig: PathPromptRuntimeConfig;
  cwd: CliRuntime["cwd"];
  stdin: CliRuntime["stdin"];
  stdout: CliRuntime["stdout"];
}

export type InteractiveNavigationOutcome =
  | { kind: "complete" }
  | { group: "md"; kind: "open-submenu" };

export function assertNeverInteractiveAction(action: never): never {
  throw new Error(`Unhandled interactive action: ${String(action)}`);
}
