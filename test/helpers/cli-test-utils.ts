import { mkdir, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { CliRuntime } from "../../src/cli/types";

export const REPO_ROOT = resolve(import.meta.dir, "../..");
export const TMP_ROOT = join(REPO_ROOT, "examples", "playground", ".tmp-tests");

export function toRepoRelativePath(absolutePath: string): string {
  return absolutePath.slice(REPO_ROOT.length + 1);
}

export function runCli(
  args: string[],
  cwd = REPO_ROOT,
): { exitCode: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync({
    cmd: [process.execPath, "src/bin.ts", ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

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

export class CaptureStream {
  public text = "";

  write(chunk: string | Uint8Array): boolean {
    this.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }
}

export function createCapturedRuntime(
  options: {
    cwd?: string;
    now?: () => Date;
    displayPathStyle?: CliRuntime["displayPathStyle"];
  } = {},
): { runtime: CliRuntime; stdout: CaptureStream; stderr: CaptureStream } {
  const stdout = new CaptureStream();
  const stderr = new CaptureStream();
  return {
    runtime: {
      cwd: options.cwd ?? REPO_ROOT,
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

