import { chmod, lstat, mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { SUITES, type Suite } from "./selection.ts";

export const TEST_CONTEXT_ENV = "CDX_CHORES_TEST_CONTEXT";

export interface DirectoryIdentity {
  readonly dev: number;
  readonly ino: number;
}

export interface RunContext {
  readonly version: 1;
  readonly repoRoot: string;
  readonly root: string;
  readonly keepResults: boolean;
  readonly suites: readonly Suite[];
  readonly directories: Readonly<Record<string, DirectoryIdentity>>;
}

export interface FixtureContext {
  readonly run: RunContext;
  readonly suite: Suite;
}

export class RunAllocationError extends AggregateError {
  readonly remainingRoot: string;

  constructor(errors: unknown[], remainingRoot: string) {
    super(errors, "Run allocation and cleanup failed.");
    this.remainingRoot = remainingRoot;
  }
}

function identity(stat: { dev: number; ino: number }): DirectoryIdentity {
  return Object.freeze({ dev: stat.dev, ino: stat.ino });
}

function matches(stat: { dev: number; ino: number }, expected: DirectoryIdentity): boolean {
  return stat.dev === expected.dev && stat.ino === expected.ino;
}

function relativeParts(value: string): string[] {
  if (!value || isAbsolute(value) || value.includes("\\")) {
    throw new Error("Expected an owned relative path.");
  }
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("Expected an owned relative path.");
  }
  return parts;
}

export function runPath(context: RunContext, path: string): string {
  return join(context.root, ...relativeParts(path));
}

export function suitePath(context: RunContext, suite: Suite, area: "scratch" | "results"): string {
  if (!context.suites.includes(suite)) throw new Error("Suite does not belong to this invocation.");
  return runPath(context, area + "/" + suite);
}

/** Recheck both the canonical path and filesystem identity before using an owner. */
export function assertRunRoot(context: RunContext): void {
  const stat = lstatSync(context.root);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    !matches(stat, context.directories[""]!) ||
    realpathSync(context.root) !== context.root
  ) {
    throw new Error("Owned run root was replaced or became a symbolic link; refusing access.");
  }
}

/** The requested path must exist. Check every component, including tracked namespaces. */
export function assertRunPath(context: RunContext, path: string): void {
  assertRunRoot(context);
  let current = context.root;
  let key = "";
  for (const part of relativeParts(path)) {
    current = join(current, part);
    key = key ? key + "/" + part : part;
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error("Owned paths must not contain symbolic links.");
    const expected = context.directories[key];
    if (expected && (!stat.isDirectory() || !matches(stat, expected))) {
      throw new Error("An owned namespace was replaced; refusing access.");
    }
  }
}

export function assertRunParent(context: RunContext, absolutePath: string): void {
  const parent = dirname(absolutePath);
  const path = relative(context.root, parent);
  if (!path) assertRunRoot(context);
  else assertRunPath(context, path.split(sep).join("/"));
  if (
    resolve(absolutePath) !== absolutePath ||
    relative(context.root, absolutePath).startsWith("..")
  ) {
    throw new Error("Path escapes its run owner.");
  }
}

async function ensureRunParent(repoRoot: string): Promise<string> {
  let current = repoRoot;
  for (const part of ["examples", "playground", ".tmp-tests"]) {
    current = join(current, part);
    await mkdir(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(current)) !== current) {
      throw new Error("Test run parent must be a canonical directory without symbolic links.");
    }
  }
  return current;
}

export async function allocateRun(
  repoRoot: string,
  suites: readonly Suite[],
  keepResults: boolean,
): Promise<RunContext> {
  if (
    !suites.length ||
    new Set(suites).size !== suites.length ||
    suites.some((suite) => !SUITES.includes(suite))
  ) {
    throw new Error("Invalid run suite ownership.");
  }
  const canonicalRepo = await realpath(repoRoot);
  const parent = await ensureRunParent(canonicalRepo);
  const root = await mkdtemp(join(parent, "run-"));
  const directories: Record<string, DirectoryIdentity> = { "": identity(await lstat(root)) };
  const context: RunContext = {
    version: 1,
    repoRoot: canonicalRepo,
    root,
    keepResults,
    suites: Object.freeze([...suites]),
    directories,
  };
  try {
    await chmod(root, 0o700);
    const paths = ["scratch", "results"];
    for (const suite of suites) {
      paths.push("scratch/" + suite, "results/" + suite);
      for (const child of ["fixtures", "processes", "exports", "home", "tmp", "workspace"]) {
        paths.push("scratch/" + suite + "/" + child);
      }
    }
    for (const path of paths) {
      assertRunParent(context, runPath(context, path));
      await mkdir(runPath(context, path), { mode: 0o700 });
      directories[path] = identity(await lstat(runPath(context, path)));
    }
    Object.freeze(directories);
    return Object.freeze(context);
  } catch (error) {
    try {
      assertRunRoot(context);
      await rm(root, { recursive: true });
    } catch (cleanupError) {
      throw new RunAllocationError([error, cleanupError], root);
    }
    throw error;
  }
}

export function fixtureEnvironment(context: RunContext, suite: Suite): string {
  suitePath(context, suite, "scratch");
  return JSON.stringify({ run: context, suite } satisfies FixtureContext);
}

/** Environment is a serialized context, never a request to adopt an arbitrary directory. */
export function readFixtureContext(
  env: NodeJS.ProcessEnv = process.env,
  expectedRepoRoot?: string,
): FixtureContext | undefined {
  const text = env[TEST_CONTEXT_ENV];
  if (text === undefined) return undefined;
  let value: FixtureContext;
  try {
    value = JSON.parse(text) as FixtureContext;
    const run = value.run;
    const parent = join(run.repoRoot, "examples", "playground", ".tmp-tests");
    if (
      run.version !== 1 ||
      typeof run.keepResults !== "boolean" ||
      !isAbsolute(run.repoRoot) ||
      resolve(run.repoRoot) !== run.repoRoot ||
      (expectedRepoRoot !== undefined && realpathSync(expectedRepoRoot) !== run.repoRoot) ||
      dirname(run.root) !== parent ||
      !/^run-[A-Za-z0-9]+$/.test(relative(parent, run.root)) ||
      !Array.isArray(run.suites) ||
      !run.suites.length ||
      new Set(run.suites).size !== run.suites.length ||
      run.suites.some((suite) => !SUITES.includes(suite)) ||
      !run.suites.includes(value.suite) ||
      !run.directories ||
      typeof run.directories !== "object"
    ) {
      throw new Error("Invalid context.");
    }
    for (const path of [
      "",
      "scratch",
      "results",
      "scratch/" + value.suite,
      "results/" + value.suite,
    ]) {
      const directory = run.directories[path];
      if (
        !directory ||
        !Number.isSafeInteger(directory.dev) ||
        !Number.isSafeInteger(directory.ino)
      ) {
        throw new Error("Invalid identity.");
      }
    }
  } catch {
    throw new Error("Invalid managed test context.");
  }
  assertRunRoot(value.run);
  assertRunPath(value.run, "scratch/" + value.suite);
  assertRunPath(value.run, "results/" + value.suite);
  return Object.freeze({
    run: Object.freeze({
      ...value.run,
      suites: Object.freeze([...value.run.suites]),
      directories: Object.freeze(
        Object.fromEntries(
          Object.entries(value.run.directories).map(([key, id]) => [key, Object.freeze(id)]),
        ),
      ),
    }),
    suite: value.suite,
  });
}

export async function removeRunScratch(context: RunContext): Promise<void> {
  assertRunPath(context, "scratch");
  await rm(runPath(context, "scratch"), { recursive: true });
}

export async function removeRun(context: RunContext): Promise<void> {
  assertRunRoot(context);
  await rm(context.root, { recursive: true });
}
