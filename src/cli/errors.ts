export class CliError extends Error {
  readonly exitCode: number;
  readonly code: string;

  constructor(message: string, options: { exitCode?: number; code?: string } = {}) {
    super(message);
    this.name = "CliError";
    this.exitCode = options.exitCode ?? 1;
    this.code = options.code ?? "CLI_ERROR";
  }
}

export function toCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new CliError(message);
}

