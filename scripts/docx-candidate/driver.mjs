import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createHarness, HarnessError } from "./harness/index.mjs";

/** Keep final status behind owned-process settlement and temporary cleanup. */
export async function runCandidateDriver(options, run) {
  const harness = createHarness({ title: options.title, scope: options.scope });
  let workspace;
  let result;
  let failure;
  try {
    await harness.start();
    workspace = await mkdtemp(join(tmpdir(), options.prefix));
    result = await run(harness, workspace);
  } catch (error) {
    failure = error;
  }
  try {
    if (workspace) await harness.cleanup(workspace);
  } catch (error) {
    if (error instanceof HarnessError && failure instanceof HarnessError) error.id ??= failure.id;
    failure = error;
  }
  try {
    if (failure) {
      process.exitCode = 1;
      await harness.failure(
        failure instanceof HarnessError
          ? failure
          : new HarnessError("runner", options.stage?.() ?? "validation"),
      );
      if (workspace && !harness.cleanupUnconfirmed)
        await harness.success("Temporary cleanup confirmed");
    } else await harness.success("Temporary cleanup confirmed");
    await harness.result(failure ? options.failure() : result);
    if (options.cleanupResult)
      await harness.result(
        `temporary cleanup: passed ${harness.cleanupUnconfirmed ? "no" : "yes"}\n`,
      );
    await harness.finish();
  } catch {
    // An unavailable output destination must never produce an unhandled raw stack.
    process.exitCode = 1;
    await harness.finish().catch(() => {});
  }
}
