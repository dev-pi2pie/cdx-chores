import { relative, resolve } from "node:path";

import type { CliRuntime } from "./types";

export { defaultOutputPath } from "../utils/paths";

export function resolveFromCwd(runtime: CliRuntime, filePath: string): string {
  return resolve(runtime.cwd, filePath);
}

export function formatPathForDisplay(runtime: CliRuntime, filePath: string): string {
  if (runtime.displayPathStyle === "absolute") {
    return filePath;
  }

  const relativePath = relative(runtime.cwd, filePath);
  return relativePath.length > 0 ? relativePath : ".";
}
