import type { CliRuntime } from "../../../types";
import { startDirectCodexProgress } from "../../codex-progress";

export function startAnalyzerProgress(
  runtime: CliRuntime,
  label: string,
): { stop: (status: "done" | "fallback") => void } {
  return startDirectCodexProgress(runtime.stdout, label, { clearLine: false });
}
