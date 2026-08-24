import type { Command } from "commander";

import { styleCliDiagnosticLabel } from "../diagnostic-color";
import type { CliRuntime } from "../types";

const COMMANDER_ERROR_LABEL = "error:";

export function styleCommanderErrorOutput(runtime: CliRuntime, value: string): string {
  if (!value.startsWith(COMMANDER_ERROR_LABEL)) {
    return value;
  }

  const label = styleCliDiagnosticLabel(runtime, runtime.stderr, "error", COMMANDER_ERROR_LABEL);
  return `${label}${value.slice(COMMANDER_ERROR_LABEL.length)}`;
}

export function configureCliProgramOutput(program: Command, runtime: CliRuntime): void {
  program.configureOutput({
    writeOut: (value) => runtime.stdout.write(value),
    writeErr: (value) => runtime.stderr.write(value),
    outputError: (value, write) => write(styleCommanderErrorOutput(runtime, value)),
  });
}
