import { CliError } from "../../../errors";
import type { DataQueryInputFormat, DataQuerySourceShape } from "../types";

export function assertSingleObjectSourceContract(
  format: DataQueryInputFormat,
  shape: DataQuerySourceShape,
): void {
  const normalizedSource = shape.source?.trim();
  if (normalizedSource) {
    throw new CliError(`--source is not valid for ${format.toUpperCase()} query inputs.`, {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (shape.range?.trim()) {
    throw new CliError("--range is only valid for Excel query inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (shape.headerRow !== undefined) {
    throw new CliError("--header-row is only valid for Excel inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }

  if (shape.bodyStartRow !== undefined) {
    throw new CliError("--body-start-row is only valid for Excel inputs.", {
      code: "INVALID_INPUT",
      exitCode: 2,
    });
  }
}
