import { constants } from "node:fs";
import { access, readFile, realpath } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join } from "node:path";

export async function executable(name) {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!isAbsolute(directory)) continue;
    const path = join(directory, name);
    try {
      await access(path, constants.X_OK);
      return await realpath(path);
    } catch {
      // Continue only through the caller's configured executable search path.
    }
  }
  throw new Error("required executable unavailable");
}

/** Avoid shell/version-manager wrappers when invoking npm through the chosen Node. */
export async function npmCli() {
  for (const path of [
    join(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
    await executable("npm"),
  ]) {
    try {
      if ((await readFile(path, "utf8")).startsWith("#!/usr/bin/env node"))
        return await realpath(path);
    } catch {
      // Continue to the executable's canonical JavaScript entry.
    }
  }
  throw new Error("npm JavaScript entry unavailable");
}
