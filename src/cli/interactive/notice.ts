import type { CliRuntime } from "../types";

export function resolveInteractiveNoticeWidth(runtime: CliRuntime): number | undefined {
  const stream = runtime.stdout as NodeJS.WritableStream & { columns?: number; isTTY?: boolean };
  if (!stream.isTTY) {
    return undefined;
  }
  if (typeof stream.columns === "number" && Number.isFinite(stream.columns)) {
    return Math.max(1, Math.floor(stream.columns));
  }
  return 80;
}

export function getInteractiveAbortNotice(runtime: CliRuntime): string | undefined {
  const width = resolveInteractiveNoticeWidth(runtime);
  if (width === undefined) {
    return undefined;
  }
  if (width < 24) {
    return "Ctrl+C to abort.";
  }
  if (width < 40) {
    return "Press Ctrl+C to abort.";
  }
  return "Press Ctrl+C to abort this session.";
}
