import { runCli } from "../../helpers/cli-test-utils";

import {
  captureRenamePlanCsvSnapshotSync,
  cleanupRenamePlanCsvSinceSnapshotSync,
} from "./plan-artifacts";

export function withRenamePlanCsvCleanup<T>(run: () => T): T {
  const snapshot = captureRenamePlanCsvSnapshotSync();
  try {
    return run();
  } finally {
    cleanupRenamePlanCsvSinceSnapshotSync(snapshot);
  }
}

export function runRenameCli(...args: Parameters<typeof runCli>): ReturnType<typeof runCli> {
  return withRenamePlanCsvCleanup(() => runCli(...args));
}
