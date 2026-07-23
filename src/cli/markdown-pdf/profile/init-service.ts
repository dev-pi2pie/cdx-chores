import { writeTextFileSafe } from "../../file-io";
import { resolveFromCwd } from "../../path-utils";
import type { CliRuntime } from "../../types";
import { assertNonEmpty, displayPath } from "../../actions/shared";
import type { NormalizedMarkdownPdfOptions } from "../validation";
import { createMarkdownPdfProfileConfig } from "./materialize";
import { inferMarkdownPdfProfileFormat } from "./schema";
import { serializeMarkdownPdfProfile } from "./serialize";
import type { MarkdownPdfProfileFormat, NormalizedMarkdownPdfCode } from "./types";

export interface PreparedMarkdownPdfProfileInit {
  normalizedOptions: NormalizedMarkdownPdfOptions;
  profile: Record<string, unknown>;
}

export interface MarkdownPdfProfileInitDestinationOptions {
  output: string;
  overwrite?: boolean;
}

export interface BoundMarkdownPdfProfileInitDestination {
  displayOutputPath: string;
  format: MarkdownPdfProfileFormat;
  outputPath: string;
  overwrite?: boolean;
  prepared: PreparedMarkdownPdfProfileInit;
  serializedProfile: string;
}

export function prepareMarkdownPdfProfileInit(
  normalizedOptions: NormalizedMarkdownPdfOptions,
  input: { code?: NormalizedMarkdownPdfCode } = {},
): PreparedMarkdownPdfProfileInit {
  const acceptedOptions = structuredClone(normalizedOptions);
  const profile = structuredClone(createMarkdownPdfProfileConfig(acceptedOptions));
  if (input.code) {
    profile.code = structuredClone(input.code);
  }
  return {
    normalizedOptions: acceptedOptions,
    profile,
  };
}

export function bindPreparedMarkdownPdfProfileInitDestination(
  runtime: CliRuntime,
  prepared: PreparedMarkdownPdfProfileInit,
  options: MarkdownPdfProfileInitDestinationOptions,
): BoundMarkdownPdfProfileInitDestination {
  const outputPath = resolveFromCwd(runtime, assertNonEmpty(options.output, "Output path"));
  const format = inferMarkdownPdfProfileFormat(outputPath);

  return {
    displayOutputPath: displayPath(runtime, outputPath),
    format,
    outputPath,
    overwrite: options.overwrite,
    prepared,
    serializedProfile: serializeMarkdownPdfProfile(prepared.profile, format),
  };
}

export async function writePreparedMarkdownPdfProfileInit(
  destination: BoundMarkdownPdfProfileInitDestination,
): Promise<void> {
  await writeTextFileSafe(destination.outputPath, destination.serializedProfile, {
    overwrite: destination.overwrite,
  });
}
