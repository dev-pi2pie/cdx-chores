import { CliError } from "../errors";

export class DataStackSchemaMismatchError extends CliError {
  constructor(message: string) {
    super(message, {
      code: "DATA_STACK_SCHEMA_MISMATCH",
      exitCode: 2,
    });
  }
}

export function isDataStackSchemaMismatchError(
  error: unknown,
): error is DataStackSchemaMismatchError {
  return error instanceof DataStackSchemaMismatchError;
}
