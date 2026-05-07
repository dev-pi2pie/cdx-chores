import { execFile } from "node:child_process";

import { fontconfigFontAdapter } from "./adapters/fontconfig";
import { linuxFontAdapter } from "./adapters/linux";
import { macosFontAdapter } from "./adapters/macos";
import { windowsFontAdapter } from "./adapters/windows";
import type {
  DiscoverFontsInput,
  DiscoverFontsResult,
  FontDiscoveryAdapter,
  FontDiscoveryCommandRunner,
} from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;

export const defaultFontDiscoveryRunner: FontDiscoveryCommandRunner = (command, args) =>
  new Promise((resolve) => {
    execFile(command, args, { timeout: DEFAULT_TIMEOUT_MS }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout,
        stderr,
      });
    });
  });

function adapterForPlatform(platform: NodeJS.Platform): FontDiscoveryAdapter {
  if (platform === "darwin") {
    return macosFontAdapter;
  }
  if (platform === "win32") {
    return windowsFontAdapter;
  }
  if (platform === "linux") {
    return linuxFontAdapter;
  }
  return fontconfigFontAdapter;
}

export async function discoverSystemFonts(
  input: DiscoverFontsInput = {},
): Promise<DiscoverFontsResult> {
  const adapter = adapterForPlatform(input.platform ?? process.platform);
  const result = await adapter.discover({
    runner: input.runner ?? defaultFontDiscoveryRunner,
  });
  return {
    ...result,
    adapter: adapter.name,
  };
}
