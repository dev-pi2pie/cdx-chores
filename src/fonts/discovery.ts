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
const DEFAULT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

export const defaultFontDiscoveryRunner: FontDiscoveryCommandRunner = (command, args) =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout: DEFAULT_TIMEOUT_MS, maxBuffer: DEFAULT_MAX_BUFFER_BYTES },
      (error, stdout, stderr) => {
        const detail = stderr || (error instanceof Error ? error.message : "");
        resolve({
          ok: !error,
          stdout,
          stderr: detail,
        });
      },
    );
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
    faces: result.faces,
    warnings: result.warnings,
    adapter: result.adapterName ?? adapter.name,
  };
}
