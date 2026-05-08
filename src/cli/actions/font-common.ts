import type { DiscoverFontsResult } from "../../fonts";
import { getCliColors } from "../colors";
import type { CliRuntime } from "../types";
import { printLine } from "./shared";

export function printFontDebugAttempts(runtime: CliRuntime, discovery: DiscoverFontsResult): void {
  if (!discovery.attempts) {
    return;
  }

  const pc = getCliColors(runtime);
  printLine(runtime.stdout, "");
  printLine(runtime.stdout, pc.bold("Debug:"));
  for (const attempt of discovery.attempts) {
    const status = attempt.status === "success" ? "success" : "failed";
    printLine(
      runtime.stdout,
      `- ${attempt.adapter}: ${status} in ${attempt.durationMs}ms (${attempt.message})`,
    );
  }
}

export function fontDiscoveryInfo(discovery: DiscoverFontsResult): string[] {
  if (discovery.selectionReason === "macos-auto-fontconfig") {
    return [
      "using fontconfig because fc-list is available. Use --discovery native to force macOS system_profiler.",
    ];
  }
  if (discovery.selectionReason === "macos-auto-native-fallback") {
    return ["fontconfig was unavailable, so macOS native discovery was used."];
  }
  return [];
}
