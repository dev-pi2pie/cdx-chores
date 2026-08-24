import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO_ROOT } from "../../helpers/cli-test-utils";

export const interactiveHarnessRunnerPath = resolve(
  REPO_ROOT,
  "test/cli-foundations/interactive-harness/runner.ts",
);
export const actionsModuleUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/actions/index.ts")).href;
export const pathModuleUrl = pathToFileURL(resolve(REPO_ROOT, "src/cli/prompts/path.ts")).href;
export const pathConfigModuleUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/prompts/path-config.ts"),
).href;
export const interactiveIndexUrl = pathToFileURL(
  resolve(REPO_ROOT, "src/cli/interactive/index.ts"),
).href;
