import { homedir } from "node:os";
import { posix, win32 } from "node:path";

import type { CliRuntime } from "../types";

export function formatBenchmarkReportPath(
  runtime: Pick<CliRuntime, "cwd" | "platform" | "displayPathStyle">,
  path: string | null,
  home = homedir(),
): string | null {
  if (path === null) return null;
  const windows = runtime.platform === "win32";
  const paths = windows ? win32 : posix;
  if (runtime.displayPathStyle === "absolute") return paths.resolve(runtime.cwd, path);
  if (!paths.isAbsolute(path) || !paths.isAbsolute(home)) return path;

  const fromHome = paths.relative(home, path);
  if (fromHome === ".." || fromHome.startsWith(`..${paths.sep}`) || paths.isAbsolute(fromHome)) {
    return path;
  }
  const prefix = windows ? "%USERPROFILE%" : "~";
  return fromHome === "" ? prefix : `${prefix}${paths.sep}${fromHome}`;
}
