import { getCliColors } from "./colors";
import type { CliRuntime } from "./types";

export type CliDiagnosticPresentationRole = "error" | "notice" | "warning";

export function styleCliDiagnosticLabel(
  runtime: CliRuntime,
  targetStream: NodeJS.WritableStream,
  role: CliDiagnosticPresentationRole,
  label: string,
): string {
  const colors = getCliColors(runtime, targetStream);

  switch (role) {
    case "error":
      return colors.bold(colors.red(label));
    case "notice":
      return colors.cyan(label);
    case "warning":
      return colors.bold(colors.yellow(label));
    default:
      return label;
  }
}
