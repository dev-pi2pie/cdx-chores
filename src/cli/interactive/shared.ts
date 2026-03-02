import type { PathPromptRuntimeConfig } from "../prompts/path-config";
import type { CliRuntime } from "../types";

export interface InteractivePathPromptContext {
  runtimeConfig: PathPromptRuntimeConfig;
  cwd: CliRuntime["cwd"];
  stdin: CliRuntime["stdin"];
  stdout: CliRuntime["stdout"];
}

export function assertNeverInteractiveAction(action: never): never {
  throw new Error(`Unhandled interactive action: ${String(action)}`);
}
