import { execFile } from "node:child_process";
import { performance } from "node:perf_hooks";

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
  FontDiscoveryFailureKind,
  FontDiscoveryRunOptions,
  FontDiscoveryMode,
} from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

function normalizedTimeoutMs(timeoutMs: number | undefined): number {
  return timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

function classifyRunnerFailure(
  error: Error | null,
  signal: AbortSignal | undefined,
): FontDiscoveryFailureKind | undefined {
  if (!error || signal?.aborted || error.name === "AbortError") {
    return undefined;
  }
  if ("killed" in error && error.killed === true) {
    return "timeout";
  }
  return undefined;
}

export const defaultFontDiscoveryRunner: FontDiscoveryCommandRunner = (command, args, options) =>
  new Promise((resolve) => {
    const timeoutMs = normalizedTimeoutMs(options?.timeoutMs);
    execFile(
      command,
      args,
      {
        maxBuffer: DEFAULT_MAX_BUFFER_BYTES,
        signal: options?.signal,
        timeout: timeoutMs,
      },
      (error, stdout, stderr) => {
        const detail = stderr || (error instanceof Error ? error.message : "");
        const failureKind = classifyRunnerFailure(error, options?.signal);
        resolve({
          ok: !error,
          stdout,
          stderr: detail,
          ...(failureKind ? { failureKind } : {}),
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

function classifiedFailureMessage(
  command: string,
  failureKind: "failed" | FontDiscoveryFailureKind,
): string {
  if (failureKind === "failed") {
    return sanitizeCommandFailure(command);
  }
  if (command === "fc-list") {
    return "fontconfig discovery timed out.";
  }
  if (command === "system_profiler") {
    return "macOS native font discovery timed out.";
  }
  if (command === "powershell.exe") {
    return "Windows registry font discovery timed out.";
  }
  return `${command} timed out.`;
}

function createDebugRunner(
  runner: FontDiscoveryCommandRunner,
  attempts: FontDiscoveryAttempt[],
  adapter: string,
): FontDiscoveryCommandRunner {
  return async (command, args, options) => {
    const startedAt = performance.now();
    const result = await runner(command, args, options);
    const status = result.ok ? "success" : (result.failureKind ?? "failed");
    attempts.push({
      adapter,
      command,
      status,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      message:
        status === "success" ? successMessage(command) : classifiedFailureMessage(command, status),
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
  runOptions?: FontDiscoveryRunOptions,
): Promise<DiscoverFontsResult> {
  const result = await adapter.discover({
    runner: createDebugRunner(runner, attempts, adapter.name),
    runOptions,
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
  runOptions?: FontDiscoveryRunOptions,
): Promise<DiscoverFontsResult> {
  const result = await discoverWithAdapter(fontconfigFontAdapter, runner, attempts, runOptions);
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
  runOptions?: FontDiscoveryRunOptions,
): Promise<DiscoverFontsResult> {
  const result = await discoverWithAdapter(
    nativeAdapterForPlatform(platform),
    runner,
    attempts,
    runOptions,
  );
  return {
    ...result,
    discovery: mode,
  };
}

async function discoverMacosAuto(
  runner: FontDiscoveryCommandRunner,
  attempts: FontDiscoveryAttempt[],
  runOptions?: FontDiscoveryRunOptions,
): Promise<DiscoverFontsResult> {
  const fontconfigResult = await discoverWithAdapter(
    fontconfigFontAdapter,
    runner,
    attempts,
    runOptions,
  );
  if (fontconfigResult.faces.length > 0) {
    return {
      ...fontconfigResult,
      adapter: "macos-fontconfig",
      discovery: "auto",
      selectionReason: "macos-auto-fontconfig",
    };
  }

  const nativeResult = await discoverWithAdapter(macosFontAdapter, runner, attempts, runOptions);
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
  const runOptions = {
    signal: input.signal,
    timeoutMs: input.timeoutMs,
  } satisfies FontDiscoveryRunOptions;

  if (mode === "fontconfig") {
    const result = await discoverFontconfig(mode, runner, attempts, runOptions);
    return {
      ...result,
      attempts: attemptResult(includeAttempts, attempts),
    };
  }

  if (mode === "native") {
    const result = await discoverNative(platform, mode, runner, attempts, runOptions);
    return {
      ...result,
      attempts: attemptResult(includeAttempts, attempts),
    };
  }

  const result =
    platform === "darwin"
      ? await discoverMacosAuto(runner, attempts, runOptions)
      : await discoverNative(platform, mode, runner, attempts, runOptions);

  return {
    ...result,
    attempts: attemptResult(includeAttempts, attempts),
  };
}
