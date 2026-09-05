import { runCli } from "../../helpers/cli-test-utils";

import {
  captureRenamePlanCsvSnapshotSync,
  cleanupRenamePlanCsvSinceSnapshotSync,
} from "./plan-artifacts";

export function withRenamePlanCsvCleanup<T>(workspace: string, run: () => T): T {
  const snapshot = captureRenamePlanCsvSnapshotSync(workspace);
  try {
    return run();
  } finally {
    cleanupRenamePlanCsvSinceSnapshotSync(workspace, snapshot);
  }
}

export function runRenameCli(
  workspace: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
): ReturnType<typeof runCli> {
  return withRenamePlanCsvCleanup(workspace, () => runCli(args, workspace, env));
}
