import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { startOwnedProcess, type OwnedProcessResult } from "../../scripts/testing/process";
import { createTempFixtureDir } from "../helpers/cli-test-utils";

export type PandocRunner = (args: readonly string[]) => Promise<OwnedProcessResult>;

// Once cleanup is unresolved, further launches could hide still-owned work.
let unresolvedOwnership = false;

/** Probe only inside live tests; retain scratch if process shutdown cannot be verified. */
export async function withPandocFixtureDir<T>(
  prefix: string,
  run: (fixtureDir: string, runPandoc: PandocRunner) => Promise<T>,
): Promise<T> {
  if (unresolvedOwnership) throw new Error("Earlier Pandoc process ownership remains unresolved.");
  const fixtureDir = await createTempFixtureDir(prefix);
  const home = join(fixtureDir, ".pandoc-home");
  const temporary = join(fixtureDir, ".pandoc-tmp");
  let stopped = true;
  let groupId: number | undefined;
  const ownership = () => ({ groupId, retainedFixtureDir: fixtureDir });
  const runPandoc: PandocRunner = async (args) => {
    if (!stopped) {
      throw new Error(
        `Pandoc process ownership remains unresolved: ${JSON.stringify(ownership())}`,
      );
    }
    const owned = startOwnedProcess({
      executable: "pandoc",
      args,
      cwd: fixtureDir,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: home,
        TMPDIR: temporary,
        LANG: "C.UTF-8",
      },
      timeoutMs: 5_000,
      graceMs: 250,
      cleanupMs: 1_500,
    });
    groupId = owned.child.pid;
    stopped = false;
    owned.child.stdin.end();
    const result = await owned.completion;
    stopped = result.stopped;
    if (!result.ok) {
      throw new Error(
        `Required Pandoc execution failed: ${JSON.stringify({
          reason: result.reason,
          exitCode: result.exitCode,
          stopped: result.stopped,
          ...(!result.stopped ? ownership() : {}),
          issues: result.issues,
          stderr: result.stderr,
        })}`,
      );
    }
    return result;
  };
  const errors: unknown[] = [];
  let value: T | undefined;
  try {
    await mkdir(home);
    await mkdir(temporary);
    await runPandoc(["--version"]);
    value = await run(fixtureDir, runPandoc);
  } catch (error) {
    errors.push(error);
  }
  if (stopped) {
    try {
      await rm(fixtureDir, { recursive: true, force: true });
    } catch (error) {
      errors.push(error);
    }
  } else {
    unresolvedOwnership = true;
    errors.push(
      new Error(`Pandoc scratch retained for unresolved ownership: ${JSON.stringify(ownership())}`),
    );
  }
  if (errors.length > 1) throw new AggregateError(errors, "Pandoc test and cleanup failed.");
  if (errors.length === 1) throw errors[0];
  return value as T;
}
