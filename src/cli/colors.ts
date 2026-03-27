import { createColors } from "picocolors";

import type { CliRuntime } from "./types";

export function isNoColorEnvSet(env: NodeJS.ProcessEnv = process.env): boolean {
  return Object.prototype.hasOwnProperty.call(env, "NO_COLOR");
}

export function resolveCliColorEnabled(
  options: {
    env?: NodeJS.ProcessEnv;
    noColorFlag?: boolean;
  } = {},
): boolean {
  if (options.noColorFlag) {
    return false;
  }
  return !isNoColorEnvSet(options.env);
}

export function getCliColors(runtime: CliRuntime) {
  const stream = runtime.stdout as NodeJS.WritableStream & { isTTY?: boolean };
  return createColors(runtime.colorEnabled && Boolean(stream.isTTY));
}

export function getProcessColors(enabled = resolveCliColorEnabled()) {
  return createColors(enabled && Boolean(process.stdout.isTTY));
}
