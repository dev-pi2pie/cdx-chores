import { execFile } from "node:child_process";

import { fontconfigFontAdapter } from "./adapters/fontconfig";
import { linuxFontAdapter } from "./adapters/linux";
import { macosFontAdapter } from "./adapters/macos";
import { windowsFontAdapter } from "./adapters/windows";
import type {
  DiscoverFontsInput,
  DiscoverFontsResult,
  FontDiscoveryAdapter,
  FontDiscoveryAttempt,
  FontDiscoveryCommandRunner,
  FontDiscoveryMode,
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

function nativeAdapterForPlatform(platform: NodeJS.Platform): FontDiscoveryAdapter {
  return adapterForPlatform(platform);
}

function sanitizeCommandFailure(command: string): string {
  if (command === "fc-list") {
    return "fc-list was not available or failed.";
  }
  if (command === "system_profiler") {
    return "macOS native font discovery failed.";
  }
  if (command === "powershell.exe") {
    return "Windows registry font discovery failed.";
  }
  return `${command} failed.`;
}

function successMessage(command: string): string {
  if (command === "fc-list") {
    return "fontconfig discovery succeeded.";
  }
  if (command === "system_profiler") {
    return "macOS native discovery succeeded.";
  }
  if (command === "powershell.exe") {
    return "Windows registry discovery succeeded.";
  }
  return `${command} succeeded.`;
}

function createDebugRunner(
  runner: FontDiscoveryCommandRunner,
  attempts: FontDiscoveryAttempt[],
  adapter: string,
): FontDiscoveryCommandRunner {
  return async (command, args) => {
    const startedAt = Date.now();
    const result = await runner(command, args);
    attempts.push({
      adapter,
      command,
      status: result.ok ? "success" : "failed",
      durationMs: Math.max(0, Date.now() - startedAt),
      message: result.ok ? successMessage(command) : sanitizeCommandFailure(command),
    });
    return result;
  };
}

function attemptResult(
  enabled: boolean,
  attempts: FontDiscoveryAttempt[],
): FontDiscoveryAttempt[] | undefined {
  return enabled ? attempts : undefined;
}

async function discoverWithAdapter(
  adapter: FontDiscoveryAdapter,
  runner: FontDiscoveryCommandRunner,
  attempts: FontDiscoveryAttempt[],
): Promise<DiscoverFontsResult> {
  const result = await adapter.discover({
    runner: createDebugRunner(runner, attempts, adapter.name),
  });
  return {
    faces: result.faces,
    warnings: result.warnings,
    adapter: result.adapterName ?? adapter.name,
    discovery: "auto",
  };
}

async function discoverFontconfig(
  mode: FontDiscoveryMode,
  runner: FontDiscoveryCommandRunner,
  attempts: FontDiscoveryAttempt[],
): Promise<DiscoverFontsResult> {
  const result = await discoverWithAdapter(fontconfigFontAdapter, runner, attempts);
  return {
    ...result,
    discovery: mode,
  };
}

async function discoverNative(
  platform: NodeJS.Platform,
  mode: FontDiscoveryMode,
  runner: FontDiscoveryCommandRunner,
  attempts: FontDiscoveryAttempt[],
): Promise<DiscoverFontsResult> {
  const result = await discoverWithAdapter(nativeAdapterForPlatform(platform), runner, attempts);
  return {
    ...result,
    discovery: mode,
  };
}

async function discoverMacosAuto(
  runner: FontDiscoveryCommandRunner,
  attempts: FontDiscoveryAttempt[],
): Promise<DiscoverFontsResult> {
  const fontconfigResult = await discoverWithAdapter(fontconfigFontAdapter, runner, attempts);
  if (fontconfigResult.faces.length > 0) {
    return {
      ...fontconfigResult,
      adapter: "macos-fontconfig",
      discovery: "auto",
      selectionReason: "macos-auto-fontconfig",
    };
  }

  const nativeResult = await discoverWithAdapter(macosFontAdapter, runner, attempts);
  return {
    ...nativeResult,
    discovery: "auto",
    selectionReason: "macos-auto-native-fallback",
  };
}

export async function discoverSystemFonts(
  input: DiscoverFontsInput = {},
): Promise<DiscoverFontsResult> {
  const platform = input.platform ?? process.platform;
  const mode = input.discovery ?? "auto";
  const runner = input.runner ?? defaultFontDiscoveryRunner;
  const attempts: FontDiscoveryAttempt[] = [];
  const includeAttempts = input.includeAttempts ?? false;

  if (mode === "fontconfig") {
    const result = await discoverFontconfig(mode, runner, attempts);
    return {
      ...result,
      attempts: attemptResult(includeAttempts, attempts),
    };
  }

  if (mode === "native") {
    const result = await discoverNative(platform, mode, runner, attempts);
    return {
      ...result,
      attempts: attemptResult(includeAttempts, attempts),
    };
  }

  const result =
    platform === "darwin"
      ? await discoverMacosAuto(runner, attempts)
      : await discoverNative(platform, mode, runner, attempts);

  return {
    ...result,
    attempts: attemptResult(includeAttempts, attempts),
  };
}
