import type { HarnessRunnerContext } from "../context";

export interface ActionRuntimeLike {
  stdout: { write(chunk: string): boolean };
  stderr: { write(chunk: string): boolean };
}

export function resolveOutputPath(
  context: HarnessRunnerContext,
  options: Record<string, unknown>,
): string | undefined {
  if (typeof options.output !== "string" || options.output.length === 0) {
    return undefined;
  }

  return context.resolveHarnessPath(options.output);
}

export function createOutputExistsError(outputPath: string): Error & { code: string } {
  const error = new Error(
    `Output file already exists: ${outputPath}. Use --overwrite to replace it.`,
  ) as Error & { code: string };
  error.code = "OUTPUT_EXISTS";
  return error;
}
