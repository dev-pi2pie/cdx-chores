import { mkdir, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";

import { assertRunPath, readFixtureContext, suitePath } from "../../scripts/testing/run-context.ts";
import {
  registerFixtureOwner,
  flushFixtureExports,
  removeFixtureDir,
} from "../../scripts/testing/fixture-exports.ts";

import type { CliRuntime } from "../../src/cli/types";

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
  const proc = Bun.spawnSync({
    cmd: [process.execPath, join(REPO_ROOT, "src/bin.ts"), ...args],
    cwd,
    env: env ? { ...process.env, ...env } : undefined,
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
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(prefix)) throw new Error("Invalid fixture prefix.");
  const context = readFixtureContext(process.env, REPO_ROOT);
  let parent = TMP_ROOT;
  if (context) {
    assertRunPath(context.run, "scratch/" + context.suite + "/fixtures");
    parent = join(suitePath(context.run, context.suite, "scratch"), "fixtures");
  } else {
    await mkdir(parent, { recursive: true });
  }
  const root = await mkdtemp(join(parent, `${prefix}-`));
  registerFixtureOwner(root);
  return root;
}

export async function withTempFixtureDir<T>(
  prefix: string,
  run: (fixtureDir: string) => Promise<T>,
): Promise<T> {
  const fixtureDir = await createTempFixtureDir(prefix);
  const errors: unknown[] = [];
  let value: T | undefined;
  try {
    value = await run(fixtureDir);
  } catch (error) {
    errors.push(error);
  }
  try {
    await flushFixtureExports(fixtureDir, errors.length === 0);
  } catch (error) {
    errors.push(error);
  }
  try {
    await removeFixtureDir(fixtureDir);
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 1)
    throw new AggregateError(errors, "Fixture callback, export, or cleanup failed.");
  if (errors.length) throw errors[0];
  return value as T;
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
    now?: () => Date;
    displayPathStyle?: CliRuntime["displayPathStyle"];
  } = {},
): { runtime: CliRuntime; stdout: CaptureStream; stderr: CaptureStream } {
  const stdout = new CaptureStream();
  const stderr = new CaptureStream();
  return {
    runtime: {
      cwd: options.cwd ?? REPO_ROOT,
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
