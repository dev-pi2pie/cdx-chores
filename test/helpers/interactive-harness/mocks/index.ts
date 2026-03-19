import type { HarnessRunnerContext } from "../context";
import { installActionMocks } from "./actions";
import { installDataQueryMocks } from "./data-query";
import { installFsPromiseMocks } from "./fs";
import { installPathPromptMocks } from "./path-prompts";
import { installPromptMocks } from "./prompts";

export function installHarnessMocks(context: HarnessRunnerContext): void {
  installPromptMocks(context);
  installFsPromiseMocks(context);
  installActionMocks(context);
  installPathPromptMocks(context);
  installDataQueryMocks(context);
}
