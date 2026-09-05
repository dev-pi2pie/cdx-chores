import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  assertRunPath,
  fixtureEnvironment,
  suitePath,
  TEST_CONTEXT_ENV,
  type RunContext,
} from "./run-context.ts";
import { SUITES, type Suite } from "./selection.ts";

export interface InvocationOptions {
  readonly suites: readonly Suite[];
  readonly keepResults: boolean;
}

/** Parse before discovery, allocation, or prerequisites. Internal test seams are not CLI options. */
export function parseInvocation(args: readonly string[]): InvocationOptions {
  const [selection, ...flags] = args;
  if (selection !== "all" && !SUITES.includes(selection as Suite)) {
    throw new Error("Expected one suite: unit, app, codex, pandoc, or all.");
  }
  if (flags.some((flag) => flag !== "--keep-results") || flags.length > 1) {
    throw new Error("Unknown or repeated argument. Only --keep-results is supported.");
  }
  return Object.freeze({
    suites: Object.freeze(selection === "all" ? [...SUITES] : [selection as Suite]),
    keepResults: flags.length === 1,
  });
}

/** Snapshot an allowlist; never forward credentials, loader flags, or personal configuration. */
export async function createSuiteEnvironment(
  context: RunContext,
  suite: Suite,
  sourceEnv: NodeJS.ProcessEnv,
): Promise<NodeJS.ProcessEnv> {
  const scratch = suitePath(context, suite, "scratch");
  const home = join(scratch, "home");
  assertRunPath(context, "scratch/" + suite + "/home");
  for (const path of [".codex", "config", "data", "cache"]) {
    await mkdir(join(home, path), { mode: 0o700 });
  }
  await writeFile(join(home, ".gitconfig"), "", { flag: "wx", mode: 0o600 });
  const temporary = join(scratch, "tmp");
  return Object.freeze({
    PATH: sourceEnv.PATH ?? "",
    HOME: home,
    CODEX_HOME: join(home, ".codex"),
    TMPDIR: temporary,
    TMP: temporary,
    TEMP: temporary,
    XDG_CONFIG_HOME: join(home, "config"),
    XDG_DATA_HOME: join(home, "data"),
    XDG_CACHE_HOME: join(home, "cache"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: join(home, ".gitconfig"),
    GIT_CEILING_DIRECTORIES: context.repoRoot,
    LANG: "C.UTF-8",
    [TEST_CONTEXT_ENV]: fixtureEnvironment(context, suite),
  });
}
