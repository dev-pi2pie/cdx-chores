import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { CliRuntime } from "../../src/cli/types";
import {
  captureRenamePlanCsvSnapshotSync,
  cleanupRenamePlanCsvSinceSnapshotSync,
} from "./rename-plan-test-utils";

export const REPO_ROOT = resolve(import.meta.dir, "../..");
export const TMP_ROOT = join(REPO_ROOT, "examples", "playground", ".tmp-tests");

export function toRepoRelativePath(absolutePath: string): string {
  return absolutePath.slice(REPO_ROOT.length + 1);
}

export function runCli(
  args: string[],
  cwd = REPO_ROOT,
  env?: NodeJS.ProcessEnv,
): { exitCode: number; stdout: string; stderr: string } {
  const renamePlanCsvSnapshot = captureRenamePlanCsvSnapshotSync();
  const proc = Bun.spawnSync({
    cmd: [process.execPath, "src/bin.ts", ...args],
    cwd,
    env: env ? { ...process.env, ...env } : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });
  cleanupRenamePlanCsvSinceSnapshotSync(renamePlanCsvSnapshot);

  return {
    exitCode: proc.exitCode,
    stdout: Buffer.from(proc.stdout).toString("utf8"),
    stderr: Buffer.from(proc.stderr).toString("utf8"),
  };
}

export async function createTempFixtureDir(prefix: string): Promise<string> {
  await mkdir(TMP_ROOT, { recursive: true });
  return await mkdtemp(join(TMP_ROOT, `${prefix}-`));
}

export async function withTempFixtureDir<T>(prefix: string, run: (fixtureDir: string) => Promise<T>): Promise<T> {
  const fixtureDir = await createTempFixtureDir(prefix);
  try {
    return await run(fixtureDir);
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
}

export class CaptureStream {
  public text = "";

  write(chunk: string | Uint8Array): boolean {
    this.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }
}

export function createCapturedRuntime(
  options: {
    colorEnabled?: boolean;
    cwd?: string;
    debug?: boolean;
    now?: () => Date;
    displayPathStyle?: CliRuntime["displayPathStyle"];
  } = {},
): { runtime: CliRuntime; stdout: CaptureStream; stderr: CaptureStream } {
  const stdout = new CaptureStream();
  const stderr = new CaptureStream();
  return {
    runtime: {
      cwd: options.cwd ?? REPO_ROOT,
      debug: options.debug ?? false,
      colorEnabled: options.colorEnabled ?? true,
      now: options.now ?? (() => new Date("2026-02-25T00:00:00.000Z")),
      platform: process.platform,
      stdout: stdout as unknown as NodeJS.WritableStream,
      stderr: stderr as unknown as NodeJS.WritableStream,
      stdin: process.stdin,
      displayPathStyle: options.displayPathStyle ?? "relative",
    },
    stdout,
    stderr,
  };
}
