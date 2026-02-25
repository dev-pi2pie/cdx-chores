import { CliError } from "../errors";
import type { CliRuntime } from "../types";

export async function actionDeferred(runtime: CliRuntime, label: string): Promise<void> {
  void runtime;
  throw new CliError(`${label} is not implemented in the initial launch phase yet.`, {
    code: "DEFERRED_FEATURE",
    exitCode: 2,
  });
}

