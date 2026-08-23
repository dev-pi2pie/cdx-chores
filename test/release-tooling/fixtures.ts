import { expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { REPO_ROOT, createTempFixtureDir } from "../helpers/cli-test-utils";

export { REPO_ROOT };

export type RunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export function stripBenignGitWarnings(stderr: string): string {
  return stderr
    .split("\n")
    .filter(
      (line) =>
        line !==
        "git: warning: confstr() failed with code 5: couldn't get path of DARWIN_USER_TEMP_DIR; using /tmp instead",
    )
    .join("\n")
    .trim();
}

export function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    input?: string;
  } = {},
): RunResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: options.env ?? process.env,
    input: options.input,
    encoding: "utf8",
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function expectSuccess(result: RunResult): void {
  expect(result.status).toBe(0);
  expect(stripBenignGitWarnings(result.stderr)).toBe("");
}

export function git(cwd: string, ...args: string[]): RunResult {
  return runCommand("git", args, { cwd });
}

export async function createReleaseFixtureRepo(prefix: string): Promise<string> {
  const repoDir = await createTempFixtureDir(prefix);

  expectSuccess(git(repoDir, "init", "-q"));
  expectSuccess(git(repoDir, "config", "user.name", "Release Tester"));
  expectSuccess(git(repoDir, "config", "user.email", "release.tester@example.com"));

  await writeFile(join(repoDir, "notes.txt"), "initial\n", "utf8");
  expectSuccess(git(repoDir, "add", "notes.txt"));
  expectSuccess(git(repoDir, "commit", "-m", "chore: bootstrap release fixtures"));
  expectSuccess(git(repoDir, "tag", "v0.1.0"));

  return repoDir;
}
